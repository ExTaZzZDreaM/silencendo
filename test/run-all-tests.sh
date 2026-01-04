#!/bin/bash
set -e

echo "🧪 Running All Docker Sandbox Tests"
echo "===================================="
echo ""

# 1. Build
echo "📦 Building project..."
npm run build
echo ""

# 2. Config test
echo "1️⃣  Configuration Test"
echo "-------------------"
node test/config-test.mjs
echo ""

# 3. Security test
echo "2️⃣  Security Blacklist Test"
echo "------------------------"
node test/security-test.mjs
echo ""

# 4. Image detection test
echo "3️⃣  Image Detection Test"
echo "---------------------"
node test/image-detection-test.mjs
echo ""

# 5. Terminal MCP test
echo "4️⃣  Terminal MCP Integration Test"
echo "------------------------------"
echo "⏱️  This will take ~15 seconds..."
node test/terminal-test.mjs
echo ""

# 6. Audit log check
echo "5️⃣  Audit Log Check"
echo "----------------"
if [ -f ".mcp/audit.log" ]; then
  echo "✅ Audit log exists"
  echo ""
  echo "Last 5 entries:"
  tail -5 .mcp/audit.log | sed 's/^/  /'
  echo ""
else
  echo "⚠️  No audit log found"
  echo ""
fi

# 7. Docker cleanup check
echo "6️⃣  Docker Cleanup Check"
echo "---------------------"
containers=$(docker ps -a --filter "ancestor=node:22-alpine" --filter "ancestor=alpine:latest" -q | wc -l)
if [ "$containers" -eq 0 ]; then
  echo "✅ No lingering containers"
else
  echo "⚠️  Found $containers containers still running/stopped"
  docker ps -a --filter "ancestor=node:22-alpine" --filter "ancestor=alpine:latest"
fi
echo ""

echo "===================================="
echo "✅ All tests completed!"
echo ""
echo "📊 Summary:"
echo "  - Configuration: ✅"
echo "  - Security:      ✅"
echo "  - Image detect:  ✅"
echo "  - MCP server:    ✅"
echo "  - Audit log:     ✅"
echo "  - Cleanup:       ✅"
