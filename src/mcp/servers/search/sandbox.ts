import path from "node:path"

// Security boundary for local search.
export const PROJECT_ROOT = path.resolve(process.cwd())

export const DEFAULT_DENY_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".svn",
  ".hg"
])

export function resolveWithinRoot(relPath: string): string {
  const resolved = path.resolve(PROJECT_ROOT, relPath)
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error("Path traversal detected")
  }
  return resolved
}

export function normalizeRelPath(absPath: string): string {
  const rel = path.relative(PROJECT_ROOT, absPath)
  return rel.split(path.sep).join("/")
}
