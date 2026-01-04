import * as fs from 'fs';
import * as path from 'path';

const AUDIT_LOG_PATH = path.resolve(process.cwd(), '.mcp/audit.log');

export interface AuditEntry {
  timestamp: string;
  tool: string;
  command: string;
  image?: string;
  exit_code: number;
  duration_ms: number;
  container_id?: string;
  error?: string;
}

/**
 * Записывает аудит выполнения команды в .mcp/audit.log
 */
export function logAudit(entry: AuditEntry): void {
  const logDir = path.dirname(AUDIT_LOG_PATH);
  
  // Создаем директорию если не существует
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logLine = formatAuditEntry(entry);
  
  fs.appendFileSync(AUDIT_LOG_PATH, logLine + '\n', 'utf8');
}

function formatAuditEntry(entry: AuditEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.tool}]`,
    `command="${entry.command}"`,
  ];

  if (entry.image) {
    parts.push(`image=${entry.image}`);
  }

  parts.push(`exit_code=${entry.exit_code}`);
  parts.push(`duration=${entry.duration_ms}ms`);

  if (entry.container_id) {
    parts.push(`container_id=${entry.container_id.substring(0, 12)}`);
  }

  if (entry.error) {
    parts.push(`error="${entry.error}"`);
  }

  return parts.join(' ');
}
