import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Загружает конфигурацию из mcp-config.yaml
 */
export function loadConfig() {
    const configPath = path.resolve(__dirname, '../../mcp-config.yaml');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }
    const fileContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContent);
    // Валидация базовой структуры
    if (!config.security?.terminal?.sandbox) {
        throw new Error('Invalid config: missing security.terminal.sandbox section');
    }
    return config;
}
/**
 * Парсит лимиты из конфигурации
 */
export function parseLimits(limits) {
    return {
        memory: parseMemory(limits.memory),
        cpuQuota: parseCPU(limits.cpu),
        timeout: parseTimeout(limits.timeout),
        maxOutput: parseMemory(limits.max_output),
        maxProcesses: limits.max_processes
    };
}
function parseMemory(value) {
    const match = value.match(/^(\d+)([kmg]?)$/i);
    if (!match)
        throw new Error(`Invalid memory format: ${value}`);
    const num = parseInt(match[1], 10);
    const unit = (match[2] || '').toLowerCase();
    switch (unit) {
        case 'k': return num * 1024;
        case 'm': return num * 1024 * 1024;
        case 'g': return num * 1024 * 1024 * 1024;
        default: return num;
    }
}
function parseCPU(value) {
    // "1" -> 100000 (1 CPU = 100% quota)
    // "0.5" -> 50000
    const cpuCount = parseFloat(value);
    return Math.floor(cpuCount * 100000);
}
function parseTimeout(value) {
    const match = value.match(/^(\d+)(s|m|h)?$/);
    if (!match)
        throw new Error(`Invalid timeout format: ${value}`);
    const num = parseInt(match[1], 10);
    const unit = match[2] || 's';
    switch (unit) {
        case 's': return num * 1000;
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        default: return num * 1000;
    }
}
// Глобальный экземпляр конфигурации
let cachedConfig = null;
export function getConfig() {
    if (!cachedConfig) {
        cachedConfig = loadConfig();
    }
    return cachedConfig;
}
