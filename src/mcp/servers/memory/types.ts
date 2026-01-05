export type SearchMode = "hybrid" | "vector_only" | "keyword_only"

export interface MemoryRetrieveParams {
  query: string
  category?: string
  tags?: string[]
  limit?: number
  min_similarity?: number
  search_mode?: SearchMode
}

export interface NormalizedMemoryRetrieveParams {
  query: string
  category: string | null
  tags: string[] | null
  limit: number
  min_similarity: number
  search_mode: SearchMode
}

export function normalizeRetrieveParams(
  params: MemoryRetrieveParams
): NormalizedMemoryRetrieveParams {
  return {
    query: params.query,
    category: params.category ?? null,
    tags: params.tags ?? null,
    limit: params.limit ?? 10,
    min_similarity: params.min_similarity ?? 0.5,
    search_mode: params.search_mode ?? "hybrid"
  }
}
