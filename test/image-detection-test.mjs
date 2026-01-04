#!/usr/bin/env node
/**
 * Тест автоопределения Docker образа
 */

import { detectImage } from '../dist/mcp/servers/terminal/sandbox.js';
import * as fs from 'fs';
import * as path from 'path';

console.log('🐳 Docker Image Detection Tests\n');

const testCases = [
  { file: 'package.json', expected: 'node:22-alpine', desc: 'Node.js project' },
  { file: 'go.mod', expected: 'golang:1.23-alpine', desc: 'Go project' },
  { file: 'requirements.txt', expected: 'python:3.12-slim', desc: 'Python (requirements)' },
  { file: 'pyproject.toml', expected: 'python:3.12-slim', desc: 'Python (pyproject)' },
  { file: 'Cargo.toml', expected: 'rust:alpine', desc: 'Rust project' }
];

const tmpDir = path.join(process.cwd(), '.test-tmp');
let passCount = 0;

try {
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const test of testCases) {
    const testDir = path.join(tmpDir, test.file.replace('.', '-'));
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, test.file), '{}', 'utf8');

    const detected = detectImage(testDir);
    
    if (detected === test.expected) {
      console.log(`✅ PASS: ${test.desc} → ${detected}`);
      passCount++;
    } else {
      console.log(`❌ FAIL: ${test.desc} expected ${test.expected}, got ${detected}`);
    }

    fs.rmSync(testDir, { recursive: true, force: true });
  }

  // Test default fallback
  const emptyDir = path.join(tmpDir, 'empty');
  fs.mkdirSync(emptyDir, { recursive: true });
  const defaultImage = detectImage(emptyDir);
  
  if (defaultImage === 'alpine:latest') {
    console.log(`✅ PASS: Empty directory → ${defaultImage} (fallback)`);
    passCount++;
  } else {
    console.log(`❌ FAIL: Expected alpine:latest for empty dir, got ${defaultImage}`);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n${passCount}/${testCases.length + 1} tests passed\n`);

  if (passCount === testCases.length + 1) {
    console.log('🎉 All image detection tests PASSED!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests FAILED!\n');
    process.exit(1);
  }

} catch (err) {
  console.error('❌ Test error:', err.message);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.exit(1);
}
