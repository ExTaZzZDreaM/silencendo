#!/usr/bin/env node
/**
 * Тестовый клиент для Terminal MCP Server
 */

import { spawn } from 'child_process';
import * as readline from 'readline';

const serverPath = './dist/mcp/servers/terminal/index.js';

console.log('🧪 Starting Terminal MCP Test Client...\n');

const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let messageId = 1;
const pendingRequests = new Map();

const rl = readline.createInterface({
  input: server.stdout,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log('📥 Response:', JSON.stringify(response, null, 2));
    
    if (response.id && pendingRequests.has(response.id)) {
      const { resolve } = pendingRequests.get(response.id);
      pendingRequests.delete(response.id);
      resolve(response);
    }
  } catch (err) {
    console.error('Failed to parse:', line);
  }
});

function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const request = { jsonrpc: '2.0', id, method, params };
    
    pendingRequests.set(id, { resolve, reject });
    console.log('📤 Request:', JSON.stringify(request));
    server.stdin.write(JSON.stringify(request) + '\n');
    
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Timeout'));
      }
    }, 60000);
  });
}

async function runTests() {
  try {
    console.log('\n=== Test 1: Initialize ===');
    await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });

    console.log('\n=== Test 2: List Tools ===');
    await sendRequest('tools/list');

    console.log('\n=== Test 3: Echo Command ===');
    await sendRequest('tools/call', {
      name: 'run_command',
      arguments: { command: 'echo "Hello from Docker!"' }
    });

    console.log('\n=== Test 4: List Files ===');
    await sendRequest('tools/call', {
      name: 'run_command',
      arguments: { command: 'ls -la', working_dir: '.' }
    });

    console.log('\n=== Test 5: Node Version ===');
    await sendRequest('tools/call', {
      name: 'run_command',
      arguments: { command: 'node --version' }
    });

    console.log('\n=== Test 6: Timeout (2s) ===');
    await sendRequest('tools/call', {
      name: 'run_command',
      arguments: { command: 'sleep 5', timeout: 2000 }
    });

    console.log('\n=== Test 7: Dangerous Command (blocked) ===');
    await sendRequest('tools/call', {
      name: 'run_command',
      arguments: { command: 'rm -rf /tmp/test' }
    });

    console.log('\n✅ Tests completed!\n');
    console.log('📋 Check audit: cat .mcp/audit.log\n');

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    setTimeout(() => {
      server.kill();
      process.exit(0);
    }, 1000);
  }
}

setTimeout(runTests, 2000);

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});
