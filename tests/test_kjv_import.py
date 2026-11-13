"""The committed KJV master text matches the 1769 canon and the 1,188 spans."""
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class KjvImportTest(unittest.TestCase):
    def test_check_passes(self):
        result = subprocess.run(
            [sys.executable, "scripts/import_kjv.py", "--check"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        self.assertIn("66 books", result.stdout)
        self.assertIn("1189 chapters", result.stdout)
        self.assertIn("31102 verses", result.stdout)
        self.assertIn("duplicates 0", result.stdout)
        self.assertIn("missing 0", result.stdout)
        self.assertIn("spans 1188", result.stdout)


if __name__ == "__main__":
    unittest.main()
