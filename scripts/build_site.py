#!/usr/bin/env python3
"""Dependency-free static build. Production and legacy migration NEVER share output.

Each build joins current catalog spans, WEB source and reviewed explanations.
No generated HTML is committed; missing/duplicate source entries fail the build.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from copy import deepcopy
from functools import lru_cache
import hashlib
from html import escape
import json
import os
from pathlib import Path
import re
import shutil
import sys
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://hispromisedaily.com"
# Public project URL for his-promise-daily (Zurich). Overridden by SUPABASE_URL when set.
# The anon/publishable key is never hardcoded; the service-role key is never read here.
PUBLIC_SUPABASE_URL = "https://ixxeidpdgktzvcbucosq.supabase.co"
NAME = "His Promise Daily"
PAGE_SIZE = 30
SOURCE_PAGES = ("index.html", "terms.html", "privacy.html", "contact.html",
                "support.html", "login.html", "me.html")
PRIVATE_PAGES = {"login.html", "me.html"}
HOME_TITLE = "His Promise Daily – God's promises in the Bible, one verse a day"
HOME_DESCRIPTION = ("A free daily Bible verse and searchable catalog of God's promises in Scripture "
                    "(World English Bible), with short explanations by book, feeling, and topic.")
OG_IMAGE_PATH = "/og-image.png"
OG_IMAGE_WIDTH = 1200
OG_IMAGE_HEIGHT = 630
SHARE_IMAGE_WIDTH = 1080
SHARE_IMAGE_HEIGHT = 1080
META_DESCRIPTION_LIMIT = 155


def html(value):
    """Escape text and quoted attributes, including both quote types."""
    return escape(str(value), quote=True)


def json_script(value):
    # JSON is embedded in raw HTML script text: prevent </script> and Unicode separators.
    return (json.dumps(value, ensure_ascii=False).replace("&", "\\u0026")
            .replace("<", "\\u003c").replace(">", "\\u003e")
            .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def slug(value):
    result = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not result:
        raise ValueError(f"Empty URL slug: {value!r}")
    return result


def canonical(path):
    if not path.startswith("/") or "?" in path or "#" in path or "//" in path:
        raise ValueError(f"Invalid public path: {path}")
    return ORIGIN + path


def meta_description(text, limit=META_DESCRIPTION_LIMIT):
    """One-line meta description, truncated on a word boundary without rewriting sense."""
    cleaned = " ".join(str(text).split())
    if len(cleaned) <= limit:
        return cleaned
    cut = cleaned[: max(1, limit - 1)].rsplit(" ", 1)[0].rstrip(" ,.;:")
    if not cut:
        cut = cleaned[: max(1, limit - 1)]
    return cut + "…"


def publisher_org():
    return {"@type": "Organization", "name": NAME, "url": ORIGIN + "/"}


def website_json_ld():
    # Homepage search is client-side only (no stable query-URL template), so omit SearchAction.
    return {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebSite", "name": NAME, "url": ORIGIN + "/", "publisher": publisher_org()},
            {**publisher_org(), "@id": ORIGIN + "/#organization"},
        ],
    }


def share_image_path(entry, root=ROOT):
    """Public PNG for one verse. The query does not change the verse page URL."""
    return f"/api/og?id={entry['id']}&v={explain_version(root)}"


def absolute_url(path):
    if not path.startswith("/") or "#" in path or path.startswith("//"):
        raise ValueError(f"Invalid public path: {path}")
    return ORIGIN + path


def verse_json_ld(entry, title, description, path, image=None):
    data = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "name": entry["reference"],
        "description": description,
        "url": canonical(path),
        "inLanguage": "en",
        "isPartOf": {"@type": "WebSite", "name": NAME, "url": ORIGIN + "/"},
        "publisher": publisher_org(),
    }
    if image:
        data["image"] = image
    return data



@lru_cache(maxsize=None)
def explain_version(root=ROOT):
    """The explanation cache/version id the live cards use (single source: js/ui-shared.js)."""
    source = (root / "js/ui-shared.js").read_text(encoding="utf-8")
    match = re.search(r'const EXPLAIN_VERSION = "([a-z0-9][a-z0-9._-]{0,39})"', source)
    if not match:
        raise ValueError("EXPLAIN_VERSION not found in js/ui-shared.js")
    return match.group(1)


def asset_digest(root, name):
    return hashlib.sha256((root / name).read_bytes()).hexdigest()[:12]


def load_records(root=ROOT):
    catalog = json.loads((root / "promises.json").read_text(encoding="utf-8"))
    records = deepcopy(catalog["promises"])
    explanations = json.loads((root / "data/explanations.json").read_text(encoding="utf-8"))
    web = json.loads((root / "scripts/web_index.json").read_text(encoding="utf-8"))
    ids = [entry["id"] for entry in records]
    if not records or len(ids) != len(set(ids)):
        raise ValueError("Empty catalog or duplicate promise IDs")
    if set(ids) != set(explanations):
        raise ValueError("Explanation IDs and current catalog IDs must match exactly")
    for entry in records:
        if not re.fullmatch(r"[a-z0-9]+(?:-[0-9]+){2,3}", entry["id"]):
            raise ValueError(f"Unsafe promise ID: {entry['id']}")
        for field in ("reference", "book"):
            if not isinstance(entry[field], str) or not entry[field].strip():
                raise ValueError(f"Missing {field}: {entry['id']}")
        start, end = entry["verseStart"], entry["verseEnd"]
        if not all(type(n) is int and n > 0 for n in (entry["chapter"], start, end)) or end < start:
            raise ValueError(f"Invalid Scripture span: {entry['id']}")
        text = [web[f"{entry['book']}|{entry['chapter']}|{n}"] for n in range(start, end + 1)]
        if not all(isinstance(t, str) and t.strip() for t in text):
            raise ValueError(f"Missing WEB text: {entry['id']}")
        # Do not trim/rewrite Scripture or explanations. This is the same span join as the catalog builder.
        entry["text"] = " ".join(text)
        explanation = explanations[entry["id"]]
        if not isinstance(explanation, str) or not explanation.strip():
            raise ValueError(f"Missing explanation: {entry['id']}")
        entry["explanation"] = explanation
        if not isinstance(entry["themes"], list) or not all(isinstance(t, str) and t for t in entry["themes"]):
            raise ValueError(f"Invalid themes: {entry['id']}")
    return catalog, records


def metadata(title, description, path, noindex=False, website=False, json_ld=None, og_type="website",
              image_path=None, image_width=None, image_height=None):
    url = canonical(path)
    image = absolute_url(image_path or OG_IMAGE_PATH)
    image_width = OG_IMAGE_WIDTH if image_width is None else image_width
    image_height = OG_IMAGE_HEIGHT if image_height is None else image_height
    tags = [f'<title>{html(title)}</title>',
            f'<meta name="description" content="{html(description)}" />',
            f'<link rel="canonical" href="{html(url)}" />',
            '<meta name="robots" content="noindex, follow" />' if noindex else '',
            f'<meta property="og:type" content="{html(og_type)}" />',
            f'<meta property="og:site_name" content="{NAME}" />',
            f'<meta property="og:title" content="{html(title)}" />',
            f'<meta property="og:description" content="{html(description)}" />',
            f'<meta property="og:url" content="{html(url)}" />',
            f'<meta property="og:image" content="{html(image)}" />',
            f'<meta property="og:image:width" content="{image_width}" />',
            f'<meta property="og:image:height" content="{image_height}" />',
            '<meta name="twitter:card" content="summary_large_image" />',
            f'<meta name="twitter:title" content="{html(title)}" />',
            f'<meta name="twitter:description" content="{html(description)}" />',
            f'<meta name="twitter:image" content="{html(image)}" />']
    payload = website_json_ld() if website else json_ld
    if payload is not None:
        tags.append(f'<script type="application/ld+json">{json_script(payload)}</script>')
    return "\n    ".join(t for t in tags if t)


def source_page(name, root=ROOT):
    source = (root / name).read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", source, re.S).group(1)
    description = re.search(r'<meta\s+name="description"\s+content="([^"]*)"\s*/?>', source, re.S).group(1)
    if name == "index.html":
        title, description = HOME_TITLE, HOME_DESCRIPTION
    # Existing source titles/descriptions use text without HTML entities.
    source = re.sub(r"\s*<title>.*?</title>", "", source, flags=re.S)
    source = re.sub(r'\s*<meta\s+name="description"\s+content="[^"]*"\s*/?>', "", source, flags=re.S)
    path = "/" if name == "index.html" else "/" + name
    return source.replace("</head>", metadata(title, description, path, name in PRIVATE_PAGES,
                                            name == "index.html") + "\n  </head>")


def verse_path(entry):
    return f"/verses/{entry['id']}.html"


def listing_path(kind, value, page=1):
    suffix = "" if page == 1 else f"-{page}"
    return f"/browse/{kind}/{slug(value)}{suffix}.html"


def groups_for(records):
    books, topics = defaultdict(list), defaultdict(list)
    for entry in records:
        books[entry["book"]].append(entry)
        for theme in dict.fromkeys(entry["themes"]):
            topics[theme].append(entry)
    for groups in (books, topics):
        slugs = [slug(value) for value in groups]
        if len(slugs) != len(set(slugs)):
            raise ValueError("Book or topic URL slug collision")
    return books, topics


def page_shell(title, description, path, heading, content, root=ROOT, json_ld=None, og_type="website",
               scripts=(), image_path=None, image_width=None, image_height=None):
    source = (root / "index.html").read_text(encoding="utf-8")
    # Reuse the existing font and favicon, while cache-busting each changed stylesheet by content.
    links = re.findall(r"<link\b[^>]*>", source, re.S)
    links = [link for link in links if 'rel="preconnect"' in link or 'rel="icon"' in link
             or "fonts.googleapis.com/css" in link]
    for name in ("styles.css", "browse.css"):
        links.append(f'<link rel="stylesheet" href="/{name}?v={asset_digest(root, name)}" />')
    links.append('<link rel="manifest" href="/manifest.webmanifest" />')
    links.append('<meta name="theme-color" content="#e1e9f1" />')
    links.append('<link rel="apple-touch-icon" href="/icons/icon-192.png" />')
    # Deferred page scripts. Verse pages load share, feedback, and the service worker.
    links.extend(f'<script src="/{name}?v={asset_digest(root, name)}" defer></script>' for name in scripts)
    return f'''<!DOCTYPE html>
<html lang="en" class="theme-light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {metadata(title, description, path, json_ld=json_ld, og_type=og_type, image_path=image_path, image_width=image_width, image_height=image_height)}
    {chr(10).join(links)}
  </head>
  <body class="page-browse">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header site-header--compact"><div class="header-bar">
      <a class="brand-link" href="/">{NAME}</a>
      <nav aria-label="Main"><a href="/">Search</a> · <a href="/browse/">Browse</a></nav>
    </div></header>
    <main class="wrap catalog-page" id="main">
      <h1>{html(heading)}</h1>
      {content}
    </main>
    <footer class="site-footer">
      <p class="footer-operator">His Promise Daily · Jannik Luethi</p>
      <p>Scripture: World English Bible (WEB, public domain). Explanations are original short summaries, informed by public-domain commentaries.</p>
      <p class="footer-links"><a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a> · <a href="/contact.html">Contact</a> · <a class="footer-support" href="/support.html">Support this site</a></p>
    </footer>
  </body>
</html>
'''


def verse_page(entry, books, root=ROOT):
    reference = entry["reference"]
    title = f"{reference} — His Promise Daily"
    # Prefix the reference so identical explanations stay unique in meta descriptions.
    description = meta_description(f"{reference}. {entry['explanation']}")
    topics = " · ".join(f'<a href="{html(listing_path("topics", t))}">{html(t.replace("-", " "))}</a>'
                        for t in dict.fromkeys(entry["themes"]))
    siblings = books[entry["book"]]
    position = next(i for i, e in enumerate(siblings) if e["id"] == entry["id"])
    adjacent = []
    for offset, label in ((-1, "Previous"), (1, "Next")):
        i = position + offset
        if 0 <= i < len(siblings):
            e = siblings[i]
            adjacent.append(f'<a href="{verse_path(e)}">{label}: {html(e["reference"])}</a>')
    content = f'''<p class="catalog-crumb"><a href="/browse/">All books and topics</a> / <a href="{html(listing_path('books', entry['book']))}">{html(entry['book'])}</a></p>
      <article class="catalog-verse">
        <h2 class="card-ref">World English Bible (WEB)</h2>
        <blockquote class="card-text">{html(entry['text'])}</blockquote>
        <p class="catalog-share"><button type="button" class="share-btn" data-share-id="{html(entry['id'])}" data-share-ref="{html(reference)}">Share</button></p>
        <section aria-labelledby="explanation-heading"><h2 id="explanation-heading">Explanation</h2>
          <p class="card-explain-text">{html(entry['explanation'])}</p>
          <section class="fb" data-fb-verse="{html(entry['id'])}" data-fb-version="{html(explain_version(root))}" data-fb-source="verse_page" aria-label="Feedback on this explanation"></section></section>
        <p class="catalog-note">The explanation is an original summary, not additional Bible text.</p>
        <nav aria-label="Related topics">{topics}</nav>
      </article>
      <nav class="catalog-pagination" aria-label="More promises in this book">{' · '.join(adjacent)}</nav>'''
    path = verse_path(entry)
    image = absolute_url(share_image_path(entry, root))
    schema = verse_json_ld(entry, title, description, path, image=image)
    return page_shell(title, description, path, reference, content, root,
                      json_ld=schema, og_type="article",
                      scripts=("js/share.js", "js/feedback.js", "js/pwa.js"),
                      image_path=share_image_path(entry, root),
                      image_width=SHARE_IMAGE_WIDTH, image_height=SHARE_IMAGE_HEIGHT)


def listing_page(kind, value, entries, page, root=ROOT):
    count = len(entries)
    pages = (count + PAGE_SIZE - 1) // PAGE_SIZE
    label = value if kind == "books" else value.replace("-", " ")
    heading = f"Bible promises in {label}" if kind == "books" else f"Bible promises: {label}"
    suffix = "" if page == 1 else f" — Page {page}"
    title = f"{heading}{suffix} (WEB) | {NAME}"
    description = (f"Browse {count} Bible promise passages {'in' if kind == 'books' else 'about'} {label} "
                   f"in the World English Bible (WEB), with short explanations. Page {page} of {pages}.")
    start = (page - 1) * PAGE_SIZE
    items = "\n".join(f'<li><a href="{verse_path(e)}">{html(e["reference"])}</a></li>'
                       for e in entries[start:start + PAGE_SIZE])
    pagination = []
    for n in range(1, pages + 1):
        pagination.append(f'<span aria-current="page">{n}</span>' if n == page else
                          f'<a href="{html(listing_path(kind, value, n))}" aria-label="Page {n}">{n}</a>')
    content = f'''<p><a href="/browse/">All books and topics</a></p>
      <p>{count} passages · World English Bible · Page {page} of {pages}</p>
      <ol class="catalog-list" start="{start + 1}">{items}</ol>
      <nav class="catalog-pagination" aria-label="Pagination">{' '.join(pagination)}</nav>'''
    return page_shell(title, description, listing_path(kind, value, page), heading + suffix, content, root)


def directory_page(records, books, topics, root=ROOT):
    sections = []
    for kind, label, groups in (("books", "Books of the Bible", books), ("topics", "Topics", topics)):
        # Books retain the source catalog's canonical order; topics are alphabetical.
        values = groups if kind == "books" else sorted(groups)
        items = "\n".join(f'<li><a href="{html(listing_path(kind, value))}">{html(value.replace("-", " "))}</a> ({len(groups[value])})</li>'
                           for value in values)
        sections.append(f'<section aria-labelledby="{kind}-heading"><h2 id="{kind}-heading">{label}</h2><ul class="catalog-directory">{items}</ul></section>')
    content = f'''<p>Explore {len(records)} curated Bible promise passages from {len(books)} books in the World English Bible (WEB). Each passage has a short explanation. Browse by book or topic, or <a href="/">search by feeling, theme or keyword</a>.</p>
      {''.join(sections)}'''
    return page_shell(f"Browse Bible Promises by Book and Topic | {NAME}",
                      f"Browse {len(records)} Bible promise passages across {len(books)} books and {len(topics)} topics. Read World English Bible (WEB) Scripture with short explanations.",
                      "/browse/", "Browse Bible promises", content, root)


def write_path(output, path, text):
    relative = (path + "index.html") if path.endswith("/") else path
    destination = output / relative.lstrip("/")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(text, encoding="utf-8")


def public_paths(records, books, topics):
    paths = ["/" if name == "index.html" else "/" + name
             for name in SOURCE_PAGES if name not in PRIVATE_PAGES]
    paths.append("/browse/")
    for kind, groups in (("books", books), ("topics", topics)):
        for value, entries in groups.items():
            paths.extend(listing_path(kind, value, n)
                         for n in range(1, (len(entries) + PAGE_SIZE - 1) // PAGE_SIZE + 1))
    paths.extend(verse_path(entry) for entry in records)
    if len(paths) != len(set(paths)):
        raise ValueError("Duplicate public URL")
    return paths


def sitemap(paths):
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ET.register_namespace("", namespace)
    root = ET.Element(f"{{{namespace}}}urlset")
    for path in paths:
        element = ET.SubElement(root, f"{{{namespace}}}url")
        ET.SubElement(element, f"{{{namespace}}}loc").text = canonical(path)
    # Deliberately no made-up lastmod, priority or changefreq values.
    return '<?xml version="1.0" encoding="utf-8"?>\n' + ET.tostring(root, encoding="unicode") + "\n"


def migration_stub(path):
    target = canonical(path)
    robots = '<meta name="robots" content="noindex, follow" />' if path.lstrip("/") in PRIVATE_PAGES else ""
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{NAME} has moved</title>
{robots}
<link rel="canonical" href="{html(target)}" />
<meta http-equiv="refresh" content="0; url={html(target)}" />
</head><body><h1>{NAME} has moved</h1>
<p>Continue at <a href="{html(target)}">{html(target)}</a>.</p>
</body></html>
'''


def js_string(value):
    return json.dumps(value, ensure_ascii=True)


def write_supabase_public(output):
    """Bake the public Supabase URL and anon/publishable key into the static build.

    SUPABASE_ANON_KEY is preferred. SUPABASE_PUBLISHABLE_KEY is the fallback name.
    SUPABASE_SERVICE_ROLE_KEY is intentionally unread.
    """
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/") or PUBLIC_SUPABASE_URL
    if not re.fullmatch(r"https://[^\s/]+", url):
        raise ValueError("SUPABASE_URL must be an https origin with no path")
    if "service_role" in url or "sb_secret" in url:
        raise ValueError("SUPABASE_URL is not a public origin")
    key = os.environ.get("SUPABASE_ANON_KEY", "").strip() or os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if re.search(r"service_role|sb_secret_", key, re.I):
        raise ValueError("Refusing to embed a service-role or secret key in the public Supabase config")
    if not key:
        print("warning: SUPABASE_ANON_KEY is empty; sign-in will be unavailable in this build", file=sys.stderr)
    text = (
        "/* Generated by scripts/build_site.py. Public Supabase values only. */\n"
        "(function (global) {\n"
        '  "use strict";\n'
        "  var cfg = global.GodsPromisesConfig || (global.GodsPromisesConfig = {});\n"
        f"  cfg.supabaseUrl = {js_string(url)};\n"
        f"  cfg.supabaseAnonKey = {js_string(key)};\n"
        "})(typeof window !== \"undefined\" ? window : globalThis);\n"
    )
    destination = output / "js" / "supabase-public.js"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(text, encoding="utf-8")


def copy_supabase_library(output, root):
    """Copy the official @supabase/supabase-js browser build into dist.

    A temporary build root used by tests may not contain node_modules. The copy
    installed next to this script is the same official package.
    """
    relative = Path("node_modules") / "@supabase" / "supabase-js" / "dist" / "umd" / "supabase.js"
    source = next((candidate for candidate in (root / relative, Path(__file__).resolve().parents[1] / relative)
                   if candidate.is_file()), None)
    destination = output / "js" / "vendor" / "supabase.js"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source is None:
        raise ValueError(
            "Missing node_modules/@supabase/supabase-js/dist/umd/supabase.js. Run npm ci before the production build."
        )
    shutil.copy2(source, destination)


def copy_email_wordmark(output, root):
    """Publish the Auth email wordmark at /email/hpd-wordmark.png.

    It is a static file, not a page, so public_paths() and the sitemap omit it.
    """
    source = root / "email" / "hpd-wordmark.png"
    if not source.is_file():
        raise ValueError("Missing email/hpd-wordmark.png")
    destination = output / "email" / "hpd-wordmark.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def prepare_output(output, root):
    # Only replace this build's two named disposable artifact directories.
    allowed = {root / "dist", root / "pages-dist"}
    if output not in allowed:
        raise ValueError("Output must be dist (production) or pages-dist (migration) inside the source root")
    if output.is_symlink():
        raise ValueError("Refusing symlinked build output")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir()


def build(target="production", root=ROOT):
    catalog, records = load_records(root)
    books, topics = groups_for(records)
    paths = public_paths(records, books, topics)
    output = root / ("dist" if target == "production" else "pages-dist")
    prepare_output(output, root)
    if target == "production":
        for name in SOURCE_PAGES:
            (output / name).write_text(source_page(name, root), encoding="utf-8")
        for name in ("styles.css", "browse.css", "app.js", "og-image.png", "sw.js", "manifest.webmanifest"):
            shutil.copy2(root / name, output / name)
        shutil.copytree(root / "icons", output / "icons")
        copy_email_wordmark(output, root)
        shutil.copytree(root / "js", output / "js")
        write_supabase_public(output)
        copy_supabase_library(output, root)
        (output / "data").mkdir()
        shutil.copy2(root / "data/explanations.json", output / "data/explanations.json")
        # Keep the live homepage and static pages on the same current WEB content.
        catalog["promises"] = [{k: v for k, v in entry.items() if k != "explanation"} for entry in records]
        catalog["coverageNotes"]["total"] = len(records)
        payload = json.dumps(catalog, ensure_ascii=False, indent=2)
        (output / "promises.json").write_text(payload + "\n", encoding="utf-8")
        (output / "promises-data.js").write_text("/* Built from the current catalog and WEB source. */\nwindow.GODS_PROMISES_DATA = " + payload + ";\n", encoding="utf-8")
        write_path(output, "/browse/", directory_page(records, books, topics, root))
        for kind, groups in (("books", books), ("topics", topics)):
            for value, entries in groups.items():
                for page in range(1, (len(entries) + PAGE_SIZE - 1) // PAGE_SIZE + 1):
                    write_path(output, listing_path(kind, value, page), listing_page(kind, value, entries, page, root))
        for entry in records:
            write_path(output, verse_path(entry), verse_page(entry, books, root))
        (output / "sitemap.xml").write_text(sitemap(paths), encoding="utf-8")
        (output / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {ORIGIN}/sitemap.xml\n", encoding="utf-8")
    elif target == "migration":
        for path in paths + ["/" + name for name in sorted(PRIVATE_PAGES)]:
            write_path(output, path, migration_stub(path))
        # Root index.html handles both /gods-promises/ and /gods-promises/index.html.
        # Unknown old URLs have no known corresponding production content; show a fallback, do not invent a redirect.
        (output / "404.html").write_text(f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<meta name="robots" content="noindex, follow" /><title>Page not found — {NAME}</title></head>
<body><h1>This page is not available</h1><p>His Promise Daily has moved. <a href="{ORIGIN}/">Visit the new site</a> or <a href="{ORIGIN}/browse/">browse Bible promises</a>.</p></body></html>\n''', encoding="utf-8")
        (output / ".nojekyll").touch()
    else:
        raise ValueError(f"Unknown target: {target}")
    summary = {"target": target, "verses": len(records), "books": len(books), "topics": len(topics),
               "public_urls": len(paths), "output": str(output)}
    print(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", choices=("production", "migration"), default="production")
    build(parser.parse_args().target)
