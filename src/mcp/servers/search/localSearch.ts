import fs from "node:fs/promises"
import path from "node:path"
import { DEFAULT_DENY_DIRS, normalizeRelPath, PROJECT_ROOT } from "./sandbox.js"

export interface LocalSearchOptions {
  includeExtensions: Set<string>
  denyDirs?: Set<string>
  startDirRel?: string
  maxFiles?: number
  maxFileBytes?: number
  maxResults?: number
  filePattern?: string
  dateFrom?: Date
  dateTo?: Date
}

export interface LocalMatch {
  location: string
  snippet: string
  score: number
  metadata: Record<string, unknown>
}

const DEFAULT_MAX_FILES = 800
const DEFAULT_MAX_FILE_BYTES = 512 * 1024 // 512 KB
const DEFAULT_MAX_RESULTS = 50
const SNIPPET_CHARS = 180

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8)
}

function safePatternToRegex(pattern: string): RegExp | null {
  const p = pattern.trim()
  if (!p) return null
  if (p.length > 128) throw new Error("file_pattern too long")

  const escaped = p
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")

  return new RegExp(`^${escaped}$`, "i")
}

function buildSnippet(content: string, idx: number): { snippet: string; line: number; col: number } {
  const start = Math.max(0, idx - Math.floor(SNIPPET_CHARS / 2))
  const end = Math.min(content.length, start + SNIPPET_CHARS)
  const raw = content.slice(start, end)
  const snippet = raw.replace(/\s+/g, " ").trim()

  const before = content.slice(0, idx)
  const line = before.split("\n").length
  const lastNl = before.lastIndexOf("\n")
  const col = lastNl === -1 ? idx + 1 : idx - lastNl

  return { snippet, line, col }
}

function scoreMatch(query: string, contentLower: string, firstIdx: number): number {
  const q = query.toLowerCase()
  const tokens = tokenize(q)
  const exactCount = q.length >= 2 ? contentLower.split(q).length - 1 : 0
  const tokenHits = tokens.filter((t) => contentLower.includes(t)).length
  const coverage = tokens.length ? tokenHits / tokens.length : 0

  let s = 0.2
  s += Math.min(0.6, exactCount * 0.15)
  s += Math.min(0.2, coverage * 0.2)
  s += firstIdx <= 200 ? 0.05 : 0
  return Math.max(0, Math.min(1, s))
}

async function isProbablyTextFile(absPath: string, maxBytes: number): Promise<boolean> {
  const handle = await fs.open(absPath, "r")
  try {
    const { buffer, bytesRead } = await handle.read({
      buffer: Buffer.alloc(Math.min(4096, maxBytes)),
      position: 0
    })
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return false
    }
    return true
  } finally {
    await handle.close()
  }
}

async function walk(dirAbs: string, opts: { denyDirs: Set<string>; maxFiles: number }): Promise<string[]> {
  const results: string[] = []
  const stack: string[] = [dirAbs]

  while (stack.length) {
    const current = stack.pop() as string
    const entries = await fs.readdir(current, { withFileTypes: true })

    for (const ent of entries) {
      const abs = path.join(current, ent.name)
      if (ent.isDirectory()) {
        if (opts.denyDirs.has(ent.name)) continue
        stack.push(abs)
        continue
      }
      if (!ent.isFile()) continue

      results.push(abs)
      if (results.length >= opts.maxFiles) return results
    }
  }

  return results
}

export async function localSearch(query: string, options: LocalSearchOptions): Promise<LocalMatch[]> {
  const q = query?.trim()
  if (!q) return []
  if (q.length > 512) throw new Error("query too long")

  const denyDirs = options.denyDirs ?? DEFAULT_DENY_DIRS
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS
  const fileRegex = options.filePattern ? safePatternToRegex(options.filePattern) : null

  const startDirAbs = options.startDirRel
    ? path.resolve(PROJECT_ROOT, options.startDirRel)
    : PROJECT_ROOT
  if (!startDirAbs.startsWith(PROJECT_ROOT)) throw new Error("Invalid start directory")

  const files = await walk(startDirAbs, { denyDirs, maxFiles })

  const matches: LocalMatch[] = []
  const qLower = q.toLowerCase()

  for (const absPath of files) {
    const ext = path.extname(absPath).toLowerCase()
    if (ext && !options.includeExtensions.has(ext)) continue

    const rel = normalizeRelPath(absPath)
    if (fileRegex && !fileRegex.test(rel)) continue

    const stat = await fs.stat(absPath)
    if (stat.size > maxFileBytes) continue
    if (options.dateFrom && stat.mtime < options.dateFrom) continue
    if (options.dateTo && stat.mtime > options.dateTo) continue

    if (!(await isProbablyTextFile(absPath, maxFileBytes))) continue

    const content = await fs.readFile(absPath, "utf8")
    const contentLower = content.toLowerCase()
    const idx = contentLower.indexOf(qLower)
    if (idx === -1) continue

    const { snippet, line, col } = buildSnippet(content, idx)
    const score = scoreMatch(q, contentLower, idx)

    matches.push({
      location: `${rel}:${line}:${col}`,
      snippet,
      score,
      metadata: { path: rel, line, col, created_at: stat.mtime.toISOString() }
    })

    if (matches.length >= maxResults) break
  }

  return matches
}
