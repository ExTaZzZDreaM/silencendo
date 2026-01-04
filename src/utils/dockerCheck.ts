import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DockerCheckResult {
  available: boolean;
  version?: string;
  error?: string;
}

/**
 * Проверяет доступность Docker daemon
 */
export async function checkDockerAvailability(): Promise<DockerCheckResult> {
  try {
    const { stdout } = await execAsync('docker ps', { timeout: 5000 });
    
    // Получаем версию Docker
    try {
      const { stdout: versionOutput } = await execAsync('docker --version');
      const version = versionOutput.trim();
      
      console.log('✅ Docker is available:', version);
      return { available: true, version };
    } catch {
      return { available: true };
    }
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    
    console.warn('⚠️  Docker is NOT available:', errorMsg);
    console.warn('⚠️  Falling back to UNSAFE mode with command whitelist');
    console.warn('⚠️  To enable Docker sandbox:');
    console.warn('    1. Install Docker Desktop (https://www.docker.com/products/docker-desktop)');
    console.warn('    2. Start Docker daemon');
    console.warn('    3. Run: npm run setup:docker');
    
    return { 
      available: false, 
      error: errorMsg 
    };
  }
}

export function printUnsafeModeWarning(): void {
  console.warn('━'.repeat(60));
  console.warn('⚠️  RUNNING IN UNSAFE MODE');
  console.warn('━'.repeat(60));
  console.warn('Docker sandbox is disabled. Commands run directly on host.');
  console.warn('Only whitelisted commands are allowed.');
  console.warn('Enable Docker for better security isolation.');
  console.warn('━'.repeat(60));
}
