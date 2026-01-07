import { unifiedSearch, type UnifiedSearchParams, type UnifiedSearchResult } from "../../../unified-search/manager.js"
import fs from "node:fs/promises"
import { localSearch } from "./localSearch.js"
import { resolveWithinRoot } from "./sandbox.js"

const DEFAULT_LIMIT = 10

const CODE_EXTS = new Set([
  ".ts",".tsx",".js",".jsx",".mjs",".cjs",".py",".go",".java",".cs",".cpp",".c",".h",".hpp",".rs",".rb",".php",".kt",".swift",
  ".json",".yaml",".yml"
])
const DOC_EXTS = new Set([".md", ".txt", ".adoc", ".rst"])
const LOG_EXTS = new Set([".log", ".txt"])

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date format")
  return d
}

function coerceParams(args: unknown): UnifiedSearchParams {
  if (!args || typeof args !== "object") throw new Error("Invalid arguments")
  const a = args as Record<string, unknown>
  if (typeof a.query !== "string") throw new Error("Missing query")

  const scope = a.scope
  if (
    scope !== undefined &&
    scope !== "all" &&
    scope !== "code" &&
    scope !== "docs" &&
    scope !== "memory" &&
    scope !== "logs"
  ) throw new Error("Invalid scope")

  const limit = typeof a.limit === "number" ? a.limit : DEFAULT_LIMIT
  const include_scores = typeof a.include_scores === "boolean" ? a.include_scores : true

  const filtersRaw = a.filters
  const filters = filtersRaw && typeof filtersRaw === "object" ? (filtersRaw as Record<string, unknown>) : undefined

  return {
    query: a.query,
    scope: scope as UnifiedSearchParams["scope"],
    limit,
    include_scores,
    filters: {
      file_pattern: typeof filters?.file_pattern === "string" ? filters.file_pattern : undefined,
      category: typeof filters?.category === "string" ? filters.category : undefined,
      date_from: typeof filters?.date_from === "string" ? filters.date_from : undefined,
      date_to: typeof filters?.date_to === "string" ? filters.date_to : undefined
    }
  }
}

function respond(id: number, result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n")
}

function respondError(id: number, message: string) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32010, message } }) + "\n")
}

process.stdin.on("data", async (chunk) => {
  const input = chunk.toString("utf8").trim()
  if (!input) return

  for (const line of input.split("\n")) {
    const msg = JSON.parse(line)
    try {
      if (msg.method === "initialize") {
        respond(msg.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: "search", version: "1.0.0" }
        })
        continue
      }

      if (msg.method === "tools/list") {
        respond(msg.id, {
          tools: [
            {
              name: "unified_search",
              description: "Search across code, memory, docs, and logs with unified ranking",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  scope: { type: "string", enum: ["all", "code", "docs", "memory", "logs"] },
                  limit: { type: "number", default: 10 },
                  include_scores: { type: "boolean", default: true },
                  filters: { type: "object" }
                },
                required: ["query"]
              }
            }
          ]
        })
        continue
      }

      if (msg.method === "tools/call") {
        const { name, arguments: args } = msg.params
        if (name !== "unified_search") throw new Error("Unknown tool")

        const params = coerceParams(args)
        const dateFrom = parseDate(params.filters?.date_from)
        const dateTo = parseDate(params.filters?.date_to)

        const providers = {
          code: async (query: string, filters?: UnifiedSearchParams["filters"]) => {
            const matches = await localSearch(query, {
              includeExtensions: CODE_EXTS,
              filePattern: filters?.file_pattern,
              dateFrom, dateTo
            })
            return matches.map((m) => ({
              type: "code" as const,
              location: m.location,
              score: m.score,
              snippet: m.snippet,
              source: "local",
              metadata: m.metadata
            }))
          },

          memory: async (_query: string) => {
            // Placeholder: memory MCP будет подключён в основном стекe IDE
            return []
          },

          docs: async (query: string, filters?: UnifiedSearchParams["filters"]) => {
            const matches = await localSearch(query, {
              includeExtensions: DOC_EXTS,
              filePattern: filters?.file_pattern,
              dateFrom, dateTo
            })
            return matches.map((m) => ({
              type: "docs" as const,
              location: m.location,
              score: m.score,
              snippet: m.snippet,
              source: "local",
              metadata: m.metadata
            }))
          },

          logs: async (query: string, filters?: UnifiedSearchParams["filters"]) => {
            const logsDir = resolveWithinRoot("logs")
            try {
              const st = await fs.stat(logsDir)
              if (!st.isDirectory()) return []
            } catch {
              return []
            }

            const matches = await localSearch(query, {
              includeExtensions: LOG_EXTS,
              startDirRel: "logs",
              filePattern: filters?.file_pattern,
              dateFrom, dateTo,
              maxFiles: 300
            })
            return matches.map((m) => ({
              type: "logs" as const,
              location: m.location,
              score: m.score,
              snippet: m.snippet,
              source: "local",
              metadata: m.metadata
            }))
          }
        }

        const results: UnifiedSearchResult = await unifiedSearch(params, providers)

        respond(msg.id, {
          content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
        })
        continue
      }
    } catch (err) {
      respondError(msg.id, err instanceof Error ? err.message : "Unknown error")
    }
  }
})
