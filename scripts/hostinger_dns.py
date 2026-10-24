"""Host-only Hostinger DNS integration. No provider credentials enter the app."""
import json
import os
from pathlib import Path
import re
import stat
import time
import urllib.error
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ZoneUnavailable(ValueError):
    pass


class PreparationActionRequired(ValueError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def read_token():
    path = Path(os.environ.get('HOSTINGER_API_TOKEN_FILE', '/etc/brilliancy-hostinger.token'))
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError('Hostinger token file must be a regular root-owned file with mode 600.')
    token = path.read_text().strip()
    if not token or len(token) > 8192 or any(c.isspace() for c in token):
        raise ValueError('Hostinger token file is empty or invalid.')
    return token


def configured():
    try:
        read_token()
        return True
    except (OSError, ValueError):
        return False


def root_for(row):
    root = row.get('verification_hostname', '')
    if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,63}', root) or row['hostname'] != 'www.' + root or row.get('aliases') != [root]:
        raise ValueError('Automatic DNS setup supports a registered root domain and its www address. Use manual DNS instructions for other names.')
    return root


def request(root, method='GET', payload=None):
    if not re.fullmatch(r'[a-z0-9.-]+', root):
        raise ValueError('Invalid DNS zone.')
    return api_request('/api/dns/v1/zones/' + root, method, payload)


def api_request(path, method='GET', payload=None):
    # Internal callers use fixed provider paths; never accept a URL from a draft.
    req = urllib.request.Request('https://developers.hostinger.com' + path,
        method=method, data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Authorization': 'Bearer ' + read_token(), 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Brilliancy-Domain-Setup/1.0'})
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=20) as response:
            data = response.read(2 * 1024 * 1024 + 1)
            if len(data) > 2 * 1024 * 1024:
                raise ValueError('Hostinger DNS response is too large.')
            return json.loads(data)
    except urllib.error.HTTPError as error:
        # Provider bodies may contain account details; never expose/log them.
        if error.code in (401, 403):
            raise ValueError('Hostinger access was rejected. Check the token and domain access.') from None
        if error.code == 404:
            raise ZoneUnavailable('This DNS zone is not accessible in the connected Hostinger account.') from None
        if error.code == 429:
            raise ValueError('Hostinger is temporarily rate limiting requests. Retry preparation later.') from None
        raise ValueError('Hostinger could not complete this DNS request. Check its service status and retry.') from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise ValueError('Hostinger could not be reached securely. Retry later.') from None


def check_registration(root):
    label, tld = root.rsplit('.', 1)
    result = api_request('/api/domains/v1/availability', 'POST', {
        'domain': label, 'tlds': [tld], 'with_alternatives': False,
    })
    matches = [item for item in result if isinstance(item, dict) and item.get('domain') == root] if isinstance(result, list) else []
    if len(matches) != 1 or not isinstance(matches[0].get('is_available'), bool):
        raise ValueError('Registration could not be checked. Retry Prepare domain later; no DNS records were changed.')
    if matches[0]['is_available']:
        raise PreparationActionRequired('purchase_required',
            f'{root} needs to be purchased before setup. Hostinger reports it is available for registration. Purchase it with your registrar, then select Prepare domain again. Adding a name here does not buy it.')


def dns_setup_required():
    return PreparationActionRequired('dns_setup_required',
        'This domain is not available to register, but its DNS zone is not accessible through the connected Hostinger account. If you own it, add it once in Hostinger DNS Manager, then retry Prepare domain. Keep its current nameservers and website records unchanged; external DNS needs manual TXT verification.')


def zone(root):
    records = request(root)
    if not isinstance(records, list) or any(not isinstance(r, dict) or not isinstance(r.get('records'), list) or not isinstance(r.get('name'), str) or not isinstance(r.get('type'), str) for r in records):
        raise ValueError('Unexpected Hostinger DNS response; no records were changed.')
    return records


def snapshot(root, records):
    folder = Path(os.environ.get('HOSTINGER_DNS_BACKUP_DIR', '/var/lib/brilliancy-domains/dns-backups'))
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = folder / f'{root}-{time.time_ns()}.json'
    with open(target, 'x', opener=lambda p, flags: os.open(p, flags, 0o600)) as stream:
        json.dump({'domain': root, 'records': records, 'createdAt': time.time()}, stream)


def name(record, root):
    value = record['name'].lower().rstrip('.')
    return '@' if value in ('@', root) else value.removesuffix('.' + root)


def contents(record):
    return [str(item.get('content', '')).strip('"').rstrip('.') for item in record['records']]


def prepare(row):
    root = root_for(row)
    try:
        records = zone(root)
    except ZoneUnavailable:
        check_registration(root)
        raise dns_setup_required() from None
    # Hostinger can return an empty list for a domain missing from the account.
    # Availability is a lookup only: never call purchase/setup/nameserver APIs.
    if not records:
        check_registration(root)
    proof = row['verification_token']
    if any(name(r, root) == '_brilliancy' and r['type'] == 'CNAME' for r in records):
        raise ValueError('The ownership name has a conflicting CNAME. Ask the hosting administrator to review it.')
    if any(name(r, root) == '_brilliancy' and r['type'] == 'TXT' and proof in contents(r) for r in records):
        return
    snapshot(root, records)
    # Preserve all values in this TXT record set as well as unrelated records.
    existing = [r for r in records if name(r, root) == '_brilliancy' and r['type'] == 'TXT']
    values = [value for record in existing for value in record['records']]
    try:
        request(root, 'PUT', {'overwrite': False, 'zone': [{'name': '_brilliancy', 'type': 'TXT', 'ttl': existing[0].get('ttl', 300) if existing else 300, 'records': [*values, {'content': proof}]}]})
    except ZoneUnavailable:
        raise dns_setup_required() from None


def launch_allowed(row):
    root = root_for(row)
    allowed = {item.strip() for item in os.environ.get('BRILLIANCY_GO_LIVE_DOMAINS', '').split(',') if item.strip()}
    if root not in allowed:
        raise ValueError('Go live is paused for this domain. A hosting administrator must approve it after review.')


def connect_dns(row, expected_ip):
    launch_allowed(row)
    root = root_for(row)
    records = zone(root)
    # Never silently repoint an existing website or remove IPv6/email records.
    for record in records:
        host = name(record, root)
        if host not in ('@', 'www'):
            continue
        if record['type'] in ('AAAA', 'CNAME', 'A'):
            compatible = (host == '@' and record['type'] == 'A' and contents(record) == [expected_ip]) or (host == 'www' and record['type'] == 'CNAME' and contents(record) == [root])
            if not compatible:
                raise ValueError('Existing website DNS needs a reviewed migration. No website records were changed.')
    snapshot(root, records)
    request(root, 'PUT', {'overwrite': False, 'zone': [
        {'name': '@', 'type': 'A', 'ttl': 300, 'records': [{'content': expected_ip}]},
        {'name': 'www', 'type': 'CNAME', 'ttl': 300, 'records': [{'content': root}]},
    ]})
