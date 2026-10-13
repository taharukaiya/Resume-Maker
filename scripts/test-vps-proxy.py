"""Exercise actual Caddy media routes using temporary files and loopback listeners.

Usage: python scripts/test-vps-proxy.py /path/to/caddy
TLS termination and Docker networking are covered separately by deployment CI.
"""

import http.client
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time


def check_config(binary, source):
    with tempfile.TemporaryDirectory(prefix="brilliancy-proxy-") as temporary:
        directory = Path(temporary)
        releases = directory / "storage" / "releases"
        releases.mkdir(parents=True)
        (releases / "sample.pdf").write_bytes(b"published fixture")
        private = directory / "storage" / "private"
        private.mkdir()
        (private / "secret.txt").write_bytes(b"private fixture")
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]

        config = source.read_text()
        # Keep the actual routing directives; adapt only deployment addresses,
        # storage paths and TLS/admin settings for an isolated local process.
        config = config.replace("{\n", "{\n    admin off\n    default_bind 127.0.0.1\n", 1)
        config = config.replace("    email {$ACME_EMAIL}", "    auto_https off")
        for host in ("STUDIO_HOST", "MEDIA_HOST"):
            address = "studio.test" if host == "STUDIO_HOST" else "media.test"
            config = config.replace("http://{$" + host + "}:8080", f"http://{address}:{port}")
            config = config.replace("{$" + host + "}", f"http://{address}:{port}")
        config = config.replace("http://:8080", f"http://:{port}")
        config = config.replace("{$EASYPANEL_PROXY_CIDRS}", "127.0.0.1/32")
        config = config.replace("/srv/data/storage/releases", '"' + releases.as_posix() + '"')
        config = config.replace("import /etc/caddy/domains/*.caddy", "")
        config_path = directory / "Caddyfile"
        config_path.write_text(config)
        env = {**os.environ, "XDG_DATA_HOME": str(directory / "data"), "XDG_CONFIG_HOME": str(directory / "config")}
        with (directory / "caddy.log").open("w+") as log:
            process = subprocess.Popen(
                [binary, "run", "--config", str(config_path), "--adapter", "caddyfile"],
                stdout=log, stderr=log, env=env,
            )
            try:
                for _ in range(100):
                    if process.poll() is not None:
                        raise AssertionError("Caddy exited during startup")
                    try:
                        with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                            break
                    except OSError:
                        time.sleep(0.1)
                else:
                    raise AssertionError("Caddy did not start")

                cases = [
                    ("GET", "/releases/sample.pdf", "media.test", 200),
                    ("HEAD", "/releases/sample.pdf", "media.test", 200),
                    ("GET", "/releases/missing.pdf", "media.test", 404),
                    ("GET", "/private/secret.txt", "media.test", 404),
                    ("HEAD", "/private/secret.txt", "media.test", 404),
                    ("GET", "/", "media.test", 404),
                    ("GET", "/releases/../private/secret.txt", "media.test", 404),
                    ("POST", "/releases/sample.pdf", "media.test", 404),
                ]
                if source.name != "Caddyfile":
                    cases.append(("GET", "/", "unknown.test", 404))
                for method, path, host, expected in cases:
                    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
                    try:
                        connection.request(method, path, headers={"Host": host})
                        response = connection.getresponse()
                        body = response.read()
                        assert response.status == expected, f"{source.name}: {method} {host}{path}: expected {expected}, got {response.status}"
                        assert b"private fixture" not in body
                        if expected == 200:
                            assert response.getheader("Content-Disposition") == "attachment"
                            assert "sandbox" in response.getheader("Content-Security-Policy", "")
                            assert body == (b"published fixture" if method == "GET" else b"")
                    finally:
                        connection.close()
                print(f"PASS {source.name}: {len(cases)} HTTP routing checks")
            except Exception:
                log.flush()
                log.seek(0)
                print(log.read(), file=sys.stderr)
                raise
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    for filename in ("Caddyfile", "Caddyfile.existing", "Caddyfile.easypanel"):
        check_config(sys.argv[1], root / "deploy" / "vps" / filename)
