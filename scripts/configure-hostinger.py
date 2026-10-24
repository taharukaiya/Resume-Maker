"""Run interactively as root. Never pass the token in argv, chat or shell history."""
import getpass
import os
from pathlib import Path
import re
import sys
import warnings

if os.name != 'posix' or os.geteuid() != 0 or not sys.stdin.isatty():
    raise SystemExit('Run interactively in the VPS terminal as root.')
warnings.simplefilter('error', getpass.GetPassWarning)
token = getpass.getpass('Paste Hostinger API token (hidden): ').strip()
if not token or len(token) > 8192 or re.search(r'\s', token):
    raise SystemExit('Invalid token; nothing saved.')
target = Path('/etc/brilliancy-hostinger.token')
pending = Path('/etc/brilliancy-hostinger.token.pending')
fd = os.open(pending, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
try:
    with os.fdopen(fd, 'w') as stream:
        stream.write(token + '\n')
        stream.flush()
        os.fsync(stream.fileno())
    pending.replace(target)
finally:
    pending.unlink(missing_ok=True)
print('Token saved privately on this host. No DNS or website routing changed.')
print('Preparation will check provider access. Go live remains subject to separate domain approval.')
