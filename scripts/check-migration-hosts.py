"""Read-only, bounded HEAD checks of the exact reviewed researchby inventory."""
import concurrent.futures
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

root = pathlib.Path(__file__).resolve().parent.parent
domains = re.findall(r'^researchby[a-z0-9-]+\.com$', (root / 'docs/PRODUCTION_READINESS.md').read_text(), re.M)
assert len(domains) == 29 and len(set(domains)) == 29, 'Review the domain inventory before running'

def check(domain):
    start = time.monotonic()
    try:
        with urllib.request.urlopen(urllib.request.Request('https://' + domain, method='HEAD'), timeout=12) as response:
            return {'domain': domain, 'status': response.status, 'url': response.url, 'seconds': round(time.monotonic() - start, 2)}
    except urllib.error.HTTPError as error:
        return {'domain': domain, 'status': error.code, 'url': error.url}
    except Exception as error:
        return {'domain': domain, 'error': str(error)}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    result = list(pool.map(check, [host for domain in domains for host in (domain, 'www.' + domain)]))
target = root / '.test-data' / pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'legacy-health.json').name
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(result, indent=2))
print(json.dumps({'checked': len(result), 'http_success': sum(200 <= item.get('status', 0) < 400 for item in result), 'output': str(target)}, indent=2))
if any(not 200 <= item.get('status', 0) < 400 for item in result):
    sys.exit(1)
