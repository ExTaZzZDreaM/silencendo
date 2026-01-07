#!/usr/bin/env node

/**
 * Helper to ensure a local Qdrant container is running.
 * - Manual: `node scripts/start-qdrant.mjs`
 * - Auto (prebuild): `START_QDRANT_ON_BUILD=1 node scripts/start-qdrant.mjs --auto`
 *
 * Environment variables:
 *   START_QDRANT_ON_BUILD=1   Enable auto start when invoked with --auto
 *   QDRANT_CONTAINER_NAME     Override container name (default: qdrant-dev)
 *   QDRANT_IMAGE              Override image (default: qdrant/qdrant:latest)
 *   QDRANT_PORTS              Override port mappings (default: "-p 6333:6333 -p 6334:6334")
 */

import { execSync } from "child_process"

const args = new Set(process.argv.slice(2))
const autoMode = args.has("--auto")
const forceMode = args.has("--force")
const enabled = forceMode || !autoMode || process.env.START_QDRANT_ON_BUILD === "1"

if (!enabled) {
	console.log("[qdrant] Auto-start disabled (set START_QDRANT_ON_BUILD=1 to enable). Skipping.")
	process.exit(0)
}

const containerName = process.env.QDRANT_CONTAINER_NAME || "qdrant-dev"
const image = process.env.QDRANT_IMAGE || "qdrant/qdrant:latest"
const portArgs = process.env.QDRANT_PORTS || "-p 6333:6333 -p 6334:6334"

function run(cmd, options = {}) {
	return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...options }).trim()
}

function dockerAvailable() {
	try {
		run("docker info")
		return true
	} catch {
		return false
	}
}

function getContainerState(name) {
	try {
		const output = run(`docker ps -a --filter "name=^/${name}$" --format "{{.Status}}"`)
		if (!output) return { exists: false, running: false }
		const status = output.split("\n")[0]
		const running = status.toLowerCase().startsWith("up")
		return { exists: true, running, status }
	} catch {
		return { exists: false, running: false }
	}
}

if (!dockerAvailable()) {
	console.warn("[qdrant] Docker is not available; skipping container start.")
	process.exit(0)
}

const state = getContainerState(containerName)

if (state.running) {
	console.log(`[qdrant] Container "${containerName}" already running (${state.status}).`)
	process.exit(0)
}

if (state.exists) {
	try {
		run(`docker start ${containerName}`)
		console.log(`[qdrant] Started existing container "${containerName}".`)
		process.exit(0)
	} catch (error) {
		console.error(`[qdrant] Failed to start existing container "${containerName}": ${error.message}`)
		process.exit(1)
	}
}

try {
	run(`docker run -d --name ${containerName} ${portArgs} ${image}`)
	console.log(`[qdrant] Started new container "${containerName}" from ${image}.`)
} catch (error) {
	console.error(`[qdrant] Failed to start container "${containerName}": ${error.message}`)
	process.exit(1)
}
