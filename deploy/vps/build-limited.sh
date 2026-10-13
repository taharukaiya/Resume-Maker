#!/usr/bin/env bash
# Build on the shared VPS before starting this application's containers.
set -euo pipefail
cd "$(dirname "$0")/../.."
[[ "$(uname -s)" == Linux ]] || { printf 'Run this on the Linux VPS.\n'; exit 1; }
docker buildx version >/dev/null
available_kb=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
(( available_kb >= 4 * 1024 * 1024 )) || { printf 'Less than 4 GiB RAM is currently available. Build elsewhere or schedule capacity first.\n'; exit 1; }
available_disk_kb=$(df -Pk . | awk 'NR==2 {print $4}')
(( available_disk_kb >= 15 * 1024 * 1024 )) || { printf 'Less than 15 GiB disk space is available for the image build.\n'; exit 1; }
running=$(docker ps -q --filter label=com.docker.compose.project=brilliancy)
[[ -z "$running" ]] || { printf 'This application is already running. Use the documented backup/update window before a local rebuild. Other projects must remain running.\n'; exit 1; }
builder="brilliancy-build-$(date +%s)-$$"
revision=$(git rev-parse --short=12 HEAD)
docker buildx create --name "$builder" --driver docker-container \
  --driver-opt memory=3g,memory-swap=3g,cpu-quota=100000,cpu-period=100000 >/dev/null
# Remove only this temporary builder, never prune global Docker resources.
trap 'docker buildx rm "$builder" >/dev/null 2>&1 || true' EXIT
docker buildx build --builder "$builder" --load \
  -t "brilliancy:$revision" -t brilliancy:local .
printf 'Built brilliancy:%s and brilliancy:local. No application has been started.\n' "$revision"
