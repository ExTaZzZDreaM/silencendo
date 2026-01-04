#!/usr/bin/env node
/**
 * Ручное тестирование Docker Sandbox через MCP протокол
 * Использование: node scripts/test-sandbox.mjs
 */

import { spawn } from 'child_process';
import readline from 'readline';

// Запуск Terminal MCP сервера напрямую (не через менеджер)
const server = spawn('node', ['dist/mcp/servers/terminal/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let requestId = 1;

// Отправка JSON-RPC запроса
function sendRequest(method, params) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method,
    params
  };
  
  console.log('\n📤 Sending:', JSON.stringify(request, null, 2));
  server.stdin.write(JSON.stringify(request) + '\n');
}

// Чтение ответов от сервера
const rl = readline.createInterface({
  input: server.stdout,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const response = JSON.parse(line);
    console.log('\n📥 Response:', JSON.stringify(response, null, 2));
  } catch (e) {
    console.log('Raw output:', line);
  }
});

// Интерактивное меню
function showMenu() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Docker Sandbox Manual Test          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n1. Initialize MCP server');
  console.log('2. List available tools');
  console.log('3. Run simple command (echo)');
  console.log('4. Run command with files (ls -la)');
  console.log('5. Test dangerous command (rm -rf)');
  console.log('6. Test timeout (sleep 60)');
  console.log('7. Run Python script');
  console.log('8. Run Node script');
  console.log('9. Run Shell script');
  console.log('10. Run Go script');
  console.log('11. Run Rust script');
  console.log('0. Exit');
  console.log('\n─────────────────────────────────────────');
}

const stdin = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function handleChoice(choice) {
  switch (choice) {
    case '1':
      sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      });
      break;

    case '2':
      sendRequest('tools/list', {});
      break;

    case '3':
      sendRequest('tools/call', {
        name: 'run_command',
        arguments: {
          command: 'echo "Hello from Docker!"'
        }
      });
      break;

    case '4':
      sendRequest('tools/call', {
        name: 'run_command',
        arguments: {
          command: 'ls -la'
        }
      });
      break;

    case '5':
      console.log('\n⚠️  Testing dangerous command (should be blocked)...');
      sendRequest('tools/call', {
        name: 'run_command',
        arguments: {
          command: 'rm -rf /'
        }
      });
      break;

    case '6':
      console.log('\n⏱️  Testing timeout (will stop after 30s)...');
      sendRequest('tools/call', {
        name: 'run_command',
        arguments: {
          command: 'sleep 60',
          timeout: 5000  // 5 секунд для теста
        }
      });
      break;

    case '7':
      sendRequest('tools/call', {
        name: 'run_script',
        arguments: {
          interpreter: 'python',
          script: `
import sys
import os

print(f"Python version: {sys.version}")
print(f"Current dir: {os.getcwd()}")
print(f"Files: {os.listdir('.')[:5]}")
`.trim()
        }
      });
      break;

    case '8':
      sendRequest('tools/call', {
        name: 'run_script',
        arguments: {
          interpreter: 'node',
          script: `
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('CWD:', process.cwd());
`.trim()
        }
      });
      break;

    case '9':
      sendRequest('tools/call', {
        name: 'run_script',
        arguments: {
          interpreter: 'sh',
          script: `
#!/bin/sh
echo "Shell: $SHELL"
echo "User: $(whoami)"
echo "PWD: $(pwd)"
ls -lh | head -5
`.trim()
        }
      });
      break;

    case '10':
      sendRequest('tools/call', {
        name: 'run_script',
        arguments: {
          interpreter: 'go',
          script: `
package main

import (
	"fmt"
	"runtime"
)

func main() {
	fmt.Printf("Go version: %s\\n", runtime.Version())
	fmt.Printf("OS/Arch: %s/%s\\n", runtime.GOOS, runtime.GOARCH)
	fmt.Println("Hello from Go!")
}
`.trim()
        }
      });
      break;

    case '11':
      sendRequest('tools/call', {
        name: 'run_script',
        arguments: {
          interpreter: 'rust',
          script: `
fn main() {
    println!("Rust compiler: {}", env!("RUSTC_VERSION", "unknown"));
    println!("Hello from Rust!");
    
    let nums: Vec<i32> = (1..=5).collect();
    println!("Numbers: {:?}", nums);
}
`.trim()
        }
      });
      break;

    case '0':
      console.log('\n👋 Exiting...');
      server.kill();
      process.exit(0);
      break;

    default:
      console.log('❌ Invalid choice');
  }
}

// Main loop
function promptUser() {
  showMenu();
  stdin.question('Enter choice: ', async (choice) => {
    await handleChoice(choice.trim());
    setTimeout(promptUser, 1000);  // Подождать ответ от сервера
  });
}

// Запуск
console.log('🚀 Starting MCP server...\n');
setTimeout(() => {
  promptUser();
}, 1000);

// Cleanup on exit
process.on('SIGINT', () => {
  server.kill();
  process.exit();
});
