#!/usr/bin/env node
import { spawn } from 'child_process';
import * as readline from 'readline';

const serverPath = './dist/mcp/servers/terminal/index.js';

console.log('🧪 Testing run_script...\n');

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
    console.error('Parse error:', line);
  }
});

function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    const request = { jsonrpc: '2.0', id, method, params };
    
    pendingRequests.set(id, { resolve, reject });
    console.log('�� Request:', JSON.stringify(request));
    server.stdin.write(JSON.stringify(request) + '\n');
    
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Timeout'));
      }
    }, 30000);
  });
}

async function runTests() {
  try {
    console.log('=== Initialize ===');
    await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    });

    console.log('\n=== Test 1: Bash Script ===');
    await sendRequest('tools/call', {
      name: 'run_script',
      arguments: {
        interpreter: 'sh',
        script: '#!/bin/sh\necho "Hello from sh"\nls -la'
      }
    });

    console.log('\n=== Test 2: Python Script ===');
    await sendRequest('tools/call', {
      name: 'run_script',
      arguments: {
        interpreter: 'python',
        script: 'import sys\nprint("Python version:", sys.version)\nprint("Hello from Python!")'
      }
    });

    console.log('\n=== Test 3: Node Script ===');
    await sendRequest('tools/call', {
      name: 'run_script',
      arguments: {
        interpreter: 'node',
        script: 'console.log("Node version:", process.version);\nconsole.log("Hello from Node!");'
      }
    });

    console.log('\n=== Test 4: Script with Args ===');
    await sendRequest('tools/call', {
      name: 'run_script',
      arguments: {
        interpreter: 'sh',
        script: 'echo "Args: $@"',
        args: ['arg1', 'arg2', 'arg3']
      }
    });

    console.log('\n=== Test 5: Go Script ===');
    await sendRequest('tools/call', {
      name: 'run_script',
      arguments: {
        interpreter: 'go',
        script: `package main
import "fmt"
func main() {
  fmt.Println("Hello from Go!")
  fmt.Println("Go is running in Docker container")
}`
      }
    });

    console.log('\n=== Test 6: Rust Script ===');
    await sendRequest('tools/call', {
      name: 'run_script',
      arguments: {
        interpreter: 'rust',
        script: `fn main() {
    println!("Hello from Rust!");
    let nums: Vec<i32> = (1..=5).collect();
    println!("Numbers: {:?}", nums);
}`
      }
    });

    console.log('\n✅ All script tests completed!\n');

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
