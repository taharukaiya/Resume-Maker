#!/usr/bin/env bash
# Read-only inventory. Never reads credentials, environment files or site content.
set -u
printf '\nOperating system\n'
cat /etc/os-release
printf '\nDisk space\n'
df -hT
printf '\nMemory\n'
free -h
printf '\nListening TCP ports (process names may require sudo)\n'
ss -ltnp
printf '\nWeb services\n'
for service in nginx apache2 httpd caddy lsws docker; do
  printf '%s: ' "$service"
  systemctl is-active "$service" 2>/dev/null || true
done
if command -v docker >/dev/null 2>&1; then
  printf '\nDocker / Compose versions\n'
  docker --version
  docker compose version
  printf '\nRunning containers (no secrets)\n'
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
  printf '\nDocker disk usage (read-only)\n'
  docker system df
fi
printf '\nShare this report after reviewing hostnames/IPs. Do not send passwords, keys or configuration dumps.\n'
