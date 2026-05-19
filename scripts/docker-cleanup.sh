#!/usr/bin/env bash
# Free disk/RAM on EC2 — run weekly or when disk > 80%
set -euo pipefail

echo "Disk before:"
df -h /

docker system prune -af --volumes=false
docker builder prune -af

echo "Disk after:"
df -h /

echo "Docker disk usage:"
docker system df
