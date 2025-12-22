import path from "node:path"

const PROJECT_ROOT = path.resolve(process.cwd())

export function resolveSafePath(userPath: string): string {
  const resolved = path.resolve(PROJECT_ROOT, userPath)

  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error("Path traversal detected")
  }

  return resolved
}
