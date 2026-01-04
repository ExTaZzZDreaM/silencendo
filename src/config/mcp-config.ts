import { readFileSync } from "node:fs"
import { parse } from "yaml"
import path from "node:path"

export interface DocsConfig {
  rate_limits?: {
    duckduckgo?: {
      requests_per_minute?: number
    }
  }
}

export interface MCPConfig {
  docs?: DocsConfig
}

export function loadConfig(): MCPConfig {
  try {
    const configPath = path.join(process.cwd(), "mcp-config.yaml")
    const content = readFileSync(configPath, "utf8")
    return parse(content) as MCPConfig
  } catch (err) {
    // Return default config if file doesn't exist
    return {}
  }
}

