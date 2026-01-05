import { query } from "./db.js"
import { embed } from "./embeddings.js"
import {
  getCachedEmbedding,
  setCachedEmbedding
} from "./embeddings-cache.js"
import fs from "node:fs/promises"
import path from "node:path"

interface MemoryStoreParams {
  key: string
  value: string
  category?: string
  tags?: string[]
}

const AUDIT_LOG = path.resolve(".mcp/audit.log")

async function logAudit(message: string) {
  await fs.mkdir(path.dirname(AUDIT_LOG), { recursive: true })
  await fs.appendFile(
    AUDIT_LOG,
    `[${new Date().toISOString()}] ${message}\n`
  )
}

export async function memoryStore(params: MemoryStoreParams): Promise<{ id: string }> {
  try {
    /* =========================
       1. Получение embedding
       ========================= */
    let embedding = getCachedEmbedding(params.value)

    if (!embedding) {
      embedding = await embed(params.value)
      setCachedEmbedding(params.value, embedding)
    }

    // pgvector принимает строку вида "[1,2,3]"
    const embeddingVector = `[${embedding.join(",")}]`

    /* =========================
       2. UPSERT в БД
       ========================= */
    const res = await query<{ id: string }>(`
      INSERT INTO memory_vectors (key, value, embedding, category, tags)
      VALUES ($1, $2, $3::vector, $4, $5)
      ON CONFLICT (key) DO UPDATE
      SET
        value = EXCLUDED.value,
        embedding = EXCLUDED.embedding,
        category = EXCLUDED.category,
        tags = EXCLUDED.tags,
        updated_at = now()
      RETURNING id
    `, [
      params.key,
      params.value,
      embeddingVector,
      params.category ?? null,
      params.tags ?? null
    ])

    await logAudit(
      `memory_store key=${params.key} category=${params.category ?? "-"}`
    )

    return { id: res.rows[0].id }

  } catch (err: any) {
    await logAudit(
      `memory_store ERROR key=${params.key} message=${err.message}`
    )

    if (err.message?.includes("ECONNREFUSED")) {
      throw new Error(
        "Database unavailable. Please retry later."
      )
    }

    throw new Error(
      "Embedding service unavailable or internal error."
    )
  }
}
