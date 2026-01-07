import { readFileSync } from "node:fs";
import { parse } from "yaml";
import path from "node:path";
export function loadConfig() {
    try {
        const configPath = path.join(process.cwd(), "mcp-config.yaml");
        const content = readFileSync(configPath, "utf8");
        return parse(content);
    }
    catch (err) {
        // Return default config if file doesn't exist
        return {};
    }
}
