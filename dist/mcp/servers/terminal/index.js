import { spawn } from "node:child_process";
import { validateCommand, resolveWorkingDir, DockerSandbox, detectImage, getInterpreterImage } from "./sandbox.js";
import { checkDockerAvailability } from "../../../utils/dockerCheck.js";
import { logAudit } from "../../../utils/audit.js";
const MAX_OUTPUT = 1024 * 1024; // 1 MB
const DEFAULT_TIMEOUT = 30_000; // 30s
// Проверка Docker при старте сервера
let dockerAvailable = false;
let dockerSandbox = null;
checkDockerAvailability().then((result) => {
    dockerAvailable = result.available;
    if (dockerAvailable) {
        dockerSandbox = new DockerSandbox();
        console.log('[terminal] Docker sandbox enabled');
    }
    else {
        console.warn('[terminal] Docker unavailable - using whitelist mode');
    }
});
process.stdin.on("data", async (chunk) => {
    const input = chunk.toString("utf8").trim();
    if (!input)
        return;
    for (const line of input.split("\n")) {
        const msg = JSON.parse(line);
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
                });
            }
            if (msg.method === "tools/list") {
                respond(msg.id, {
                    tools: [
                        {
                            name: "run_command",
                            description: "Run shell command in Docker sandbox",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    command: { type: "string" },
                                    working_dir: { type: "string" },
                                    timeout: { type: "number" },
                                    env: { type: "object" },
                                    sandbox: { type: "boolean" }
                                },
                                required: ["command"]
                            }
                        },
                        {
                            name: "run_script",
                            description: "Run script in Docker sandbox",
                            inputSchema: {
                                type: "object",
                                properties: {
                                    interpreter: {
                                        type: "string",
                                        enum: ["bash", "python", "node", "go", "sh"]
                                    },
                                    script: { type: "string" },
                                    args: {
                                        type: "array",
                                        items: { type: "string" }
                                    },
                                    working_dir: { type: "string" },
                                    timeout: { type: "number" },
                                    env: { type: "object" },
                                    sandbox: { type: "boolean" }
                                },
                                required: ["interpreter", "script"]
                            }
                        }
                    ]
                });
            }
            if (msg.method === "tools/call") {
                const { name, arguments: args } = msg.params;
                if (name === "run_command") {
                    const startTime = Date.now();
                    const useSandbox = args.sandbox !== false && dockerAvailable;
                    if (useSandbox && dockerSandbox) {
                        // Docker Sandbox режим
                        try {
                            const result = await dockerSandbox.runCommand({
                                command: args.command,
                                working_dir: args.working_dir,
                                timeout: args.timeout,
                                env: args.env,
                                sandbox: true
                            });
                            // Аудит
                            const workingDir = resolveWorkingDir(args.working_dir);
                            const image = detectImage(workingDir);
                            logAudit({
                                timestamp: new Date().toISOString(),
                                tool: 'run_command',
                                command: args.command,
                                image: image,
                                exit_code: result.exit_code,
                                duration_ms: result.duration_ms,
                                container_id: result.container_id
                            });
                            respond(msg.id, {
                                content: [
                                    {
                                        type: "text",
                                        text: `exit code: ${result.exit_code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}\n\ncontainer_id: ${result.container_id}\nduration: ${result.duration_ms}ms`
                                    }
                                ]
                            });
                        }
                        catch (error) {
                            logAudit({
                                timestamp: new Date().toISOString(),
                                tool: 'run_command',
                                command: args.command,
                                exit_code: -1,
                                duration_ms: Date.now() - startTime,
                                error: error.message
                            });
                            respondError(msg.id, error.message);
                        }
                    }
                    else {
                        // Fallback: Whitelist режим (без Docker)
                        try {
                            validateCommand(args.command);
                            const cwd = resolveWorkingDir(args.working_dir);
                            const timeout = args.timeout ?? DEFAULT_TIMEOUT;
                            const [bin, ...cmdArgs] = args.command.split(" ");
                            const proc = spawn(bin, cmdArgs, { cwd });
                            let stdout = "";
                            let stderr = "";
                            const timer = setTimeout(() => {
                                proc.kill();
                            }, timeout);
                            proc.stdout.on("data", (d) => {
                                stdout += d.toString();
                                if (stdout.length > MAX_OUTPUT)
                                    proc.kill();
                            });
                            proc.stderr.on("data", (d) => {
                                stderr += d.toString();
                                if (stderr.length > MAX_OUTPUT)
                                    proc.kill();
                            });
                            proc.on("close", (code) => {
                                clearTimeout(timer);
                                logAudit({
                                    timestamp: new Date().toISOString(),
                                    tool: 'run_command',
                                    command: args.command,
                                    exit_code: code ?? -1,
                                    duration_ms: Date.now() - startTime
                                });
                                respond(msg.id, {
                                    content: [
                                        {
                                            type: "text",
                                            text: `⚠️ UNSAFE MODE (no Docker)\nexit code: ${code}\n${stdout}${stderr}`
                                        }
                                    ]
                                });
                            });
                        }
                        catch (error) {
                            logAudit({
                                timestamp: new Date().toISOString(),
                                tool: 'run_command',
                                command: args.command,
                                exit_code: -1,
                                duration_ms: Date.now() - startTime,
                                error: error.message
                            });
                            respondError(msg.id, error.message);
                        }
                    }
                }
                if (name === "run_script") {
                    const startTime = Date.now();
                    const useSandbox = args.sandbox !== false && dockerAvailable;
                    if (useSandbox && dockerSandbox) {
                        // Docker Sandbox режим
                        try {
                            const result = await dockerSandbox.runScript({
                                interpreter: args.interpreter,
                                script: args.script,
                                args: args.args,
                                working_dir: args.working_dir,
                                timeout: args.timeout,
                                env: args.env,
                                sandbox: true
                            });
                            const image = getInterpreterImage(args.interpreter);
                            logAudit({
                                timestamp: new Date().toISOString(),
                                tool: 'run_script',
                                command: `${args.interpreter} script (${args.script.length} chars)`,
                                image: image,
                                exit_code: result.exit_code,
                                duration_ms: result.duration_ms,
                                container_id: result.container_id
                            });
                            respond(msg.id, {
                                content: [
                                    {
                                        type: "text",
                                        text: `exit code: ${result.exit_code}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}\n\ncontainer_id: ${result.container_id}\nduration: ${result.duration_ms}ms`
                                    }
                                ]
                            });
                        }
                        catch (error) {
                            logAudit({
                                timestamp: new Date().toISOString(),
                                tool: 'run_script',
                                command: `${args.interpreter} script`,
                                exit_code: -1,
                                duration_ms: Date.now() - startTime,
                                error: error.message
                            });
                            respondError(msg.id, error.message);
                        }
                    }
                    else {
                        respondError(msg.id, "run_script requires Docker sandbox mode");
                    }
                }
            }
        }
        catch (err) {
            respondError(msg.id, err.message);
        }
    }
});
function respond(id, result) {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function respondError(id, message) {
    process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32001, message }
    }) + "\n");
}
