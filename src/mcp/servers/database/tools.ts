import { pool } from "./db.js"
import { validateQuery } from "./security.js"
import { auditLog } from "./audit.js"

export async function dbQuery(query: string, user = "mcp") {
  const start = Date.now()

  validateQuery(query, {
    allow_mutations: false,
    blocked_keywords: ["DROP", "ALTER", "DELETE", "TRUNCATE"],
  })

  const result = await pool.query({
    text: query,
    rowMode: "array",
  })

  const duration = Date.now() - start
  auditLog(user, query, duration, result.rowCount ?? 0)

  return result.rows.slice(0, 1000)
}

export async function dbSchema() {
  const res = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `)
  return res.rows
}

export async function dbListTables() {
  const res = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
  `)
  return res.rows
}
