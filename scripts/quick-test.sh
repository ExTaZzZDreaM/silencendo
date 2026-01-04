#!/bin/bash
# Быстрое тестирование Docker Sandbox без интерактивного режима

echo "🔧 Building TypeScript..."
npm run build

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Quick Docker Sandbox Tests           ║"
echo "╚════════════════════════════════════════╝"

# Тест 1: Простая команда
echo ""
echo "📋 Test 1: Simple echo command"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_command","arguments":{"command":"echo Hello Docker"}}}' | node dist/mcp/servers/terminal/index.js 2>/dev/null | grep -A 20 '"result"'

# Тест 2: Список файлов
echo ""
echo "📁 Test 2: List files (ls -la)"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_command","arguments":{"command":"ls -la"}}}' | node dist/mcp/servers/terminal/index.js 2>/dev/null | grep -A 20 '"result"'

# Тест 3: Опасная команда (должна блокироваться)
echo ""
echo "🚫 Test 3: Dangerous command (should block)"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_command","arguments":{"command":"rm -rf /"}}}' | node dist/mcp/servers/terminal/index.js 2>/dev/null | grep -A 10 '"error"'

# Тест 4: Python скрипт
echo ""
echo "🐍 Test 4: Python script"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_script","arguments":{"interpreter":"python","script":"import sys\nprint(\"Python:\", sys.version)"}}}' | node dist/mcp/servers/terminal/index.js 2>/dev/null | grep -A 20 '"result"'

# Тест 5: Node скрипт
echo ""
echo "🟢 Test 5: Node.js script"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_script","arguments":{"interpreter":"node","script":"console.log(\"Node:\", process.version)"}}}' | node dist/mcp/servers/terminal/index.js 2>/dev/null | grep -A 20 '"result"'

# Тест 6: Go скрипт
echo ""
echo "🔵 Test 6: Go script"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_script","arguments":{"interpreter":"go","script":"package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"Hello from Go!\") }"}}}' | node dist/mcp/servers/terminal/index.js 2>/dev/null | grep -A 20 '"result"'

echo ""
echo "✅ All quick tests completed!"
echo ""
echo "💡 For interactive testing, run:"
echo "   node scripts/test-sandbox.mjs"
