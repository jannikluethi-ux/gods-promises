"""Run with: python3 -m unittest discover -s tests -p 'test_*.py'."""
import contextlib
from html.parser import HTMLParser
import io
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.error import HTTPError
from urllib.request import urlopen
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from urllib.parse import urlsplit, unquote
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_site as site


class Document(HTMLParser):
    def __init__(self, content):
        super().__init__(convert_charrefs=True)
        self.meta = []
        self.links = []
        self.anchors = []
        self.scripts = []
        self.assets = []
        self.tags = []
        self.attributes = []
        self.values = {}
        self.capture = []
        self.feed(content)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append(tag)
        self.attributes.append(attrs)
        if tag == "meta":
            self.meta.append(attrs)
        if tag == "link":
            self.links.append(attrs)
            if attrs.get("rel") == "stylesheet":
                self.assets.append(attrs["href"])
        if tag == "a" and "href" in attrs:
            self.anchors.append(attrs["href"])
        if tag == "script":
            self.scripts.append(attrs)
            if "src" in attrs:
                self.assets.append(attrs["src"])
        if tag in ("title", "h1", "blockquote") or attrs.get("class") == "card-explain-text":
            self.capture.append((tag, "explanation" if attrs.get("class") == "card-explain-text" else tag, []))

    def handle_data(self, data):
        for _, _, parts in self.capture:
            parts.append(data)

    def handle_endtag(self, tag):
        if self.capture and self.capture[-1][0] == tag:
            _, name, parts = self.capture.pop()
            self.values.setdefault(name, []).append("".join(parts))

    def metadata(self, name):
        return [m["content"] for m in self.meta if m.get("name", m.get("property")) == name]

    def canonical(self):
        return [link["href"] for link in self.links if link.get("rel") == "canonical"]


def target_path(output, href, current="index.html"):
    path = unquote(urlsplit(href).path)
    destination = output / path.lstrip("/") if path.startswith("/") else output / Path(current).parent / path
    if path.endswith("/") or not path:
        destination = destination / "index.html" if path else output / current
    return destination


class StaticSeoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with contextlib.redirect_stdout(io.StringIO()):
            cls.production = site.build("production")
            cls.migration = site.build("migration")
        cls.output = site.ROOT / "dist"
        _, cls.records = site.load_records()
        cls.books, cls.topics = site.groups_for(cls.records)
        cls.paths = site.public_paths(cls.records, cls.books, cls.topics)
        cls.documents = {str(p.relative_to(cls.output)): Document(p.read_text()) for p in cls.output.rglob("*.html")}

    def test_counts_and_exact_current_content(self):
        self.assertEqual(len(self.records), len(json.loads((site.ROOT / "data/explanations.json").read_text())))
        self.assertEqual(self.production["verses"], len(self.records))
        self.assertEqual(len(list((self.output / "verses").glob("*.html"))), len(self.records))
        for entry in self.records:
            with self.subTest(id=entry["id"]):
                doc = self.documents[f"verses/{entry['id']}.html"]
                self.assertEqual(doc.values["blockquote"], [entry["text"]])
                self.assertEqual(doc.values["explanation"], [entry["explanation"]])
                self.assertEqual(doc.values["h1"], [entry["reference"]])
                # JSON-LD plus exactly one deferred, content-hashed feedback widget script.
                # No analytics or any other executable script on static verse pages.
                self.assertTrue(doc.scripts)
                external = [s for s in doc.scripts if "src" in s]
                self.assertEqual(len(external), 1)
                self.assertRegex(external[0]["src"], r"^/js/feedback\.js\?v=[0-9a-f]{12}$")
                self.assertIn("defer", external[0])
                self.assertTrue(all(s.get("type") == "application/ld+json" for s in doc.scripts if "src" not in s))
                widgets = [a for a in doc.attributes if a.get("class") == "fb"]
                self.assertEqual(len(widgets), 1)
                self.assertEqual(widgets[0]["data-fb-verse"], entry["id"])
                self.assertEqual(widgets[0]["data-fb-version"], site.explain_version())
                self.assertEqual(widgets[0]["data-fb-source"], "verse_page")

    def test_metadata_unique_and_complete(self):
        titles, descriptions, canonicals, headings = set(), set(), set(), set()
        for name, doc in self.documents.items():
            with self.subTest(page=name):
                self.assertEqual(len(doc.values.get("h1", [])), 1)
                self.assertEqual(len(doc.values.get("title", [])), 1)
                self.assertNotIn(doc.values["h1"][0], headings)
                headings.add(doc.values["h1"][0])
                title = doc.values["title"][0]
                description = doc.metadata("description")
                self.assertEqual(len(description), 1)
                self.assertNotIn(title, titles)
                self.assertNotIn(description[0], descriptions)
                titles.add(title)
                descriptions.add(description[0])
                self.assertEqual(len(doc.canonical()), 1)
                url = doc.canonical()[0]
                self.assertNotIn(url, canonicals)
                canonicals.add(url)
                self.assertTrue(url.startswith(site.ORIGIN + "/"))
                self.assertNotIn("?", url)
                self.assertNotIn("#", url)
                self.assertEqual(doc.metadata("og:title"), [title])
                self.assertEqual(doc.metadata("og:description"), description)
                self.assertEqual(doc.metadata("og:url"), [url])
                self.assertEqual(doc.metadata("twitter:title"), [title])
                self.assertEqual(doc.metadata("twitter:description"), description)
                self.assertEqual(doc.metadata("twitter:card"), ["summary_large_image"])
                self.assertEqual(doc.metadata("og:image"), [site.ORIGIN + site.OG_IMAGE_PATH])
                self.assertEqual(doc.metadata("twitter:image"), [site.ORIGIN + site.OG_IMAGE_PATH])
                self.assertEqual(doc.metadata("og:image:width"), [str(site.OG_IMAGE_WIDTH)])
                self.assertEqual(doc.metadata("og:image:height"), [str(site.OG_IMAGE_HEIGHT)])

    def test_all_pages_reachable_by_ordinary_links_and_assets_exist(self):
        seen, pending = set(), ["index.html"]
        while pending:
            name = pending.pop()
            if name in seen:
                continue
            seen.add(name)
            doc = self.documents[name]
            for href in doc.anchors:
                parsed = urlsplit(href)
                if parsed.scheme or parsed.netloc or href.startswith("#"):
                    continue
                destination = target_path(self.output, href, name)
                self.assertTrue(destination.is_file(), f"Broken link: {name} -> {href}")
                relative = str(destination.relative_to(self.output))
                if relative in self.documents and relative not in seen:
                    pending.append(relative)
        for path in self.paths:
            self.assertIn(str(target_path(self.output, path).relative_to(self.output)), seen, path)
        for name, doc in self.documents.items():
            for href in doc.assets:
                if urlsplit(href).scheme:
                    continue
                self.assertTrue(target_path(self.output, href, name).is_file(), f"Missing asset: {name} -> {href}")
        print(f"Reachability: all {len(self.paths)} public URLs, including {len(self.records)} verses, linked from homepage; all local HTML links/assets resolve")

    def test_bounded_pagination_and_sitemap(self):
        namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        tree = ET.parse(self.output / "sitemap.xml")
        urls = [n.text for n in tree.findall(".//s:loc", namespace)]
        self.assertEqual(set(urls), {site.canonical(p) for p in self.paths})
        self.assertEqual(len(urls), len(set(urls)))
        self.assertFalse(tree.findall(".//s:lastmod", namespace))
        self.assertFalse(tree.findall(".//s:priority", namespace))
        for name in site.PRIVATE_PAGES:
            self.assertNotIn(site.ORIGIN + "/" + name, urls)
            self.assertEqual(self.documents[name].metadata("robots"), ["noindex, follow"])
        robots = (self.output / "robots.txt").read_text()
        self.assertIn("Allow: /", robots)
        self.assertNotIn("Disallow", robots, "Crawlers must be able to read login/profile noindex")
        self.assertIn(site.ORIGIN + "/sitemap.xml", robots)
        for name, doc in self.documents.items():
            if name.startswith(("browse/books/", "browse/topics/")):
                verse_links = [href for href in doc.anchors if href.startswith("/verses/")]
                self.assertGreater(len(verse_links), 0)
                self.assertLessEqual(len(verse_links), site.PAGE_SIZE)
                self.assertEqual(len(verse_links), len(set(verse_links)))

    def test_real_website_schema_only(self):
        source = (self.output / "index.html").read_text()
        marker = '<script type="application/ld+json">'
        data = json.loads(source.split(marker)[1].split("</script>")[0])
        self.assertEqual(data, site.website_json_ld())
        self.assertNotIn("SearchAction", source)
        self.assertEqual((self.output / "index.html").read_text().count(marker), 1)
        # Homepage title/description tightened for search snippets.
        home = self.documents["index.html"]
        self.assertEqual(home.values["title"], [site.HOME_TITLE])
        self.assertEqual(home.metadata("description"), [site.HOME_DESCRIPTION])
        # Verse pages carry Article JSON-LD with the truncated explanation description.
        verse = self.documents["verses/gen-1-28.html"]
        entry = next(e for e in self.records if e["id"] == "gen-1-28")
        expected_desc = site.meta_description(f"{entry['reference']}. {entry['explanation']}")
        self.assertEqual(verse.values["title"], [f"{entry['reference']} — His Promise Daily"])
        self.assertEqual(verse.metadata("description"), [expected_desc])
        self.assertEqual(verse.metadata("og:type"), ["article"])
        verse_html = (self.output / "verses/gen-1-28.html").read_text()
        verse_data = json.loads(verse_html.split(marker)[1].split("</script>")[0])
        self.assertEqual(verse_data["@type"], "Article")
        self.assertEqual(verse_data["headline"], f"{entry['reference']} — His Promise Daily")
        self.assertEqual(verse_data["description"], expected_desc)
        self.assertEqual(verse_data["url"], site.canonical(site.verse_path(entry)))
        self.assertEqual(verse_data["inLanguage"], "en")
        json.loads(json.dumps(verse_data))  # validates JSON round-trip
        self.assertTrue((self.output / "og-image.png").is_file())

    def test_migration_is_only_stubs_and_targets_production(self):
        output = site.ROOT / "pages-dist"
        files = list(output.rglob("*"))
        self.assertFalse(any(p.suffix in (".js", ".css", ".json") for p in files))
        expected_paths = self.paths + ["/" + p for p in site.PRIVATE_PAGES]
        for path in expected_paths:
            text = target_path(output, path).read_text()
            doc = Document(text)
            self.assertEqual(doc.canonical(), [site.canonical(path)])
            self.assertEqual(doc.anchors, [site.canonical(path)])
            self.assertFalse(doc.scripts)
            if path.lstrip("/") in site.PRIVATE_PAGES:
                self.assertEqual(doc.metadata("robots"), ["noindex, follow"])
            self.assertEqual([m["content"] for m in doc.meta if m.get("http-equiv") == "refresh"], ["0; url=" + site.canonical(path)])
            self.assertNotIn("vercel.app", text)
            self.assertNotIn("github.io", text)
            self.assertNotIn("GODS_PROMISES_DATA", text)
        self.assertEqual(len(list(output.rglob("*.html"))), len(expected_paths) + 1)
        self.assertFalse((self.output / "404.html").exists())
        self.assertNotIn("http-equiv", (output / "404.html").read_text())
        self.assertTrue((output / ".nojekyll").exists())
        workflow = (site.ROOT / ".github/workflows/pages-migration.yml").read_text()
        self.assertIn("path: pages-dist", workflow)
        self.assertNotIn("path: dist", workflow)
        config = json.loads((site.ROOT / "vercel.json").read_text())
        self.assertEqual(config["outputDirectory"], "dist")
        self.assertIn("--target production", config["buildCommand"])

    def test_escaping_and_xml_json_round_trip(self):
        malicious = '\" onmouseover=\"x <img src=x onerror=alert(1)> & </script>\u2028'
        entry = dict(self.records[0], reference=malicious, explanation=malicious, text=malicious)
        text = site.verse_page(entry, {entry["book"]: [entry]})
        doc = Document(text)
        self.assertEqual(doc.values["blockquote"], [malicious])
        self.assertEqual(doc.values["explanation"], [malicious])
        self.assertNotIn("img", doc.tags)
        self.assertFalse(any("onmouseover" in attrs or "onerror" in attrs for attrs in doc.attributes))
        self.assertEqual(doc.metadata("description"), [site.meta_description(f"{malicious}. {malicious}")])
        encoded = site.json_script({"name": malicious})
        self.assertNotIn("</script>", encoded)
        self.assertNotIn("<", encoded)
        self.assertNotIn("\u2028", encoded)
        self.assertEqual(json.loads(encoded), {"name": malicious})
        xml = site.sitemap(['/verses/a&b".html'])
        self.assertIn("&amp;", xml)
        self.assertEqual(ET.fromstring(xml)[0][0].text, site.ORIGIN + '/verses/a&b".html')

    def test_build_uses_latest_sources_and_validates_counts(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in site.SOURCE_PAGES + ("styles.css", "browse.css", "app.js", "promises.json", "og-image.png"):
                shutil.copy2(site.ROOT / name, root / name)
            shutil.copytree(site.ROOT / "js", root / "js")
            (root / "data").mkdir()
            (root / "scripts").mkdir()
            source = json.loads((site.ROOT / "promises.json").read_text())
            # No hardcoded 1188-row snapshot: build a smaller valid current catalog.
            source["promises"] = source["promises"][:2]
            (root / "promises.json").write_text(json.dumps(source))
            ids = [entry["id"] for entry in source["promises"]]
            explanations = {ids[0]: "New reviewed explanation < > & \" exact.", ids[1]: "Second explanation."}
            (root / "data/explanations.json").write_text(json.dumps(explanations))
            web = json.loads((site.ROOT / "scripts/web_index.json").read_text())
            web["Genesis|1|28"] = "Latest WEB source text & <literal>."
            (root / "scripts/web_index.json").write_text(json.dumps(web))
            with contextlib.redirect_stdout(io.StringIO()):
                summary = site.build("production", root)
            self.assertEqual(summary["verses"], 2)
            doc = Document((root / "dist/verses/gen-1-28.html").read_text())
            self.assertEqual(doc.values["explanation"], [explanations[ids[0]]])
            self.assertEqual(doc.values["blockquote"], [web["Genesis|1|28"]])
            current_payload = json.loads((root / "dist/promises.json").read_text())
            self.assertEqual(current_payload["coverageNotes"]["total"], 2)
            # Rebuilding must refresh explanations and remove orphaned generated pages.
            explanations[ids[0]] = "Changed again in the next commit."
            explanations.pop(ids[1])
            source["promises"] = source["promises"][:1]
            (root / "promises.json").write_text(json.dumps(source))
            (root / "data/explanations.json").write_text(json.dumps(explanations))
            with contextlib.redirect_stdout(io.StringIO()):
                site.build("production", root)
            doc = Document((root / "dist/verses/gen-1-28.html").read_text())
            self.assertEqual(doc.values["explanation"], [explanations[ids[0]]])
            self.assertFalse((root / "dist/verses/gen-1-29.html").exists())
            source["promises"].append(source["promises"][0])
            (root / "promises.json").write_text(json.dumps(source))
            with self.assertRaisesRegex(ValueError, "duplicate"):
                site.load_records(root)
            source["promises"] = source["promises"][:1]
            (root / "promises.json").write_text(json.dumps(source))
            (root / "data/explanations.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "IDs"):
                site.load_records(root)

    def test_local_http_content_types_and_missing_page(self):
        class QuietHandler(SimpleHTTPRequestHandler):
            def log_message(self, *args):
                pass
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(self.output)))
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}"
            samples = [("/", "text/html"), ("/browse/", "text/html"),
                       ("/browse/books/psalms-2.html", "text/html"),
                       ("/browse/topics/hope.html", "text/html"),
                       ("/verses/gen-1-28.html", "text/html"),
                       ("/styles.css", "text/css"), ("/browse.css", "text/css"),
                       ("/app.js", "javascript"), ("/data/explanations.json", "application/json"),
                       ("/og-image.png", "image/png"),
                       ("/robots.txt", "text/plain"), ("/sitemap.xml", "xml")]
            for path, content_type in samples:
                with urlopen(base + path, timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    self.assertIn(content_type, response.headers["Content-Type"])
                    self.assertTrue(response.read())
            with self.assertRaises(HTTPError) as error:
                urlopen(base + "/verses/does-not-exist.html", timeout=5)
            self.assertEqual(error.exception.code, 404)
            error.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_reproducible_build_without_wall_clock_dates(self):
        first = {str(p.relative_to(self.output)): p.read_bytes() for p in self.output.rglob("*") if p.is_file()}
        with contextlib.redirect_stdout(io.StringIO()):
            site.build("production")
        second = {str(p.relative_to(self.output)): p.read_bytes() for p in self.output.rglob("*") if p.is_file()}
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
