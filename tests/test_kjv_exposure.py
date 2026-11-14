"""The exposure guard passes on this checkout and fails on planted copies.

Planted copies use synthetic archaic sentences, not scripture. A separate
local run against the historical archive is recorded in the audit and is
not committed.
"""
from __future__ import annotations

import gzip
import io
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "scripts" / "check_kjv_exposure.py"
SYNTHETIC = (
    "Thou shalt keep the sentinel gate, and thee I charge, and thy watchers hath "
    "saith unto the keepers, ye shall not move the mark. "
) * 12


def run_check(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(CHECK), *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


class ExposureGuardTests(unittest.TestCase):
    def test_tracked_checkout_passes(self):
        result = run_check("--git")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("passed", result.stdout)

    def test_short_citation_and_web_wording_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "note.js").write_text(
                'const cite = "For God so loved the world";\n'
                'const web = "In nothing be anxious, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.";\n',
                encoding="utf-8",
            )
            result = run_check("--root", str(root))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_synthetic_copies_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "renamed-notes.txt").write_text(SYNTHETIC, encoding="utf-8")
            result = run_check("--root", str(root))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("archaic-density", result.stdout)

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "bundle.bin").write_bytes(gzip.compress(SYNTHETIC.encode("utf-8")))
            result = run_check("--root", str(root))
            self.assertNotEqual(result.returncode, 0, result.stdout)
            self.assertIn("gzip", result.stdout)

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as archive:
                archive.writestr("inside.txt", SYNTHETIC)
            (root / "pack.zip").write_bytes(buffer.getvalue())
            result = run_check("--root", str(root))
            self.assertNotEqual(result.returncode, 0, result.stdout)
            self.assertIn("zip", result.stdout)

        import base64
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            encoded = base64.b64encode(SYNTHETIC.encode("utf-8")).decode("ascii")
            (root / "asset.js").write_text("window.PAYLOAD = '" + encoded + "';\n", encoding="utf-8")
            result = run_check("--root", str(root), "--public")
            self.assertNotEqual(result.returncode, 0, result.stdout)
            self.assertIn("b64", result.stdout)


if __name__ == "__main__":
    unittest.main()
