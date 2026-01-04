import { MCPProcessManager } from "./mcp/manager/processManager.js";
import { initializeMCP } from "./mcp/manager/mcpConnection.js";
import { checkDockerAvailability, printUnsafeModeWarning } from "./utils/dockerCheck.js";
const manager = new MCPProcessManager();
async function main() {
    // Check Docker availability for terminal sandbox
    console.log("Checking Docker availability...");
    const dockerCheck = await checkDockerAvailability();
    if (!dockerCheck.available) {
        printUnsafeModeWarning();
    }
    const servers = [
        {
            name: "filesystem",
            command: "node",
            args: ["./dist/mcp/servers/filesystem/index.js"]
        },
        {
            name: "terminal",
            command: "node",
            args: ["./dist/mcp/servers/terminal/index.js"]
        }
    ];
    for (const srv of servers) {
        try {
            const proc = manager.startServer(srv);
            await initializeMCP(proc, srv.name);
            console.log(`MCP server started: ${srv.name}`);
        }
        catch (err) {
            console.error(`Failed to start MCP server: ${srv.name}`, err);
        }
    }
    console.log("Silence AI started. All MCP servers ready.");
}
main().catch((err) => {
    console.error("Fatal startup error", err);
    process.exit(1);
});
process.on("SIGINT", () => {
    console.log("Shutting down MCP servers...");
    manager.stopAll();
    process.exit(0);
});
