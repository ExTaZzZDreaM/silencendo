import { memoryStore } from "./store.js"
import { memoryRetrieve } from "./retrieve.js"

let buffer = ""

process.stdin.on("data", async (chunk) => {
  buffer += chunk.toString("utf8")

  let newlineIndex
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim()
    buffer = buffer.slice(newlineIndex + 1)

    if (!line) continue

    let msg: any
    try {
      msg = JSON.parse(line)
    } catch (err) {
      console.error("Invalid JSON:", line)
      continue
    }

    await handleMessage(msg)
  }
})

async function handleMessage(msg: any) {
  if (msg.method === "initialize") {
    respond(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: true
        }
      },
      serverInfo: {
        name: "memory",
        version: "2.0.0"
      }
    })
    return
  }

  if (msg.method === "tools/list") {
    respond(msg.id, {
      tools: [
        {
          name: "memory_store",
          description: "Store data in vector memory",
          inputSchema: {
            type: "object",
            properties: {
              key: { type: "string" },
              value: { type: "string" },
              category: { type: "string" },
              tags: {
                type: "array",
                items: { type: "string" }
              },
              shared: { type: "boolean" }
            },
            required: ["key", "value"]
          }
        },
        {
          name: "memory_retrieve",
          description: "Semantic memory search (v2)",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              category: { type: "string" },
              tags: {
                type: "array",
                items: { type: "string" }
              },
              limit: { type: "number" },
              min_similarity: { type: "number" },
              search_mode: {
                type: "string",
                enum: ["hybrid", "vector_only", "keyword_only"]
              }
            },
            required: ["query"]
          }
        }
      ]
    })
    return
  }

  if (msg.method === "tools/call") {
    const { name, arguments: args } = msg.params

    if (name === "memory_store") {
      respond(msg.id, await memoryStore(args))
      return
    }

    if (name === "memory_retrieve") {
      respond(msg.id, await memoryRetrieve(args))
      return
    }
  }
}

function respond(id: number, result: unknown) {
  process.stdout.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      result
    }) + "\n"
  )
}
