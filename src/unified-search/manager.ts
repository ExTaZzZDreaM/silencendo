/**
 * Unified Search Manager (core)
 *
 * A single entry point for searching across multiple sources:
 *   - code
 *   - memory
 *   - docs
 *   - logs
 */

export type UnifiedSearchScope = "all" | "code" | "docs" | "memory" | "logs"
export type UnifiedSearchSource = Exclude<UnifiedSearchScope, "all">

export interface UnifiedSearchParams {
  query: string
  scope?: UnifiedSearchScope
  limit?: number
  include_scores?: boolean
  filters?: {
    file_pattern?: string
    category?: string
    date_from?: string
    date_to?: string
  }
}

export interface UnifiedSearchItem {
  type: UnifiedSearchSource
  location: string
  score: number
  snippet: string
  source: string
  metadata?: Record<string, unknown>
}

export interface UnifiedSearchResult {
  results: UnifiedSearchItem[]
  total_found: number
  search_duration_ms: number
}

export interface UnifiedSearchOptions {
  /**
   * Source weights used by the Ranking Engine.
   * Defaults align with mcp-config.yaml example.
   */
  source_weights?: Partial<Record<UnifiedSearchSource, number>>
}

export type SearchProvider = (
  query: string,
  filters?: UnifiedSearchParams["filters"]
) => Promise<UnifiedSearchItem[]>

export interface UnifiedSearchProviders {
  code?: SearchProvider
  memory?: SearchProvider
  docs?: SearchProvider
  logs?: SearchProvider
}

export interface QueryAnalysis {
  sources: UnifiedSearchSource[]
  priority: UnifiedSearchSource[]
}

const DEFAULT_SOURCE_WEIGHTS: Record<UnifiedSearchSource, number> = {
  memory: 1.0,
  code: 0.8,
  logs: 0.7,
  docs: 0.6
}

const DEFAULT_LIMIT = 10

function clampLimit(limit: number | undefined): number {
  const n = Number.isFinite(limit) ? Math.floor(limit as number) : DEFAULT_LIMIT
  return Math.min(Math.max(n, 1), 50)
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase()
}

function detectSources(
  query: string,
  keywords: Record<UnifiedSearchSource, string[]>
): UnifiedSearchSource[] {
  const q = normalizeQuery(query)
  const hit: UnifiedSearchSource[] = []
  ;(["code", "docs", "memory", "logs"] as UnifiedSearchSource[]).forEach((src) => {
    if (keywords[src].some((k) => q.includes(k))) hit.push(src)
  })
  return hit
}

/**
 * Query analyzer:
 *  - For scope=all we always search code+memory+docs.
 *  - logs is added only when explicitly requested (log markers).
 *  - Priority follows architecture: memory > code > logs > docs.
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const keywords: Record<UnifiedSearchSource, string[]> = {
    code: ["функц", "класс", "метод", "bug", "ts", "typescript", "interface", "тип"],
    docs: ["как работает", "документац", "guide", "how to", "manual", "readme"],
    memory: ["решени", "decision", "архитектур", "почему", "rfc"],
    logs: ["лог", "stderr", "traceback", "stack trace", "panic", "exception"]
  }

  const detected = detectSources(query, keywords)

  const base: UnifiedSearchSource[] = ["code", "memory", "docs"]
  const sourcesSet = new Set<UnifiedSearchSource>(base)
  if (detected.includes("logs")) sourcesSet.add("logs")

  const sources = Array.from(sourcesSet)
  const globalPriority: UnifiedSearchSource[] = ["memory", "code", "logs", "docs"]
  const priority = globalPriority.filter((s) => sources.includes(s))
  return { sources, priority }
}

function uniqueByTypeAndLocation(items: UnifiedSearchItem[]): UnifiedSearchItem[] {
  const seen = new Map<string, UnifiedSearchItem>()
  for (const it of items) {
    const key = `${it.type}:${it.location}`
    const prev = seen.get(key)
    if (!prev || prev.score < it.score) seen.set(key, it)
  }
  return Array.from(seen.values())
}

function normalizeForSimilarity(text: string): string {
  // Keep this deterministic and cheap; avoid any heavy NLP.
  // Unicode property escapes are available in ES2022 (Node 20).
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function similarityKey(item: UnifiedSearchItem): string {
  const base = normalizeForSimilarity(item.snippet || "")
  if (base.length >= 12) return base.slice(0, 120)
  // Fallback if snippet is too short / empty.
  return normalizeForSimilarity(item.location).slice(0, 120)
}

function groupBySimilarity(items: UnifiedSearchItem[]): UnifiedSearchItem[][] {
  const groups = new Map<string, UnifiedSearchItem[]>()
  for (const it of items) {
    const key = similarityKey(it)
    const arr = groups.get(key)
    if (arr) arr.push(it)
    else groups.set(key, [it])
  }
  return Array.from(groups.values())
}

/**
 * If the same (or very similar) snippet is found in multiple sources,
 * boost their scores (+10% for each additional distinct source).
 */
function boostCrossSourceResults(items: UnifiedSearchItem[]): UnifiedSearchItem[] {
  const grouped = groupBySimilarity(items)
  const boosted: UnifiedSearchItem[] = []

  for (const group of grouped) {
    const distinctSources = new Set(group.map((g) => g.type)).size
    if (distinctSources <= 1) {
      boosted.push(...group)
      continue
    }
    const boost = 1 + Math.max(0, distinctSources - 1) * 0.1
    for (const r of group) {
      const s = Math.min(1, Math.max(0, r.score * boost))
      boosted.push({ ...r, score: s })
    }
  }

  return boosted
}

function isTimeSensitiveQuery(query: string, filters?: UnifiedSearchParams["filters"]): boolean {
  if (filters?.date_from || filters?.date_to) return true
  const q = normalizeQuery(query)
  return (
    q.includes("сегодня") ||
    q.includes("вчера") ||
    q.includes("последн") ||
    q.includes("недавн") ||
    q.includes("recent") ||
    q.includes("latest")
  )
}

function applyFreshnessBoost(items: UnifiedSearchItem[]): UnifiedSearchItem[] {
  const now = Date.now()
  return items.map((r) => {
    const createdAt = r.metadata?.created_at
    if (typeof createdAt !== "string") return r
    const t = new Date(createdAt).getTime()
    if (!Number.isFinite(t)) return r

    const ageMs = Math.max(0, now - t)
    const daysSince = ageMs / (1000 * 60 * 60 * 24)
    const freshness = Math.exp(-daysSince / 30)
    const boosted = r.score * (1 + freshness * 0.2)
    return { ...r, score: Math.min(1, Math.max(0, boosted)) }
  })
}

function rankResults(
  items: UnifiedSearchItem[],
  weights: Record<UnifiedSearchSource, number>,
  priority: UnifiedSearchSource[]
): UnifiedSearchItem[] {
  const p = new Map<UnifiedSearchSource, number>()
  priority.forEach((s, i) => p.set(s, i))

  return items
    .map((r) => ({
      r,
      weighted: r.score * (weights[r.type] ?? 0.5)
    }))
    .sort((a, b) => {
      if (b.weighted !== a.weighted) return b.weighted - a.weighted
      const ap = p.get(a.r.type) ?? 999
      const bp = p.get(b.r.type) ?? 999
      if (ap !== bp) return ap - bp
      return b.r.score - a.r.score
    })
    .map((x) => x.r)
}

export function aggregateResults(
  resultsBySource: UnifiedSearchItem[][],
  params: UnifiedSearchParams,
  analysis: QueryAnalysis,
  options?: UnifiedSearchOptions
): UnifiedSearchResult {
  const limit = clampLimit(params.limit)
  const includeScores = params.include_scores ?? true

  const weights: Record<UnifiedSearchSource, number> = {
    ...DEFAULT_SOURCE_WEIGHTS,
    ...(options?.source_weights ?? {})
  }

  const flattened = resultsBySource.flat()

  // 1) Deduplicate
  let stage = uniqueByTypeAndLocation(flattened)

  // 2) Freshness boost (only when time-sensitive / date filters)
  if (isTimeSensitiveQuery(params.query, params.filters)) {
    stage = applyFreshnessBoost(stage)
  }

  // 3) Cross-source boost
  stage = boostCrossSourceResults(stage)

  // 4) Weighted rank
  const ranked = rankResults(stage, weights, analysis.priority)

  // 5) include_scores affects output only
  const out = includeScores ? ranked : ranked.map((r) => ({ ...r, score: 0 }))

  return {
    results: out.slice(0, limit),
    total_found: ranked.length,
    search_duration_ms: 0
  }
}

async function safeCallProvider(
  provider: SearchProvider | undefined,
  query: string,
  filters: UnifiedSearchParams["filters"],
  type: UnifiedSearchSource
): Promise<UnifiedSearchItem[]> {
  if (!provider) return []
  const items = await provider(query, filters)
  return items
    .filter((it) => it && it.type === type)
    .map((it) => ({
      ...it,
      score: Number.isFinite(it.score) ? Math.min(Math.max(it.score, 0), 1) : 0
    }))
}

export async function unifiedSearch(
  params: UnifiedSearchParams,
  providers: UnifiedSearchProviders,
  options?: UnifiedSearchOptions
): Promise<UnifiedSearchResult> {
  if (!params || typeof params.query !== "string" || !params.query.trim()) {
    throw new Error("Invalid query")
  }

  const started = Date.now()
  const analysis = analyzeQuery(params.query)
  const scope = params.scope ?? "all"

  const sources: UnifiedSearchSource[] = scope === "all" ? analysis.sources : [scope]
  const filters = params.filters

  const tasks: Array<Promise<UnifiedSearchItem[]>> = []
  if (sources.includes("code")) tasks.push(safeCallProvider(providers.code, params.query, filters, "code"))
  if (sources.includes("memory"))
    tasks.push(safeCallProvider(providers.memory, params.query, filters, "memory"))
  if (sources.includes("docs")) tasks.push(safeCallProvider(providers.docs, params.query, filters, "docs"))
  if (sources.includes("logs")) tasks.push(safeCallProvider(providers.logs, params.query, filters, "logs"))

  const settled = await Promise.allSettled(tasks)
  const resultsBySource = settled.map((s) => (s.status === "fulfilled" ? s.value : []))

  const aggregated = aggregateResults(resultsBySource, params, { sources, priority: analysis.priority }, options)
  aggregated.search_duration_ms = Math.max(1, Date.now() - started)
  return aggregated
}
