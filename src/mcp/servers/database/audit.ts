import fs from "fs"
import path from "path"

const LOG_PATH = ".mcp/audit.log"
const MAX_SIZE_MB = 10

export function auditLog(
  user: string,
  query: string,
  duration: number,
  rows: number
) {
  if (!fs.existsSync(".mcp")) fs.mkdirSync(".mcp")

  const line = `[${new Date().toISOString()}] [${user}] [${query}] [${duration}ms] [${rows}]\n`

  fs.appendFileSync(LOG_PATH, line)

  const stats = fs.statSync(LOG_PATH)
  if (stats.size > MAX_SIZE_MB * 1024 * 1024) {
    fs.renameSync(LOG_PATH, `${LOG_PATH}.${Date.now()}`)
  }
}
