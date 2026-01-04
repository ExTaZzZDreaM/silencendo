#!/usr/bin/env node
/**
 * Тест конфигурации и парсинга
 */

import { getConfig, parseLimits } from '../dist/config/mcp-config.js';

console.log('⚙️  Configuration Tests\n');

try {
  console.log('1️⃣  Loading config from mcp-config.yaml...');
  const config = getConfig();
  console.log('✅ Config loaded successfully\n');

  console.log('2️⃣  Checking Docker images:');
  const images = config.security.terminal.sandbox.docker_images;
  console.log(`   Go:      ${images.go}`);
  console.log(`   Node:    ${images.node}`);
  console.log(`   Python:  ${images.python}`);
  console.log(`   Rust:    ${images.rust}`);
  console.log(`   Default: ${images.default}\n`);

  console.log('3️⃣  Parsing limits:');
  const limits = parseLimits(config.security.terminal.sandbox.limits);
  console.log(`   Memory:      ${limits.memory} bytes (${limits.memory / 1024 / 1024}MB)`);
  console.log(`   CPU Quota:   ${limits.cpuQuota} (${limits.cpuQuota / 100000} CPU)`);
  console.log(`   Timeout:     ${limits.timeout}ms (${limits.timeout / 1000}s)`);
  console.log(`   Max Output:  ${limits.maxOutput} bytes (${limits.maxOutput / 1024 / 1024}MB)`);
  console.log(`   Max Procs:   ${limits.maxProcesses}\n`);

  console.log('4️⃣  Checking volumes:');
  const volumes = config.security.terminal.sandbox.volumes;
  console.log(`   Project: ${volumes.project_root.host} → ${volumes.project_root.container} (RO: ${volumes.project_root.read_only})`);
  console.log(`   Temp:    ${volumes.temp.host} → ${volumes.temp.container} (RO: ${volumes.temp.read_only})\n`);

  console.log('5️⃣  Checking network:');
  console.log(`   Enabled: ${config.security.terminal.sandbox.network.enabled}\n`);

  console.log('🎉 All configuration tests PASSED!\n');
  process.exit(0);

} catch (err) {
  console.error('❌ Configuration test FAILED:', err.message);
  process.exit(1);
}
