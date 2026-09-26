#!/usr/bin/env python3
"""Build promises.json + promises-data.js from curated catalog + WEB index."""
from __future__ import annotations

import importlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))

from feeling_synonyms import (  # noqa: E402
    FEELINGS_VOCAB,
    THEME_VOCAB,
    enrich_search_terms,
)

INDEX = json.loads((SCRIPTS / "web_index.json").read_text(encoding="utf-8"))

BOOK_ABBR = {
    "Genesis": "gen", "Exodus": "exo", "Leviticus": "lev", "Numbers": "num",
    "Deuteronomy": "deu", "Joshua": "jos", "Judges": "jdg", "Ruth": "rut",
    "1 Samuel": "1sa", "2 Samuel": "2sa", "1 Kings": "1ki", "2 Kings": "2ki",
    "1 Chronicles": "1ch", "2 Chronicles": "2ch", "Ezra": "ezr", "Nehemiah": "neh",
    "Esther": "est", "Job": "job", "Psalms": "psa", "Proverbs": "pro",
    "Ecclesiastes": "ecc", "Song of Solomon": "sng", "Isaiah": "isa",
    "Jeremiah": "jer", "Lamentations": "lam", "Ezekiel": "ezk", "Daniel": "dan",
    "Hosea": "hos", "Joel": "jol", "Amos": "amo", "Obadiah": "oba",
    "Jonah": "jon", "Micah": "mic", "Nahum": "nam", "Habakkuk": "hab",
    "Zephaniah": "zep", "Haggai": "hag", "Zechariah": "zec", "Malachi": "mal",
    "Matthew": "mat", "Mark": "mrk", "Luke": "luk", "John": "jhn",
    "Acts": "act", "Romans": "rom", "1 Corinthians": "1co", "2 Corinthians": "2co",
    "Galatians": "gal", "Ephesians": "eph", "Philippians": "php", "Colossians": "col",
    "1 Thessalonians": "1th", "2 Thessalonians": "2th", "1 Timothy": "1ti",
    "2 Timothy": "2ti", "Titus": "tit", "Philemon": "phm", "Hebrews": "heb",
    "James": "jas", "1 Peter": "1pe", "2 Peter": "2pe", "1 John": "1jn",
    "2 John": "2jn", "3 John": "3jn", "Jude": "jud", "Revelation": "rev",
}

# Canonical book order for stable sorting
BOOK_ORDER = list(BOOK_ABBR.keys())


def web_text(book: str, chapter: int, vs: int, ve: int) -> str:
    parts = []
    for v in range(vs, ve + 1):
        t = INDEX.get(f"{book}|{chapter}|{v}")
        if not t:
            raise KeyError(f"Missing WEB verse: {book} {chapter}:{v}")
        parts.append(t)
    return " ".join(parts)


def make_id(book: str, chapter: int, vs: int, ve: int) -> str:
    abbr = BOOK_ABBR[book]
    if vs == ve:
        return f"{abbr}-{chapter}-{vs}"
    return f"{abbr}-{chapter}-{vs}-{ve}"


def make_reference(book: str, chapter: int, vs: int, ve: int) -> str:
    # Display Psalms as "Psalm N" for single psalm refs (common UX); keep book field as Psalms
    display_book = "Psalm" if book == "Psalms" else book
    if vs == ve:
        return f"{display_book} {chapter}:{vs}"
    return f"{display_book} {chapter}:{vs}–{ve}"


def normalize_entry(raw: dict) -> dict:
    book = raw["book"]
    chapter = int(raw["chapter"])
    vs = int(raw["verseStart"])
    ve = int(raw.get("verseEnd", vs))
    if ve < vs:
        raise ValueError(f"verseEnd < verseStart: {raw}")
    raw_feelings = list(raw.get("feelings") or [])
    feelings = []
    extra_search = []
    for f in raw_feelings:
        if f in FEELINGS_VOCAB:
            if f not in feelings:
                feelings.append(f)
        else:
            # pastoral synonyms / situational tags → searchTerms only
            extra_search.append(f)
    themes = list(raw.get("themes") or [])
    # drop unknown themes quietly into search as well? keep themes as-is if in vocab-ish
    # Allow extended themes from THEME_VOCAB; unknown stay but warn later
    text = web_text(book, chapter, vs, ve)
    search = enrich_search_terms(feelings, list(raw.get("searchTerms") or []) + extra_search)
    return {
        "id": raw.get("id") or make_id(book, chapter, vs, ve),
        "reference": raw.get("reference") or make_reference(book, chapter, vs, ve),
        "book": book,
        "chapter": chapter,
        "verseStart": vs,
        "verseEnd": ve,
        "promise": raw["promise"].strip(),
        "text": text,
        "context": raw["context"].strip(),
        "themes": themes,
        "searchTerms": search,
        "feelings": feelings,
    }


def load_catalog_modules():
    catalog_dir = SCRIPTS / "catalog"
    entries = []
    for path in sorted(catalog_dir.glob("*.py")):
        if path.name.startswith("_"):
            continue
        mod_name = f"catalog.{path.stem}"
        mod = importlib.import_module(mod_name)
        batch = getattr(mod, "ENTRIES", None)
        if batch is None:
            raise SystemExit(f"{path} missing ENTRIES")
        entries.extend(batch)
        print(f"  loaded {path.name}: {len(batch)}")
    return entries


def dedupe(entries: list[dict]) -> list[dict]:
    """Collapse identical spans; drop spans fully contained in a wider same-chapter span."""
    by_span = {}
    for e in entries:
        key = (e["book"], e["chapter"], e["verseStart"], e["verseEnd"])
        by_span[key] = e
    keys = list(by_span.keys())
    drop = set()
    for a in keys:
        for b in keys:
            if a == b:
                continue
            if a[0] == b[0] and a[1] == b[1]:
                # a contained in b (strict)
                if a[2] >= b[2] and a[3] <= b[3] and (a[2] > b[2] or a[3] < b[3]):
                    drop.add(a)
    for k in drop:
        del by_span[k]
    return list(by_span.values())


def sort_entries(entries: list[dict]) -> list[dict]:
    order = {b: i for i, b in enumerate(BOOK_ORDER)}

    def key(e):
        return (order.get(e["book"], 999), e["chapter"], e["verseStart"], e["verseEnd"])

    return sorted(entries, key=key)


def main():
    print("Loading catalog modules…")
    raw_entries = load_catalog_modules()
    print(f"Raw catalog count: {len(raw_entries)}")

    built = []
    errors = []
    for i, raw in enumerate(raw_entries):
        try:
            built.append(normalize_entry(raw))
        except Exception as ex:  # noqa: BLE001
            errors.append((raw.get("book"), raw.get("chapter"), raw.get("verseStart"), str(ex)))

    if errors:
        print(f"ERRORS ({len(errors)}):")
        for e in errors[:40]:
            print(" ", e)
        if len(errors) > 40:
            print(f"  …and {len(errors)-40} more")
        raise SystemExit(1)

    built = sort_entries(dedupe(built))
    print(f"Final unique promises: {len(built)}")

    # Coverage
    from collections import Counter

    books = Counter(e["book"] for e in built)
    feelings = Counter()
    for e in built:
        for f in e["feelings"]:
            feelings[f] += 1

    meta = {
        "title": "God’s Promises — Comprehensive Searchable Catalog",
        "translation": "World English Bible (WEB)",
        "translationNote": (
            "Scripture quotations are from the World English Bible (public domain). "
            "Paraphrase fields are original plain-language summaries for searchability, "
            "not additional Bible text. Entries prioritize clear divine promissory "
            "statements and closely related sworn assurances attributed as God’s word."
        ),
        "schemaVersion": 3,
        "expandHint": (
            "Continue deepening thinner books (Historicals narrative, minor prophets "
            "judgment oracles, Mark, some wisdom). Prefer distinct promise units over "
            "padding every adjacent verse."
        ),
        "themeVocabulary": THEME_VOCAB,
        "feelingsVocabulary": FEELINGS_VOCAB,
        "coverageNotes": {
            "methodology": (
                "Inclusion favors God speaking commitment, covenant, assurance, or "
                "sworn word; also NT apostolic declarations of God’s sure commitment "
                "in Christ. Ministries that claim '~3000 promises' often count every "
                "blessing, command-with-benefit, or inferred assurance differently—"
                "this catalog is curated for pastoral search quality, not maximum count."
            ),
            "bookCounts": dict(books),
            "total": len(built),
        },
        "promises": built,
    }

    out_json = ROOT / "promises.json"
    out_json.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js = (
        "/* Auto-generated from promises.json — World English Bible (public domain) */\n"
        "window.GODS_PROMISES_DATA = "
        + json.dumps(meta, ensure_ascii=False, indent=2)
        + ";\n"
    )
    (ROOT / "promises-data.js").write_text(js, encoding="utf-8")
    print(f"Wrote {out_json} and promises-data.js")
    print("Feelings distribution:", dict(feelings))
    print("Top books:", books.most_common(15))


if __name__ == "__main__":
    main()
