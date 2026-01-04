import axios from "axios";
import { DocsCache } from "./sandbox.js";
const cache = new DocsCache();
// Load rate limit from environment or use default
const maxRequestsPerMinute = parseInt(process.env.DOCS_RATE_LIMIT_REQUESTS_PER_MINUTE || "30", 10);
const rateLimiter = {
    requests: [],
    maxRequests: maxRequestsPerMinute,
    windowMs: 60000 // 1 minute
};
function checkRateLimit() {
    const now = Date.now();
    // Remove requests outside the time window
    rateLimiter.requests = rateLimiter.requests.filter((time) => now - time < rateLimiter.windowMs);
    if (rateLimiter.requests.length >= rateLimiter.maxRequests) {
        return false;
    }
    rateLimiter.requests.push(now);
    return true;
}
async function searchDuckDuckGo(query) {
    if (!checkRateLimit()) {
        throw new Error("Rate limit exceeded. Please try again later.");
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
    });
    const data = response.data;
    return {
        abstract: data.AbstractText || undefined,
        definition: data.Definition || undefined,
        related_topics: data.RelatedTopics || undefined,
        results: (data.Results || []).map((r) => ({
            title: r.Text || "",
            url: r.FirstURL || "",
            snippet: r.Result || ""
        }))
    };
}
async function getCachedOrFetch(query) {
    // 1. Check cache
    const cached = cache.get(query);
    if (cached) {
        return cached;
    }
    // 2. If not cached - fetch from DuckDuckGo
    const results = await searchDuckDuckGo(query);
    // 3. Save to cache (24h TTL)
    cache.set(query, results, 86400000);
    return results;
}
process.stdin.on("data", async (chunk) => {
    const input = chunk.toString("utf8").trim();
    if (!input)
        return;
    for (const line of input.split("\n")) {
        const msg = JSON.parse(line);
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
                });
            }
            if (msg.method === "tools/list") {
                respond(msg.id, {
                    tools: [
                        {
                            name: "docs_resolve",
                            description: "Find library/resource by query, get id, name and description",
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
                            description: "Get snippet and link to documentation by library_id and topic",
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
                                    }
                                },
                                required: ["library_id", "topic"]
                            }
                        }
                    ]
                });
            }
            if (msg.method === "tools/call") {
                const { name, arguments: args } = msg.params;
                if (name === "docs_resolve") {
                    const query = args.query;
                    const results = await getCachedOrFetch(query);
                    // Format response for docs_resolve
                    const libraries = [];
                    if (results.abstract) {
                        libraries.push({
                            id: `ddg-${cache.hashQuery(query)}`,
                            name: query,
                            description: results.abstract
                        });
                    }
                    if (results.results && results.results.length > 0) {
                        results.results.forEach((result, idx) => {
                            libraries.push({
                                id: `ddg-result-${idx}`,
                                name: result.title,
                                description: result.snippet
                            });
                        });
                    }
                    respond(msg.id, {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ libraries }, null, 2)
                            }
                        ]
                    });
                }
                if (name === "docs_fetch") {
                    const libraryId = args.library_id;
                    const topic = args.topic;
                    const query = `${libraryId} ${topic}`.replace(/^ddg-/, "");
                    const results = await getCachedOrFetch(query);
                    // Format response for docs_fetch
                    const snippets = [];
                    if (results.abstract) {
                        snippets.push({
                            snippet: results.abstract,
                            url: results.results?.[0]?.url || ""
                        });
                    }
                    if (results.results) {
                        results.results.forEach((result) => {
                            snippets.push({
                                snippet: result.snippet,
                                url: result.url
                            });
                        });
                    }
                    respond(msg.id, {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({ snippets }, null, 2)
                            }
                        ]
                    });
                }
            }
        }
        catch (err) {
            respondError(msg.id, err.message);
        }
    }
});
function respond(id, result) {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function respondError(id, message) {
    process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: {
            code: -32000,
            message
        }
    }) + "\n");
}
// Cleanup on exit
process.on("exit", () => {
    cache.close();
});
process.on("SIGINT", () => {
    cache.close();
    process.exit(0);
});
