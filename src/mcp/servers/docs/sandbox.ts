import Database from "better-sqlite3"
import { createHash } from "node:crypto"
import path from "node:path"
import os from "node:os"

export interface DocsSearchResult {
  abstract?: string
  definition?: string
  related_topics?: Array<{
    FirstURL?: string
    Text?: string
    Result?: string
  }>
  results?: Array<{
    title: string
    url: string
    snippet: string
  }>
}

export interface DocsFetchResult {
  content: string;
  url: string;
}

export class DocsCache {
  private db: Database.Database

  constructor() {
    const dbPath = path.join(os.tmpdir(), "silencendo-docs-cache.db")
    this.db = new Database(dbPath)
    this.initializeSchema()
  }

  private initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS docs_cache (
        query_hash TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        results TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        expires_at INTEGER
      )
    `)
    
    // Clean up expired entries periodically
    const now = Date.now()
    this.db.prepare("DELETE FROM docs_cache WHERE expires_at < ?").run(now)
  }

  hashQuery(query: string): string {
    return createHash("sha256").update(query.toLowerCase().trim()).digest("hex")
  }

  get(query: string): DocsSearchResult | DocsFetchResult | null {
    const queryHash = this.hashQuery(query)
    const now = Date.now()

    const row = this.db
      .prepare("SELECT * FROM docs_cache WHERE query_hash = ? AND expires_at > ?")
      .get(queryHash, now) as any

    if (row) {
      return JSON.parse(row.results)
    }

    return null
  }

  set(query: string, results: DocsSearchResult | DocsFetchResult, ttlMs: number = 864000) {
    const queryHash = this.hashQuery(query)
    const expiresAt = Date.now() + ttlMs

    this.db
      .prepare(
        "INSERT OR REPLACE INTO docs_cache (query_hash, query, results, expires_at) VALUES (?, ?, ?, ?)"
      )
      .run(queryHash, query, JSON.stringify(results), expiresAt)
  }

  close() {
    this.db.close()
  }
}
