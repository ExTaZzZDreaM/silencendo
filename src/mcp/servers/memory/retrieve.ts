import { query } from "./db.js"
import { embed } from "./embeddings.js"
import {
  MemoryRetrieveParams,
  normalizeRetrieveParams
} from "./types.js"
import {
  makeEmbeddingCacheKey,
  getCachedEmbedding,
  setCachedEmbedding
} from "./embeddings-cache.js"

export interface MemoryRetrieveResult {
  id: string
  key: string
  value: string
  category: string | null
  tags: string[] | null
  similarity_score: number
  created_at: string
  updated_at: string
}

export async function memoryRetrieve(
  rawParams: MemoryRetrieveParams
): Promise<{ results: MemoryRetrieveResult[] }> {
  const params = normalizeRetrieveParams(rawParams)

  let results: MemoryRetrieveResult[] = []

  /* =========================
     VECTOR SEARCH
     ========================= */
  if (params.search_mode !== "keyword_only") {
    const cacheKey = makeEmbeddingCacheKey(params.query, {
      category: params.category,
      tags: params.tags,
      search_mode: params.search_mode,
      min_similarity: params.min_similarity,
      limit: params.limit
    })

    let embeddingArray = getCachedEmbedding(cacheKey)

    if (!embeddingArray) {
      embeddingArray = await embed(params.query)
      setCachedEmbedding(cacheKey, embeddingArray)
    }

    // pgvector требует строку вида: "[0.1,0.2,...]"
    const embedding = `[${embeddingArray.join(",")}]`

    const res = await query<MemoryRetrieveResult>(`
  SELECT
    id,
    key,
    value,
    category,
    tags,
    1 - (embedding <=> $1::vector) AS similarity_score,
    created_at,
    updated_at
  FROM memory_vectors
  WHERE
    1 - (embedding <=> $1::vector) >= $2
    AND ($3::text IS NULL OR category = $3)
  ORDER BY embedding <=> $1::vector
  LIMIT $4
`, [
  embedding,
  params.min_similarity,
  params.category,
  params.limit
])


    results = res.rows
  }

  /* =========================
     KEYWORD SEARCH
     ========================= */
  if (params.search_mode !== "vector_only") {
    const res = await query<MemoryRetrieveResult>(`
      SELECT
        id,
        key,
        value,
        category,
        tags,
        0.3 AS similarity_score,
        created_at,
        updated_at
      FROM memory_vectors
      WHERE
        ($1::text IS NULL OR category = $1)
        AND (
          to_tsvector('english', value)
            @@ plainto_tsquery('english', $2)
          OR ($3::text[] IS NOT NULL AND tags && $3)
        )
      LIMIT $4
    `, [
      params.category,
      params.query,
      params.tags,
      params.limit
    ])

    results = mergeResults(results, res.rows)
  }

  results.sort((a, b) => b.similarity_score - a.similarity_score)

  return { results }
}

/* =========================
   HYBRID MERGE (0.7 / 0.3)
   ========================= */
function mergeResults(
  a: MemoryRetrieveResult[],
  b: MemoryRetrieveResult[]
): MemoryRetrieveResult[] {
  const map = new Map<string, MemoryRetrieveResult>()

  for (const r of a) {
    map.set(r.id, r)
  }

  for (const r of b) {
    const existing = map.get(r.id)
    if (!existing) {
      map.set(r.id, r)
    } else {
      existing.similarity_score =
        existing.similarity_score * 0.7 + r.similarity_score * 0.3
    }
  }

  return Array.from(map.values())
}
