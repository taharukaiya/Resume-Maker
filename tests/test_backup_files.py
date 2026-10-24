"""Checksum verification must inspect restored bytes, never the original path."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

VERIFY = Path(__file__).resolve().parents[1] / 'deploy/vps/verify-backup-files.py'


class BackupFilesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.original = Path(self.temp.name) / 'original'
        self.restored = Path(self.temp.name) / 'restored'
        self.original.mkdir()
        lines = []
        for name in ['database.dump', 'files.tar.gz', 'config.tar.gz', 'certificates.tar.gz']:
            data = ('Synthetic ' + name).encode()
            (self.original / name).write_bytes(data)
            lines.append(hashlib.sha256(data).hexdigest() + '  ' + (self.original / name).as_posix())
        (self.original / 'SHA256SUMS').write_text('\n'.join(lines))
        (self.original / 'COMPLETE').touch()
        shutil.copytree(self.original, self.restored)

    def verify(self):
        return subprocess.run([sys.executable, str(VERIFY), str(self.restored)], capture_output=True).returncode

    def test_relocated_backup_without_original(self):
        shutil.rmtree(self.original)
        self.assertEqual(self.verify(), 0)

    def test_corrupt_restored_copy_fails_even_when_original_is_valid(self):
        (self.restored / 'files.tar.gz').write_text('corrupt')
        self.assertNotEqual(self.verify(), 0)

    def test_missing_archive(self):
        (self.restored / 'database.dump').unlink()
        self.assertNotEqual(self.verify(), 0)

    def test_incomplete(self):
        (self.restored / 'COMPLETE').unlink()
        self.assertNotEqual(self.verify(), 0)

    def test_missing_required_manifest_entry(self):
        manifest = self.restored / 'SHA256SUMS'
        manifest.write_text('\n'.join(manifest.read_text().splitlines()[1:]))
        self.assertNotEqual(self.verify(), 0)

    def test_unexpected_file(self):
        manifest = self.restored / 'SHA256SUMS'
        manifest.write_text(manifest.read_text() + '\n' + '0' * 64 + '  /etc/shadow')
        self.assertNotEqual(self.verify(), 0)


if __name__ == '__main__':
    unittest.main()
