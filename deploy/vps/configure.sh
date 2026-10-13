#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -e .env ]]; then
  printf 'Configuration already exists. Edit deploy/vps/.env privately; existing secrets were kept.\n'
  exit 1
fi
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
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AI_PROVIDER=huggingface-browser
OPENAI_API_KEY=
OPENAI_MODEL=
GEMINI_API_KEY=
GEMINI_MODEL=
EOF
printf 'Created deploy/vps/.env with unique secrets (not printed). Add your free Resend key privately before launch. Browser AI needs no API key.\n'
