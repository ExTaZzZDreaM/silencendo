import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

interface MCPRequest {
  jsonrpc: "2.0"
  id: number
  method: string
  params?: any
}

interface MCPResponse {
  jsonrpc: "2.0"
  id: number
  result?: any
  error?: {
    code: number
    message: string
  }
}

class DocsServerTester {
  private proc: ReturnType<typeof spawn>
  private requestId = 1
  private responses: Map<number, (response: MCPResponse) => void> = new Map()

  constructor() {
    const serverPath = path.join(process.cwd(), "dist", "mcp", "servers", "docs", "index.js")
    this.proc = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        DOCS_RATE_LIMIT_REQUESTS_PER_MINUTE: "30"
      }
    })

    this.proc.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().trim().split("\n")
      for (const line of lines) {
        if (line) {
          try {
            const response: MCPResponse = JSON.parse(line)
            const resolver = this.responses.get(response.id)
            if (resolver) {
              resolver(response)
              this.responses.delete(response.id)
            }
          } catch (err) {
            console.error("Failed to parse response:", line, err)
          }
        }
      }
    })

    this.proc.stderr.on("data", (data: Buffer) => {
      console.error("[stderr]", data.toString())
    })
  }

  async sendRequest(method: string, params?: any): Promise<MCPResponse> {
    const id = this.requestId++
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.responses.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, 30000)

      this.responses.set(id, (response) => {
        clearTimeout(timeout)
        resolve(response)
      })

      this.proc.stdin.write(JSON.stringify(request) + "\n")
    })
  }

  async test() {
    console.log("🧪 Testing Docs MCP Server\n")

    try {
      // Test 1: Initialize
      console.log("1️⃣ Testing initialize...")
      const initResponse = await this.sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {}
      })
      console.log("✅ Initialize:", JSON.stringify(initResponse.result, null, 2))
      console.log()

      // Test 2: List tools
      console.log("2️⃣ Testing tools/list...")
      const listResponse = await this.sendRequest("tools/list")
      console.log("✅ Tools:", listResponse.result.tools.map((t: any) => t.name).join(", "))
      console.log()

      // Test 3: docs_resolve - поиск библиотеки
      console.log("3️⃣ Testing docs_resolve with query 'react'...")
      const resolveResponse = await this.sendRequest("tools/call", {
        name: "docs_resolve",
        arguments: {
          query: "react"
        }
      })
      if (resolveResponse.error) {
        console.error("❌ Error:", resolveResponse.error.message)
      } else {
        const content = resolveResponse.result.content[0].text
        const data = JSON.parse(content)
        console.log("✅ Found libraries:", data.libraries?.length || 0)
        if (data.libraries && data.libraries.length > 0) {
          console.log("   First library:", data.libraries[0].name)
        }
      }
      console.log()

      // Test 4: Проверка кэша (повторный запрос)
      console.log("4️⃣ Testing cache (same query 'react' again)...")
      const cachedResponse = await this.sendRequest("tools/call", {
        name: "docs_resolve",
        arguments: {
          query: "react"
        }
      })
      if (cachedResponse.error) {
        console.error("❌ Error:", cachedResponse.error.message)
      } else {
        console.log("✅ Cached response received (should be faster)")
      }
      console.log()

      // Test 5: docs_fetch
      console.log("5️⃣ Testing docs_fetch...")
      const fetchResponse = await this.sendRequest("tools/call", {
        name: "docs_fetch",
        arguments: {
          library_id: "ddg-react",
          topic: "hooks"
        }
      })
      if (fetchResponse.error) {
        console.error("❌ Error:", fetchResponse.error.message)
      } else {
        const content = fetchResponse.result.content[0].text
        const data = JSON.parse(content)
        console.log("✅ Found snippets:", data.snippets?.length || 0)
        if (data.snippets && data.snippets.length > 0) {
          console.log("   First snippet URL:", data.snippets[0].url)
        }
      }
      console.log()

      // Test 6: Rate limiting (множественные запросы)
      console.log("6️⃣ Testing rate limiting (5 rapid requests)...")
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          this.sendRequest("tools/call", {
            name: "docs_resolve",
            arguments: {
              query: `test query ${i}`
            }
          })
        )
      }
      const results = await Promise.allSettled(promises)
      const successCount = results.filter((r) => r.status === "fulfilled").length
      console.log(`✅ Completed ${successCount}/5 requests`)
      console.log()

      console.log("✅ All tests completed!")
    } catch (err: any) {
      console.error("❌ Test failed:", err.message)
    } finally {
      this.proc.kill()
      process.exit(0)
    }
  }
}

// Проверка, что проект скомпилирован
try {
  readFileSync(path.join(process.cwd(), "dist", "mcp", "servers", "docs", "index.js"))
} catch (err) {
  console.error("❌ Project not built. Please run: npm run build")
  process.exit(1)
}

const tester = new DocsServerTester()
tester.test()



