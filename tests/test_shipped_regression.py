"""Independent migration guard against the actual shipped a0e3974 JS payload.

Only actual output generation uses the builder. Expected records are decoded from
historical shipped JS without load_records, WEB-source joins, or builder helpers.
"""
import contextlib
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_site

MANIFEST = json.loads((ROOT / "tests/fixtures/shipped-baseline.json").read_text())


def parse_shipped_js(raw):
    text = raw.decode("utf-8")
    match = re.search(r"window\.GODS_PROMISES_DATA\s*=\s*", text)
    if not match:
        raise AssertionError("Missing shipped data assignment")
    payload, end = json.JSONDecoder().raw_decode(text[match.end():])
    if text[match.end() + end:].strip() != ";":
        raise AssertionError("Unexpected trailing executable content in shipped data")
    return payload


def old_shipped_source():
    result = subprocess.run(["git", "show", MANIFEST["baseline_commit"] + ":" + MANIFEST["shipped_path"]],
                            cwd=ROOT, capture_output=True, check=False)
    if result.returncode == 0:
        raw = result.stdout
    else:
        # Actions uses a shallow checkout. Its still-unchanged shipped source is a
        # valid historical baseline ONLY if the pinned historical byte hash matches.
        raw = (ROOT / MANIFEST["shipped_path"]).read_bytes()
    if hashlib.sha256(raw).hexdigest() != MANIFEST["shipped_sha256"]:
        raise AssertionError("Historical payload unavailable or changed: fetch the pinned baseline commit; do not regenerate expected data from the builder")
    return raw


class VerseText(HTMLParser):
    def __init__(self, content):
        super().__init__(convert_charrefs=True)
        self.current = None
        self.parts = []
        self.values = {}
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        if tag in ("h1", "blockquote"):
            self.current = tag
            self.parts = []
        elif dict(attrs).get("class") == "card-explain-text":
            self.current = "explanation"
            self.parts = []

    def handle_data(self, data):
        if self.current:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if self.current and (tag == self.current or (tag == "p" and self.current == "explanation")):
            self.values[self.current] = "".join(self.parts)
            self.current = None


class ShippedRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with contextlib.redirect_stdout(io.StringIO()):
            build_site.build("production")
        cls.old = parse_shipped_js(old_shipped_source())
        cls.new = parse_shipped_js((ROOT / "dist/promises-data.js").read_bytes())

    def test_all_shipped_fields_order_and_translation_metadata_unchanged(self):
        old_entries, new_entries = self.old["promises"], self.new["promises"]
        self.assertEqual(len(old_entries), MANIFEST["entries"])
        self.assertEqual(len(new_entries), len(old_entries))
        self.assertEqual([e["id"] for e in new_entries], [e["id"] for e in old_entries], "IDs/order drift")
        changed = {}
        for previous, current in zip(old_entries, new_entries):
            self.assertEqual(set(previous), set(MANIFEST["entry_fields"]))
            self.assertEqual(set(current), set(previous))
            for field in previous:
                if current[field] != previous[field]:
                    changed.setdefault(field, []).append(previous["id"])
        self.assertEqual(changed, {}, f"Shipped data drift, review instead of silently accepting: {changed}")
        previous_metadata = {k: v for k, v in self.old.items() if k != "promises"}
        current_metadata = {k: v for k, v in self.new.items() if k != "promises"}
        self.assertEqual(set(previous_metadata), set(MANIFEST["metadata_fields"]))
        self.assertEqual(current_metadata, previous_metadata)
        # Independently parsed JSON download must also match the old JS payload.
        self.assertEqual(json.loads((ROOT / "dist/promises.json").read_text()), self.old)
        print(f"Independent a0e3974 shipped regression: {len(old_entries)} records, {len(MANIFEST['entry_fields'])} fields each, IDs/order and all {len(previous_metadata)} metadata fields exact; 0 changed WEB texts / references / themes / feelings / search terms / translation metadata")

    def test_static_text_matches_old_shipped_web_and_current_reviewed_explanations(self):
        explanations = json.loads((ROOT / "data/explanations.json").read_text())
        for old_entry in self.old["promises"]:
            with self.subTest(id=old_entry["id"]):
                path = ROOT / "dist/verses" / (old_entry["id"] + ".html")
                actual = VerseText(path.read_text()).values
                self.assertEqual(actual["h1"], old_entry["reference"])
                self.assertEqual(actual["blockquote"], old_entry["text"])
                self.assertEqual(actual["explanation"], explanations[old_entry["id"]])
        self.assertEqual(len(explanations), len(self.old["promises"]))

    def test_shipped_auth_search_versions_and_analytics_bytes_preserved(self):
        for relative, digest in MANIFEST["unchanged_script_sha256"].items():
            with self.subTest(script=relative):
                self.assertEqual(hashlib.sha256((ROOT / relative).read_bytes()).hexdigest(), digest,
                                 "Auth/search/translation behavior source changed from shipped baseline")
                self.assertEqual((ROOT / "dist" / relative).read_bytes(), (ROOT / relative).read_bytes())
        # App scripts are copied exactly. js/supabase-public.js is rewritten at
        # build time with the public project URL and anon key, so it is not a
        # byte copy of the empty placeholder.
        generated = ROOT / "js" / "supabase-public.js"
        for source in [ROOT / "app.js", *sorted((ROOT / "js").glob("*.js"))]:
            if source == generated:
                continue
            self.assertEqual((ROOT / "dist" / source.relative_to(ROOT)).read_bytes(), source.read_bytes())
        public = (ROOT / "dist" / "js" / "supabase-public.js").read_text()
        self.assertIn("https://ixxeidpdgktzvcbucosq.supabase.co", public)
        self.assertNotIn("service_role", public)
        self.assertNotIn("SUPABASE_SERVICE_ROLE", public)
        self.assertIn(b"createClient", (ROOT / "dist" / "js" / "vendor" / "supabase.js").read_bytes())
        self.assertEqual((ROOT / "dist/styles.css").read_bytes(), (ROOT / "styles.css").read_bytes())
        print(f"Script preservation: {len(MANIFEST['unchanged_script_sha256'])} pinned app scripts; public Supabase config injected; search/analytics bytes unchanged")

    def test_shallow_checkout_fallback_is_pinned_not_builder_generated(self):
        unavailable = subprocess.CompletedProcess(args=[], returncode=128, stdout=b"", stderr=b"missing historical object")
        with mock.patch.object(subprocess, "run", return_value=unavailable):
            raw = old_shipped_source()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), MANIFEST["shipped_sha256"])
            with mock.patch.dict(MANIFEST, {"shipped_sha256": "0" * 64}):
                with self.assertRaisesRegex(AssertionError, "Historical payload"):
                    old_shipped_source()

    def test_nonbrowser_auth_search_translation_and_analytics_behavior(self):
        result = subprocess.run(["node", "tests/behavior-regression.test.js"], cwd=ROOT,
                                capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        print(result.stdout.strip())


if __name__ == "__main__":
    unittest.main()
