import readline from "node:readline"
import { dbQuery, dbSchema, dbListTables } from "./tools.js"

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})

rl.on("line", async (line) => {
  if (!line.trim()) return

  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }

  try {
    if (msg.method === "initialize") {
      respond(msg.id, {
        capabilities: {
          tools: { listChanged: true },
        },
        serverInfo: {
          name: "database",
          version: "1.0.0",
        },
      })
      return
    }

    if (msg.method === "tools/list") {
      respond(msg.id, {
        tools: [
          { name: "db_query", description: "Execute SELECT query" },
          { name: "db_schema", description: "Get DB schema" },
          { name: "db_list_tables", description: "List tables" },
        ],
      })
      return
    }

    if (msg.method === "tools/call") {
      const { name, arguments: args } = msg.params

      if (name === "db_query") {
        respond(msg.id, await dbQuery(args.query))
      }

      if (name === "db_schema") {
        respond(msg.id, await dbSchema())
      }

      if (name === "db_list_tables") {
        respond(msg.id, await dbListTables())
      }
    }
  } catch (err: any) {
    respondError(msg.id, err.message)
  }
})

function respond(id: number, result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n")
}

function respondError(id: number, message: string) {
  process.stdout.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message },
    }) + "\n",
  )
}
