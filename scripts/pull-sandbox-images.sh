#!/bin/bash
set -e

echo "🐳 Pulling Docker sandbox images..."

images=(
  "golang:1.23-alpine"
  "node:22-alpine"
  "python:3.12-slim"
  "rust:alpine"
  "alpine:latest"
)

for image in "${images[@]}"; do
  echo "Pulling $image..."
  docker pull "$image"
done

echo "✅ All sandbox images pulled successfully!"
