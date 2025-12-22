import { spawn } from "node:child_process";
export class MCPProcessManager {
    processes = new Map();
    startServer(cfg) {
        if (this.processes.has(cfg.name)) {
            throw new Error(`MCP server already running: ${cfg.name}`);
        }
        const proc = spawn(cfg.command, cfg.args ?? [], {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...cfg.env }
        });
        proc.stderr.on("data", (d) => {
            console.error(`[${cfg.name}][stderr]`, d.toString());
        });
        proc.on("exit", (code) => {
            console.warn(`[${cfg.name}] exited with code ${code}`);
            this.processes.delete(cfg.name);
        });
        this.processes.set(cfg.name, proc);
        return proc;
    }
    stopAll() {
        for (const [name, proc] of this.processes) {
            proc.kill();
            console.log(`Stopped MCP server: ${name}`);
        }
    }
}
