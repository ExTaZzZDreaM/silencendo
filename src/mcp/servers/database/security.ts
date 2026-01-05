const SQL_INJECTION_PATTERNS = [
  /--/,
  /;/,
  /\bOR\b\s+\d+=\d+/i,
  /\bUNION\b/i,
]

export function validateQuery(
  query: string,
  config: {
    allow_mutations: boolean
    blocked_keywords: string[]
  }
) {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      throw new Error("Possible SQL injection detected")
    }
  }

  for (const keyword of config.blocked_keywords) {
    if (query.toUpperCase().includes(keyword)) {
      if (!config.allow_mutations) {
        throw new Error(`Blocked SQL keyword: ${keyword}`)
      }
    }
  }

  if (!query.trim().toUpperCase().startsWith("SELECT") && !config.allow_mutations) {
    throw new Error("Only SELECT queries are allowed")
  }
}
