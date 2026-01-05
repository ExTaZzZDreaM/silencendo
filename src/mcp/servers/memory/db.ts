import "dotenv/config"
import pg from "pg"

const { Pool } = pg

if (!process.env.MEMORY_DB_URL) {
  throw new Error("MEMORY_DB_URL is not set")
}

export const pool = new Pool({
  connectionString: process.env.MEMORY_DB_URL
})

export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<{
  rows: T[]
  rowCount: number
  duration: number
}> {
  const start = Date.now()
  const res = await pool.query(sql, params)

  return {
    rows: res.rows as T[],
    rowCount: res.rowCount ?? 0,
    duration: Date.now() - start
  }
}
