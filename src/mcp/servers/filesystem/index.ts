import fs from "node:fs/promises"
import { resolveSafePath } from "./sandbox.js"

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
      name: "filesystem",
      version: "1.0.0"
    }
  })
}

      if (msg.method === "tools/list") {
        respond(msg.id, {
          tools: [
            {
              name: "read_file",
              description: "Read file",
              inputSchema: {
                type: "object",
                properties: {
                  path: { type: "string" }
                },
                required: ["path"]
              }
            },
            {
              name: "write_file",
              description: "Write file",
              inputSchema: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  content: { type: "string" }
                },
                required: ["path", "content"]
              }
            }
          ]
        })
      }

      if (msg.method === "tools/call") {
        const { name, arguments: args } = msg.params

        if (name === "read_file") {
          const filePath = resolveSafePath(args.path)
          const content = await fs.readFile(filePath, "utf8")
          respond(msg.id, {
            content: [{ type: "text", text: content }]
          })
        }

        if (name === "write_file") {
          const filePath = resolveSafePath(args.path)
          await fs.writeFile(filePath, args.content, "utf8")
          respond(msg.id, {
            content: [{ type: "text", text: "OK" }]
          })
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
