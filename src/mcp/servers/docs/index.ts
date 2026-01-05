import axios from "axios"
import { DocsCache, DocsSearchResult } from "./sandbox.js"

const cache = new DocsCache()

// Rate limiting
interface RateLimiter {
  requests: number[]
  maxRequests: number
  windowMs: number
}

// Load rate limit from environment or use default
const maxRequestsPerMinute = parseInt(
  process.env.DOCS_RATE_LIMIT_REQUESTS_PER_MINUTE || "30",
  10
)

const rateLimiter: RateLimiter = {
  requests: [],
  maxRequests: maxRequestsPerMinute,
  windowMs: 60000 // 1 minute
}

function checkRateLimit(): boolean {
  const now = Date.now()
  // Remove requests outside the time window
  rateLimiter.requests = rateLimiter.requests.filter(
    (time) => now - time < rateLimiter.windowMs
  )

  if (rateLimiter.requests.length >= rateLimiter.maxRequests) {
    return false
  }

  rateLimiter.requests.push(now)
  return true
}

async function searchDuckDuckGo(query: string): Promise<DocsSearchResult> {
  if (!checkRateLimit()) {
    throw new Error("Rate limit exceeded. Please try again later.")
  }

  const response = await axios.get("https://api.duckduckgo.com/", {
    params: {
      q: query,
      format: "json",
      no_redirect: 1,
      no_html: 1,
      t: "mcp-server",
      skip_disambig: 1
    }
  })

  const data = response.data

  return {
    abstract: data.AbstractText || undefined,
    definition: data.Definition || undefined,
    related_topics: data.RelatedTopics || undefined,
    results: (data.Results || []).map((r: any) => ({
      title: r.Text || "",
      url: r.FirstURL || "",
      snippet: r.Result || ""
    }))
  }
}

async function getCachedOrFetch(query: string): Promise<DocsSearchResult> {
 // 1. Check cache
  const cached = cache.get(query)
  if (cached && typeof cached === 'object' && 
      ('abstract' in cached || 'definition' in cached || 'results' in cached)) {
    // This is a DocsSearchResult
    return cached as DocsSearchResult;
  }

  // 2. If not cached - fetch from DuckDuckGo
  const results = await searchDuckDuckGo(query)

  // 3. Save to cache (24h TTL)
 cache.set(query, results, 86400000)

  return results
}

// Helper functions
function generateLibraryId(query: string): string {
  return `ddg-${cache.hashQuery(query)}`;
}

function extractLibraryName(abstract: string): string {
  // Extract library name from abstract - look for common patterns
  const patterns = [
    /^([a-zA-Z0-9_-]+):?\s/,  // library: description
    /^([a-zA-Z0-9_-]+)\s/,     // library description
    /is a ([a-zA-Z0-9_-]+)/,   // "is a React" - extract React
  ];
  
  for (const pattern of patterns) {
    const match = abstract.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return abstract.split(' ')[0] || 'unknown';
}

function extractVersion(abstract: string | undefined): string | undefined {
  if (!abstract) return undefined;
  
  // Look for version patterns like v1.2.3, version 1.2.3, etc.
  const patterns = [
    /v?(\d+\.\d+\.\d+)/,
    /version\s+(\d+\.\d+\.\d+)/,
    /(\d+\.\d+\.\d+)/
  ];
  
 for (const pattern of patterns) {
    const match = abstract.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return undefined;
}

function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  return text.substring(0, maxLength) + '...';
}

// Cache for docs_fetch results
function checkFetchCache(libraryId: string, topic?: string): { content: string, url: string } | null {
  const cacheKey = `${libraryId}:${topic || ''}`;
  const result = cache.get(cacheKey);
  // Check if result is a DocsFetchResult (has content and url properties)
  if (result && typeof result === 'object' && 'content' in result && 'url' in result) {
    return result as { content: string, url: string };
  }
  return null;
}

function setFetchCache(libraryId: string, topic: string | undefined, content: string, url: string) {
  const cacheKey = `${libraryId}:${topic || ''}`;
  // Store in cache with libraryId, topic, content and url
  cache.set(cacheKey, { content, url }, 86400000); // 24h TTL
}

process.stdin.on("data", async (chunk: Buffer) => {
  const input = chunk.toString("utf8").trim()
  if (!input) return

  for (const line of input.split("\n")) {
    const msg = JSON.parse(line)

    try {
      if (msg.method === "initialize") {
        respond(msg.id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: true }
          },
          serverInfo: {
            name: "docs",
            version: "1.0.0"
          }
        })
      }

      if (msg.method === "tools/list") {
        respond(msg.id, {
          tools: [
            {
              name: "docs_resolve",
              description:
                "Find library/resource by query, get id, name and description",
              inputSchema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "Search query for library or resource"
                  }
                },
                required: ["query"]
              }
            },
            {
              name: "docs_fetch",
              description:
                "Get snippet and link to documentation by library_id and topic",
              inputSchema: {
                type: "object",
                properties: {
                  library_id: {
                    type: "string",
                    description: "Library identifier from docs_resolve"
                  },
                  topic: {
                    type: "string",
                    description: "Topic to search for in the library documentation"
                  },
                  tokens: {
                    type: "number",
                    description: "Maximum number of tokens for content truncation"
                  }
                },
                required: ["library_id", "topic"]
              }
            }
          ]
        })
      }

      if (msg.method === "tools/call") {
        const { name, arguments: args } = msg.params

        if (name === "docs_resolve") {
          const query = args.query as string;
          const results = await getCachedOrFetch(query);

          // Format response for docs_resolve according to new requirements
          const libraryName = results.abstract ? extractLibraryName(results.abstract) : query;
          const version = extractVersion(results.abstract);
          
          const libraries = [{
            id: generateLibraryId(query),
            name: libraryName,
            description: results.abstract || results.definition,
            source: "duckduckgo",
            version: version
          }];

          respond(msg.id, {
            content: [
              {
                type: "text",
                text: JSON.stringify({ results: libraries }, null, 2)
              }
            ]
          });
        }

        if (name === "docs_fetch") {
          const libraryId = args.library_id as string;
          const topic = args.topic as string;
          const tokens = (args.tokens as number) || 5000; // Default to 5000 tokens if not specified
          
          // 1. Check cache with library_id and topic
          const cached = checkFetchCache(libraryId, topic);
          if (cached) {
            // Return in the format expected by the test
            const responseContent = {
              snippets: [{
                snippet: cached.content,
                url: cached.url
              }]
            };
            
            respond(msg.id, {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(responseContent)
                }
              ]
            });
          } else {
            // 2. If not in cache - request from DuckDuckGo
            const query = topic ? `${libraryId} ${topic}` : libraryId;
            const results = await getCachedOrFetch(query);

            // 3. Extract snippet and URL
            const firstResult = results.results?.[0];
            if (firstResult) {
              const truncatedContent = truncate(firstResult.snippet, tokens);
              const version = extractVersion(results.abstract);

              // Cache the result
              setFetchCache(libraryId, topic, truncatedContent, firstResult.url);

              const responseContent = {
                snippets: [{
                  snippet: truncatedContent,
                  url: firstResult.url
                }]
              };
              
              respond(msg.id, {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(responseContent)
                  }
                ]
              });
            } else {
              // If no results found, return empty response
              respond(msg.id, {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ snippets: [] })
                  }
                ]
              });
            }
          }
        }
      }
    } catch (err: any) {
      respondError(msg.id, err.message)
    }
  }
})

function respond(id: number, result: unknown) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n"
  )
}

function respondError(id: number, message: string) {
  process.stdout.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message
      }
    }) + "\n"
  )
}

// Cleanup on exit
process.on("exit", () => {
  cache.close()
})

process.on("SIGINT", () => {
  cache.close()
  process.exit(0)
})
