import { spawn } from "node:child_process"
import { validateCommand, resolveWorkingDir } from "./sandbox.js"

const MAX_OUTPUT = 1024 * 1024 // 1 MB
const DEFAULT_TIMEOUT = 30_000 // 30s

process.stdin.on("data", async (chunk: Buffer) => {
  const input = chunk.toString("utf8").trim()
  if (!input) return

  for (const line of input.split("\n")) {
    const msg = JSON.parse(line)

    try {
      if (msg.method === "initialize") {
        respond(msg.id, {
          capabilities: {
            tools: { listChanged: true }
          },
          serverInfo: {
            name: "terminal",
            version: "1.0.0"
          }
        })
      }

      if (msg.method === "tools/list") {
        respond(msg.id, {
          tools: [
            {
              name: "run_command",
              description: "Run shell command",
              inputSchema: {
                type: "object",
                properties: {
                  command: { type: "string" },
                  working_dir: { type: "string" },
                  timeout: { type: "number" }
                },
                required: ["command"]
              }
            }
          ]
        })
      }

      if (msg.method === "tools/call") {
        const { name, arguments: args } = msg.params

        if (name === "run_command") {
          validateCommand(args.command)

          const cwd = resolveWorkingDir(args.working_dir)
          const timeout = args.timeout ?? DEFAULT_TIMEOUT

          const [bin, ...cmdArgs] = args.command.split(" ")

          const proc = spawn(bin, cmdArgs, { cwd })

          let stdout = ""
          let stderr = ""

          const timer = setTimeout(() => {
            proc.kill()
          }, timeout)

          proc.stdout.on("data", (d) => {
            stdout += d.toString()
            if (stdout.length > MAX_OUTPUT) proc.kill()
          })

          proc.stderr.on("data", (d) => {
            stderr += d.toString()
            if (stderr.length > MAX_OUTPUT) proc.kill()
          })

          proc.on("close", (code) => {
            clearTimeout(timer)

            respond(msg.id, {
              content: [
                {
                  type: "text",
                  text: `exit code: ${code}\n${stdout}${stderr}`
                }
              ]
            })
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
      error: { code: -32001, message }
    }) + "\n"
  )
}
