import crypto from "node:crypto"

interface CacheEntry {
  embedding: number[]
  expiresAt: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 часа
const MAX_CACHE_SIZE = 1000

const cache = new Map<string, CacheEntry>()

export function makeEmbeddingCacheKey(
  query: string,
  params: unknown
): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ query, params }))
    .digest("hex")
}

export function getCachedEmbedding(cacheKey: string): number[] | null {
  const entry = cache.get(cacheKey)

  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey)
    return null
  }

  return entry.embedding
}

export function setCachedEmbedding(
  cacheKey: string,
  embedding: number[]
) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }

  cache.set(cacheKey, {
    embedding,
    expiresAt: Date.now() + CACHE_TTL_MS
  })
}
