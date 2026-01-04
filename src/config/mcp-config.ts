import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DockerImagesConfig {
  go: string;
  node: string;
  python: string;
  rust: string;
  default: string;
}

export interface LimitsConfig {
  cpu: string;
  memory: string;
  timeout: string;
  max_output: string;
  max_processes: number;
}

export interface VolumeConfig {
  host: string;
  container: string;
  read_only: boolean;
}

export interface VolumesConfig {
  project_root: VolumeConfig;
  temp: VolumeConfig;
}

export interface NetworkConfig {
  enabled: boolean;
}

export interface SandboxConfig {
  enabled: boolean;
  mode: string;
  docker_images: DockerImagesConfig;
  limits: LimitsConfig;
  volumes: VolumesConfig;
  network: NetworkConfig;
}

export interface TerminalConfig {
  enabled: boolean;
  sandbox: SandboxConfig;
}

export interface SecurityConfig {
  terminal: TerminalConfig;
}

export interface MCPConfig {
  security: SecurityConfig;
}

/**
 * Загружает конфигурацию из mcp-config.yaml
 */
export function loadConfig(): MCPConfig {
  const configPath = path.resolve(__dirname, '../../mcp-config.yaml');
  
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const fileContent = fs.readFileSync(configPath, 'utf8');
  const config = yaml.load(fileContent) as MCPConfig;

  // Валидация базовой структуры
  if (!config.security?.terminal?.sandbox) {
    throw new Error('Invalid config: missing security.terminal.sandbox section');
  }

  return config;
}

/**
 * Парсит лимиты из конфигурации
 */
export function parseLimits(limits: LimitsConfig) {
  return {
    memory: parseMemory(limits.memory),
    cpuQuota: parseCPU(limits.cpu),
    timeout: parseTimeout(limits.timeout),
    maxOutput: parseMemory(limits.max_output),
    maxProcesses: limits.max_processes
  };
}

function parseMemory(value: string): number {
  const match = value.match(/^(\d+)([kmg]?)$/i);
  if (!match) throw new Error(`Invalid memory format: ${value}`);
  
  const num = parseInt(match[1], 10);
  const unit = (match[2] || '').toLowerCase();
  
  switch (unit) {
    case 'k': return num * 1024;
    case 'm': return num * 1024 * 1024;
    case 'g': return num * 1024 * 1024 * 1024;
    default: return num;
  }
}

function parseCPU(value: string): number {
  // "1" -> 100000 (1 CPU = 100% quota)
  // "0.5" -> 50000
  const cpuCount = parseFloat(value);
  return Math.floor(cpuCount * 100000);
}

function parseTimeout(value: string): number {
  const match = value.match(/^(\d+)(s|m|h)?$/);
  if (!match) throw new Error(`Invalid timeout format: ${value}`);
  
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
let cachedConfig: MCPConfig | null = null;

export function getConfig(): MCPConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}
