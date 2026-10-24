"""Verify bytes inside this backup, even after restoring to another directory."""
import hashlib
import pathlib
import sys

root = pathlib.Path(sys.argv[1]).resolve(strict=True)
required = {'database.dump', 'files.tar.gz', 'config.tar.gz', 'certificates.tar.gz'}
allowed = required | {'SIZES', 'studio-routing.tar.gz', 'legacy-www-routing.tar.gz'}
seen = set()
assert (root / 'COMPLETE').is_file(), 'Backup is incomplete'
for line in (root / 'SHA256SUMS').read_text().splitlines():
    digest, stored_path = line.split(maxsplit=1)
    name = pathlib.PurePosixPath(stored_path.lstrip('*')).name
    assert name in allowed and name not in seen, 'Unexpected/duplicate manifest entry'
    item = root / name
    assert not item.is_symlink() and item.is_file(), 'Missing backup file'
    with item.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    assert actual == digest, f'Checksum mismatch: {name}'
    seen.add(name)
assert required <= seen, 'Manifest is missing required archives'
print(f'PASS: {len(seen)} backup checksums verified at the supplied location')
