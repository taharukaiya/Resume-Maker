#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -e .env ]]; then
  printf 'Configuration already exists. Edit deploy/vps/.env privately; existing secrets were kept.\n'
  exit 1
fi
read -rp 'Server mode [easypanel/existing/new, default existing]: ' mode
mode=${mode:-existing}
proxy_cidrs=
case "$mode" in
  easypanel)
    [[ "$(docker network inspect easypanel --format '{{.Driver}} {{.Attachable}}')" == 'overlay true' ]] || { printf 'An attachable EasyPanel overlay is required.\n'; exit 1; }
    proxy_cidrs=$(docker network inspect easypanel --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}')
    [[ -n "$proxy_cidrs" ]] || { printf 'EasyPanel network has no subnet.\n'; exit 1; }
    for cidr in $proxy_cidrs; do
      [[ "$cidr" =~ ^[0-9a-fA-F:.]+/[0-9]{1,3}$ ]] || { printf 'Unexpected network subnet.\n'; exit 1; }
    done
    compose_files=compose.yaml:compose.easypanel.yaml
    ;;
  existing) compose_files=compose.yaml:compose.existing.yaml ;;
  new) compose_files=compose.yaml ;;
  *) printf 'Enter easypanel, existing or new.\n'; exit 1 ;;
esac
read -rp 'Studio hostname (a NEW subdomain, no https://): ' studio
read -rp 'Media hostname (a NEW separate subdomain): ' media
read -rp 'Your email for HTTPS certificate notices: ' contact
read -rp 'Sender email on your verified Resend domain: ' sender
for host in "$studio" "$media"; do
  [[ "$host" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$ ]] || { printf 'Invalid hostname.\n'; exit 1; }
done
[[ "$studio" != "$media" ]] || { printf 'Choose different studio and media hosts.\n'; exit 1; }
for email in "$contact" "$sender"; do
  [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$ ]] || { printf 'Invalid email.\n'; exit 1; }
done
umask 077
cat > .env <<EOF
COMPOSE_FILE=$compose_files
EASYPANEL_PROXY_CIDRS="$proxy_cidrs"
STUDIO_HOST=$studio
MEDIA_HOST=$media
ACME_EMAIL=$contact
EMAIL_FROM=$sender
EMAIL_PROVIDER=resend
RESEND_API_KEY=
POSTGRES_PASSWORD=$(openssl rand -hex 32)
APP_DB_PASSWORD=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
SETUP_TOKEN=$(openssl rand -hex 32)
RELEASE_RETENTION=3
VPS_PUBLIC_IP=
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AI_PROVIDER=gemini
OPENAI_API_KEY=
OPENAI_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
EOF
printf 'Created deploy/vps/.env with unique secrets (not printed). Add your Resend and Google AI Studio Free-tier keys privately before launch.\n'
