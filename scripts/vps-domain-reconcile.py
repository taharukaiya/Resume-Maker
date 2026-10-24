"""Connect explicitly requested, TXT-verified domains without editing legacy routes.

Run on the VPS host, outside the application containers. Only exact hostname
routes are added in separately owned files; no ports or legacy services change.
"""
import hashlib
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hostinger_dns

ROOT = Path(os.environ.get("BRILLIANCY_ROOT", "/opt/brilliancy"))
COMPOSE = ROOT / "deploy/vps"
TRAEFIK = Path("/etc/easypanel/traefik/config")


def command(*args):
    result = subprocess.run(["docker", "compose", *args], cwd=COMPOSE,
                            check=True, capture_output=True, text=True, timeout=90)
    return result.stdout.strip()


def worker(script, *args):
    return command("exec", "-T", "worker", "node", "--import", "tsx", "scripts/" + script, *args)


def domain_files(host):
    if not re.fullmatch(r"(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", host):
        raise ValueError("Invalid domain.")
    key = "brilliancy-auto-" + hashlib.sha256(host.encode()).hexdigest()[:24]
    return key, COMPOSE / "domains" / (key + ".caddy"), TRAEFIK / (key + ".yaml")


def proxy_config(host, key):
    return {"http": {"routers": {
        key: {"rule": "Host(`" + host + "`)", "entryPoints": ["https"], "priority": 10,
              "service": key, "tls": {"certResolver": "letsencrypt"}},
        key + "-http": {"rule": "Host(`" + host + "`)", "entryPoints": ["http"],
                        "priority": 10, "service": key, "middlewares": [key]}},
        "middlewares": {key: {"redirectScheme": {"scheme": "https", "permanent": True}}},
        "services": {key: {"loadBalancer": {"passHostHeader": True,
            "servers": [{"url": "http://brilliancy-portfolio-gateway:8080/"}]}}}}}


def check_conflicts(host, owned):
    for folder in [TRAEFIK, COMPOSE / "domains"]:
        for path in folder.iterdir():
            if path in owned or not path.is_file() or path.suffix not in [".yaml", ".yml", ".json", ".toml", ".caddy"]:
                continue
            text = path.read_text(errors="replace")
            # EasyPanel's built-in low-priority error/IP routers do not own
            # researcher hostnames. Ignore only these exact known fallbacks.
            try:
                config = json.loads(text)
                routers = config.get("http", {}).get("routers", {})
                for name, route in list(routers.items()):
                    error = name in ["http-error-page", "https-error-page"] and route.get("rule") == "HostRegexp(`.+`)" and route.get("priority") == 1
                    ip = name in ["http-easypanel-ip", "https-easypanel-ip"] and route.get("rule") == "HostRegexp(`^[0-9.]+$`)" and route.get("priority") == 2
                    if route.get("service") == "easypanel" and (error or ip):
                        del routers[name]
                text = json.dumps(config)
            except (ValueError, AttributeError, TypeError):
                pass  # Unknown formats remain conservatively checked.
            if host in text or "HostRegexp" in text:
                raise ValueError("An existing hosting route may use this domain. Automatic setup will not replace it.")


def write_atomic(path, text):
    temp = path.with_suffix(".pending")
    temp.write_text(text)
    temp.replace(path)


def reconcile(row, expected_ip):
    hostinger_dns.launch_allowed(row)
    host = row["hostname"]
    hosts = [host, *row.get("aliases", [])]
    files = [domain_files(name) for name in hosts]
    owned = {path for _, caddy, proxy in files for path in (caddy, proxy)}
    # Validate every alias before writing any route or requesting certificates.
    for name in hosts:
        check_conflicts(name, owned)
    if row['status'] == 'queued':
        hostinger_dns.connect_dns(row, expected_ip)
        worker('vps-domain-requests.ts', 'status', row['id'], 'dns_pending', 'Website DNS submitted. Waiting for propagation before connecting HTTPS.')
        return
    for name in hosts:
        addresses = {item[4][0] for item in socket.getaddrinfo(name, 443, type=socket.SOCK_STREAM)}
        if not addresses or addresses != {expected_ip}:
            return  # DNS propagation; keep the pending request for the next run.
    if row["status"] == "dns_pending":
        previous = {caddy: caddy.read_text() if caddy.exists() else None for _, caddy, _ in files}
        try:
            for name, (_, caddy, _) in zip(hosts, files):
                config = worker("vps-domain.ts", "config", name)
                config = config.replace("    encode zstd gzip", "    header X-Brilliancy-Domain " + name + "\n    encode zstd gzip")
                write_atomic(caddy, config)
            command("exec", "-T", "caddy", "caddy", "validate", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile")
            command("exec", "-T", "caddy", "caddy", "reload", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile")
        except Exception:
            for path, original in previous.items():
                if original is None:
                    path.unlink(missing_ok=True)
                else:
                    write_atomic(path, original)
            raise
        for name, (key, _, proxy) in zip(hosts, files):
            write_atomic(proxy, json.dumps(proxy_config(name, key), indent=2))
        worker("vps-domain-requests.ts", "status", row["id"], "connecting", "DNS confirmed. Issuing HTTPS certificates for your website and redirect address. Status updates automatically.")
        return
    for name in hosts:
        connection = http.client.HTTPSConnection(name, timeout=15)
        try:
            connection.request("GET", "/")
            response = connection.getresponse()
            if response.getheader("X-Brilliancy-Domain") != name:
                return
        except OSError:
            return  # ACME may still be issuing the certificate.
        finally:
            connection.close()
    worker("vps-domain.ts", "activate", host)
    worker("vps-domain-requests.ts", "finish", row["id"])


def main():
    expected_ip = str(ipaddress.ip_address(os.environ["BRILLIANCY_VPS_IP"]))
    if not ipaddress.ip_address(expected_ip).is_global:
        raise ValueError("Configure the public VPS IP.")
    worker('vps-domain-requests.ts', 'capabilities', json.dumps({'configured': hostinger_dns.configured(), 'goLiveDomains': [name.strip() for name in os.environ.get('BRILLIANCY_GO_LIVE_DOMAINS', '').split(',') if name.strip()]}))
    for row in json.loads(worker('vps-domain-requests.ts', 'prepare-list')):
        try:
            if row['status'] == 'preparing':
                hostinger_dns.prepare(row)
            worker('vps-domain-requests.ts', 'prepare-verify', row['id'])
        except Exception as error:
            message = str(error) if isinstance(error, ValueError) else 'Hostinger preparation could not finish. Ask the hosting administrator to check the private token configuration.'
            status = error.status if isinstance(error, hostinger_dns.PreparationActionRequired) else 'error'
            worker('vps-domain-requests.ts', 'prepare-status', row['id'], status, message)
    for row in json.loads(worker("vps-domain-requests.ts", "list")):
        try:
            reconcile(row, expected_ip)
            print(row["hostname"], "checked")
        except Exception as error:
            message = str(error) if isinstance(error, ValueError) else "Connection could not complete. Check DNS and retry; existing websites were not replaced."
            worker("vps-domain-requests.ts", "status", row["id"], "error", message)
            print(row["hostname"], message, file=sys.stderr)


if __name__ == "__main__":
    import fcntl
    with open('/var/lock/brilliancy-domains.lock', 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            main()
        except BlockingIOError:
            print('Another domain check is running.')
