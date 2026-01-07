import { DocsCache } from "./src/mcp/servers/docs/sandbox.js"

async function testCache() {
  console.log("🧪 Testing Docs Cache\n")

  const cache = new DocsCache()

  try {
    // Test 1: Set and get
    console.log("1️⃣ Testing set/get...")
    const testResult = {
      abstract: "Test abstract",
      results: [
        {
          title: "Test Title",
          url: "https://example.com",
          snippet: "Test snippet"
        }
      ]
    }

    cache.set("test query", testResult, 60000) // 1 minute TTL
    const retrieved = cache.get("test query")

    if (retrieved && retrieved.abstract === testResult.abstract) {
      console.log("✅ Cache set/get works correctly")
    } else {
      console.log("❌ Cache retrieval failed")
    }
    console.log()

    // Test 2: Hash function
    console.log("2️⃣ Testing hash function...")
    const hash1 = cache.hashQuery("React")
    const hash2 = cache.hashQuery("react")
    const hash3 = cache.hashQuery("Vue")

    if (hash1 === hash2) {
      console.log("✅ Hash is case-insensitive")
    } else {
      console.log("❌ Hash should be case-insensitive")
    }

    if (hash1 !== hash3) {
      console.log("✅ Different queries produce different hashes")
    } else {
      console.log("❌ Different queries should produce different hashes")
    }
    console.log()

    // Test 3: Expiration
    console.log("3️⃣ Testing expiration...")
    cache.set("expired query", testResult, 100) // 100ms TTL
    await new Promise((resolve) => setTimeout(resolve, 150))
    const expired = cache.get("expired query")

    if (!expired) {
      console.log("✅ Expired entries are not returned")
    } else {
      console.log("❌ Expired entries should not be returned")
    }
    console.log()

    console.log("✅ Cache tests completed!")
  } catch (err: any) {
    console.error("❌ Test failed:", err.message)
  } finally {
    cache.close()
  }
}

testCache()



