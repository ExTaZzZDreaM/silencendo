import path from "node:path";
import * as fs from 'fs';
import Docker from 'dockerode';
import { getConfig, parseLimits } from '../../../config/mcp-config.js';
const PROJECT_ROOT = path.resolve(process.cwd());
const docker = new Docker();
// Whitelist для fallback режима (когда Docker недоступен)
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
// Blacklist опасных паттернов
const DANGEROUS_PATTERNS = [
    /rm\s+-rf/,
    /\|\s*sh/,
    />\s*\/dev\/sd/,
    /mkfs/,
    /dd\s+if=/,
    /:\(\)\{[^}]*:\|:[^}]*&[^}]*\};:/, // fork bomb
    /curl.*\|\s*bash/,
    /wget.*\|\s*sh/,
    />.*\/etc\//, // запись в системные файлы
];
/**
 * Проверка команды по whitelist (для fallback режима)
 */
export function validateCommand(command) {
    const [bin] = command.split(" ");
    if (!ALLOWED_COMMANDS.has(bin)) {
        throw new Error(`Command not allowed: ${bin}`);
    }
}
/**
 * Проверка команды по blacklist опасных паттернов
 */
export function validateCommandSecurity(command) {
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
            throw new Error(`Blocked dangerous pattern: ${pattern.source}`);
        }
    }
}
export function resolveWorkingDir(dir) {
    const resolved = path.resolve(PROJECT_ROOT, dir ?? ".");
    if (!resolved.startsWith(PROJECT_ROOT)) {
        throw new Error("Invalid working directory");
    }
    return resolved;
}
/**
 * Определяет Docker образ по структуре проекта
 */
export function detectImage(workingDir) {
    const config = getConfig();
    const images = config.security.terminal.sandbox.docker_images;
    if (fs.existsSync(path.join(workingDir, 'go.mod'))) {
        return images.go;
    }
    if (fs.existsSync(path.join(workingDir, 'package.json'))) {
        return images.node;
    }
    if (fs.existsSync(path.join(workingDir, 'requirements.txt')) ||
        fs.existsSync(path.join(workingDir, 'pyproject.toml'))) {
        return images.python;
    }
    if (fs.existsSync(path.join(workingDir, 'Cargo.toml'))) {
        return images.rust;
    }
    return images.default;
}
/**
 * Выбирает Docker образ по интерпретатору
 */
export function getInterpreterImage(interpreter) {
    const config = getConfig();
    const images = config.security.terminal.sandbox.docker_images;
    const mapping = {
        'bash': images.default,
        'sh': images.default,
        'python': images.python,
        'node': images.node,
        'go': images.go
    };
    return mapping[interpreter] || images.default;
}
/**
 * Возвращает расширение файла для интерпретатора
 */
export function getScriptExtension(interpreter) {
    const mapping = {
        'bash': 'sh',
        'sh': 'sh',
        'python': 'py',
        'node': 'js',
        'go': 'go'
    };
    return mapping[interpreter] || 'txt';
}
/**
 * Docker Sandbox - выполнение команд в изолированных контейнерах
 */
export class DockerSandbox {
    config = getConfig();
    async runCommand(params) {
        const startTime = Date.now();
        // 1. Security Layer - pre-execution checks
        validateCommandSecurity(params.command);
        // 2. Выбор образа по технологии проекта
        const workingDir = resolveWorkingDir(params.working_dir);
        const image = detectImage(workingDir);
        // 3. Парсинг лимитов
        const limits = parseLimits(this.config.security.terminal.sandbox.limits);
        const timeout = params.timeout || limits.timeout;
        // 4. Создание контейнера
        const volumes = this.config.security.terminal.sandbox.volumes;
        const container = await docker.createContainer({
            Image: image,
            Cmd: ['/bin/sh', '-c', params.command],
            WorkingDir: volumes.project_root.container,
            Env: params.env ? Object.entries(params.env).map(([k, v]) => `${k}=${v}`) : [],
            HostConfig: {
                Binds: [
                    `${PROJECT_ROOT}:${volumes.project_root.container}:ro`,
                    `${volumes.temp.host}:${volumes.temp.container}:rw`
                ],
                Memory: limits.memory,
                CpuQuota: limits.cpuQuota,
                CpuPeriod: 100000,
                NetworkMode: this.config.security.terminal.sandbox.network.enabled ? 'bridge' : 'none',
                ReadonlyRootfs: false, // Some commands need to write to /tmp
                AutoRemove: false // We'll remove manually to ensure cleanup
            },
            AttachStdout: true,
            AttachStderr: true,
            Tty: false
        });
        let result;
        try {
            // 5. Запуск контейнера с timeout
            await container.start();
            const execPromise = container.wait();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Command timeout after ${timeout}ms`)), timeout);
            });
            const waitResult = await Promise.race([execPromise, timeoutPromise]);
            // 6. Получение output
            const logStream = await container.logs({
                stdout: true,
                stderr: true,
                timestamps: false
            });
            const logs = logStream.toString('utf8');
            const [stdout, stderr] = this.splitLogs(logs);
            result = {
                stdout: stdout.slice(0, limits.maxOutput),
                stderr: stderr.slice(0, limits.maxOutput),
                exit_code: waitResult.StatusCode,
                duration_ms: Date.now() - startTime,
                container_id: container.id
            };
        }
        catch (error) {
            // В случае timeout или ошибки - останавливаем контейнер
            try {
                await container.stop({ t: 1 });
            }
            catch {
                // ignore stop errors
            }
            result = {
                stdout: '',
                stderr: error.message || 'Unknown error',
                exit_code: -1,
                duration_ms: Date.now() - startTime,
                container_id: container.id
            };
        }
        finally {
            // 7. Гарантированное удаление контейнера
            try {
                await container.remove({ force: true });
            }
            catch (err) {
                console.error('Failed to remove container:', err);
            }
        }
        return result;
    }
    /**
     * Выполняет скрипт в Docker контейнере
     */
    async runScript(params) {
        const startTime = Date.now();
        // 1. Создать временный файл со скриптом
        const scriptId = Math.random().toString(36).substring(7);
        const extension = getScriptExtension(params.interpreter);
        const scriptName = `script_${scriptId}.${extension}`;
        const scriptPath = path.join('/tmp', scriptName);
        try {
            fs.writeFileSync(scriptPath, params.script, 'utf8');
            // 2. Построить команду запуска
            const args = params.args?.join(' ') || '';
            const command = `${params.interpreter} /tmp/${scriptName} ${args}`.trim();
            // 3. Выбрать образ по интерпретатору
            const image = getInterpreterImage(params.interpreter);
            // 4. Выполнить в контейнере
            const workingDir = resolveWorkingDir(params.working_dir);
            const limits = parseLimits(this.config.security.terminal.sandbox.limits);
            const timeout = params.timeout || limits.timeout;
            const volumes = this.config.security.terminal.sandbox.volumes;
            const container = await docker.createContainer({
                Image: image,
                Cmd: ['/bin/sh', '-c', command],
                WorkingDir: volumes.project_root.container,
                Env: params.env ? Object.entries(params.env).map(([k, v]) => `${k}=${v}`) : [],
                HostConfig: {
                    Binds: [
                        `${PROJECT_ROOT}:${volumes.project_root.container}:ro`,
                        `${volumes.temp.host}:${volumes.temp.container}:rw`
                    ],
                    Memory: limits.memory,
                    CpuQuota: limits.cpuQuota,
                    CpuPeriod: 100000,
                    NetworkMode: this.config.security.terminal.sandbox.network.enabled ? 'bridge' : 'none',
                    ReadonlyRootfs: false,
                    AutoRemove: false
                },
                AttachStdout: true,
                AttachStderr: true,
                Tty: false
            });
            let result;
            try {
                await container.start();
                const execPromise = container.wait();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Script timeout after ${timeout}ms`)), timeout);
                });
                const waitResult = await Promise.race([execPromise, timeoutPromise]);
                const logStream = await container.logs({
                    stdout: true,
                    stderr: true,
                    timestamps: false
                });
                const logs = logStream.toString('utf8');
                const [stdout, stderr] = this.splitLogs(logs);
                result = {
                    stdout: stdout.slice(0, limits.maxOutput),
                    stderr: stderr.slice(0, limits.maxOutput),
                    exit_code: waitResult.StatusCode,
                    duration_ms: Date.now() - startTime,
                    container_id: container.id
                };
            }
            catch (error) {
                try {
                    await container.stop({ t: 1 });
                }
                catch {
                    // ignore
                }
                result = {
                    stdout: '',
                    stderr: error.message || 'Unknown error',
                    exit_code: -1,
                    duration_ms: Date.now() - startTime,
                    container_id: container.id
                };
            }
            finally {
                try {
                    await container.remove({ force: true });
                }
                catch (err) {
                    console.error('Failed to remove container:', err);
                }
            }
            return result;
        }
        finally {
            // 5. Очистка временного файла
            try {
                if (fs.existsSync(scriptPath)) {
                    fs.unlinkSync(scriptPath);
                }
            }
            catch (err) {
                console.error('Failed to remove temp script:', err);
            }
        }
    }
    /**
     * Разделяет stdout и stderr из Docker logs
     */
    splitLogs(logs) {
        // Docker multiplexes stdout/stderr with 8-byte headers
        // For simplicity, treat all output as stdout
        // In production, parse the stream format properly
        return [logs, ''];
    }
}
