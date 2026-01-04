#!/bin/bash

docker --version
docker ps

echo "check version and ps done"

npm run setup:docker
echo "npm run setup:docker done"

docker images | grep -E "golang|node|python|rust|alpine" 
echo "docker images grep done"

npm run build
node -e "import('./dist/utils/dockerCheck.js').then(m => m.checkDockerAvailability())"
echo "docker check done"
echo "✅ Docker environment is set up and ready!"

