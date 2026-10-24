"""Real encryption/restore test with synthetic data and an explicitly local repo."""
import hashlib
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile

executable = str(Path(sys.argv[1]).resolve(strict=True))
root = Path(__file__).resolve().parents[1]
(root / '.test-data').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='restic-roundtrip-', dir=root / '.test-data') as temporary:
    scratch = Path(temporary)
    source = scratch / 'source'
    source.mkdir()
    files = {name: secrets.token_bytes(65536) for name in ['database.dump', 'files.tar.gz', 'config.tar.gz', 'certificates.tar.gz']}
    for name, data in files.items():
        (source / name).write_bytes(data)
    (source / 'SHA256SUMS').write_text('\n'.join(hashlib.sha256(data).hexdigest() + '  ' + (source / name).as_posix() for name, data in files.items()))
    (source / 'COMPLETE').touch()
    env = {k: v for k, v in os.environ.items() if not k.startswith(('RESTIC_', 'AWS_'))}
    env['RESTIC_PASSWORD'] = secrets.token_urlsafe(48)
    env['RESTIC_CACHE_DIR'] = str(scratch / 'cache')

    def restic(*args, environment=None, success=True, directory=root):
        result = subprocess.run([executable, '--repo', str(scratch / 'repository'), *args], env=environment or env, cwd=directory, capture_output=True, text=True)
        if success and result.returncode:
            raise RuntimeError(result.stderr)
        return result

    restic('init')
    # Back up contents, avoiding ancestor directory ACLs on Windows.
    restic('backup', '.', directory=source)
    restic('check', '--read-data')
    wrong = dict(env, RESTIC_PASSWORD=secrets.token_urlsafe(48))
    assert restic('snapshots', environment=wrong, success=False).returncode != 0, 'Wrong password unexpectedly worked'
    shutil.rmtree(source)
    restic('restore', 'latest', '--target', str(scratch / 'restore'))
    manifests = list((scratch / 'restore').rglob('SHA256SUMS'))
    assert len(manifests) == 1
    subprocess.run([sys.executable, str(root / 'deploy/vps/verify-backup-files.py'), str(manifests[0].parent)], check=True)
    print('PASS: encrypted snapshot, full data check, wrong-password rejection and restored bytes verified after source removal. Local synthetic repository only; S3 transport not tested.')
