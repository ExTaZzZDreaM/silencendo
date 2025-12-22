import path from "node:path";
const PROJECT_ROOT = path.resolve(process.cwd());
const ALLOWED_COMMANDS = new Set([
    "ls",
    "cat",
    "head",
    "tail",
    "grep",
    "find",
    "wc",
    "go",
    "npm",
    "npx",
    "node",
    "pnpm",
    "yarn",
    "git"
]);
export function validateCommand(command) {
    const [bin] = command.split(" ");
    if (!ALLOWED_COMMANDS.has(bin)) {
        throw new Error(`Command not allowed: ${bin}`);
    }
}
export function resolveWorkingDir(dir) {
    const resolved = path.resolve(PROJECT_ROOT, dir ?? ".");
    if (!resolved.startsWith(PROJECT_ROOT)) {
        throw new Error("Invalid working directory");
    }
    return resolved;
}
