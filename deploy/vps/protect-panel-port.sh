#!/usr/bin/env bash
# Install only after verifying HTTPS panel access and an independent VPS console.
# Restrict port 3000 on the public interface; keep Docker-to-Docker proxy access.
set -euo pipefail
interface=${1:-$(ip -4 route show default | awk 'NR==1 {print $5}')}
[[ "$interface" =~ ^[a-zA-Z0-9_.:-]+$ ]] && ip link show "$interface" >/dev/null
for firewall in iptables ip6tables; do
  "$firewall" -w -S DOCKER-USER >/dev/null
  "$firewall" -w -C INPUT -i "$interface" -p tcp --dport 3000 -j REJECT 2>/dev/null ||
    "$firewall" -w -I INPUT 1 -i "$interface" -p tcp --dport 3000 -j REJECT
  "$firewall" -w -C DOCKER-USER -i "$interface" -p tcp -m conntrack --ctorigdstport 3000 -j REJECT 2>/dev/null ||
    "$firewall" -w -I DOCKER-USER 1 -i "$interface" -p tcp -m conntrack --ctorigdstport 3000 -j REJECT
done
printf 'Direct public port 3000 blocked on %s; internal proxy traffic preserved.\n' "$interface"
