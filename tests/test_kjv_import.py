"""Provenance is pinned, and a fetch validates the 1769 canon without committing it."""
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class KjvImportTest(unittest.TestCase):
    def test_provenance_and_versification(self):
        source = json.loads((ROOT / "scripts/kjv_source.json").read_text())
        verses = json.loads((ROOT / "scripts/kjv_versification.json").read_text())
        self.assertEqual(source["source_sha256"], "f0b09dc49dfb97bb84f03aae1fbf026485048c3cab31a7a41017e2d86ac1d11c")
        self.assertEqual(len(verses["books"]), 66)
        self.assertEqual(verses["verses"], 31102)
        self.assertEqual(sum(item["verses"] for item in verses["books"]), 31102)
        result = subprocess.run(
            [sys.executable, "scripts/import_kjv.py", "--provenance"],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)

    def test_fetch_validates_and_builds_spans(self):
        result = subprocess.run(
            [sys.executable, "scripts/import_kjv.py", "--fetch"],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        self.assertIn("31102", result.stdout)
        self.assertIn("spans", result.stdout)
        spans_path = ROOT / "api" / "_lib" / "kjv-spans.generated.json"
        spans = json.loads(spans_path.read_text())
        self.assertEqual(spans["passageCount"], 1188)
        self.assertEqual(len(spans["passages"]), 1188)
        promises = json.loads(
            __import__("re").search(
                r"window\.GODS_PROMISES_DATA\s*=\s*(\{.*\})\s*;\s*$",
                (ROOT / "promises-data.js").read_text(),
                __import__("re").S,
            ).group(1)
        )["promises"]
        self.assertEqual(set(spans["passages"]), {item["id"] for item in promises})
        self.assertTrue(spans["passages"]["jhn-3-16-17"].startswith("For God so loved the world"))


if __name__ == "__main__":
    unittest.main()
