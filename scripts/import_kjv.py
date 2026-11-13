#!/usr/bin/env python3
"""Validate the King James master text and rebuild the offline span file.

The master text is scripts/kjv_index.json (book|chapter|verse -> text), the
same shape as scripts/web_index.json. It is the normalized 1769 Protestant
canon from scrollmapper/bible_databases, with no Apocrypha. This script does
not download anything unless --from-scrollmapper is given, and it never writes
promises-data.js, promises.json, or data/explanations.json.

--check compares the committed index, versification, checksum, and span file.
Any duplicate, hole, book mismatch, or span miss exits non-zero.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
INDEX_PATH = SCRIPTS / "kjv_index.json"
VERSIFICATION_PATH = SCRIPTS / "kjv_versification.json"
SOURCE_PATH = SCRIPTS / "kjv_source.json"
SPANS_PATH = ROOT / "data" / "kjv-spans.json"
PROMISES_PATH = ROOT / "promises-data.js"

SOURCE_URL = (
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/"
    "e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c/formats/json/KJV.json"
)
SOURCE_COMMIT = "e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c"
SOURCE_SHA256 = "f0b09dc49dfb97bb84f03aae1fbf026485048c3cab31a7a41017e2d86ac1d11c"

# Catalog book names, Protestant order. Scrollmapper uses a few different labels.
BOOK_ORDER = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
    "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
    "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
]

SCROLL_TO_CATALOG = {
    "I Samuel": "1 Samuel",
    "II Samuel": "2 Samuel",
    "I Kings": "1 Kings",
    "II Kings": "2 Kings",
    "I Chronicles": "1 Chronicles",
    "II Chronicles": "2 Chronicles",
    "I Corinthians": "1 Corinthians",
    "II Corinthians": "2 Corinthians",
    "I Thessalonians": "1 Thessalonians",
    "II Thessalonians": "2 Thessalonians",
    "I Timothy": "1 Timothy",
    "II Timothy": "2 Timothy",
    "I Peter": "1 Peter",
    "II Peter": "2 Peter",
    "I John": "1 John",
    "II John": "2 John",
    "III John": "3 John",
    "Revelation of John": "Revelation",
}

# Independent of the generated versification file. A wrong rebuild still fails these.
SPOT_CHECKS = {
    ("John", 3, 16): "For God so loved the world, that he gave his only begotten Son",
    ("Psalms", 23, 1): "A Psalm of David. The Lord is my shepherd; I shall not want.",
    ("Genesis", 1, 1): "In the beginning God created the heaven and the earth.",
    ("Revelation", 22, 21): "The grace of our Lord Jesus Christ be with you all. Amen.",
}
EXPECTED_VERSES = 31102
EXPECTED_BOOKS = 66


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def catalog_name(name: str) -> str:
    return SCROLL_TO_CATALOG.get(name, name)


def load_promises() -> list:
    text = PROMISES_PATH.read_text(encoding="utf-8")
    match = re.search(r"window\.GODS_PROMISES_DATA\s*=\s*(\{.*\})\s*;\s*$", text, re.S)
    if not match:
        raise SystemExit("Could not read promises-data.js")
    data = json.loads(match.group(1))
    promises = data.get("promises")
    if not isinstance(promises, list) or len(promises) != 1188:
        raise SystemExit(f"Expected 1188 promises, found {0 if not isinstance(promises, list) else len(promises)}")
    return promises


def normalize_scrollmapper(raw: dict) -> dict:
    books = raw.get("books")
    if not isinstance(books, list):
        raise SystemExit("Scrollmapper KJV JSON has no books list")
    index = {}
    seen_keys = set()
    duplicates = []
    gaps = []
    names = []
    for book in books:
        name = catalog_name(str(book.get("name") or ""))
        names.append(name)
        chapters = book.get("chapters") or []
        for chapter in chapters:
            chapter_no = int(chapter.get("chapter"))
            numbers = []
            for verse in chapter.get("verses") or []:
                verse_no = int(verse.get("verse"))
                text = str(verse.get("text") or "").replace("\r\n", "\n").strip()
                text = re.sub(r"\s+", " ", text)
                key = f"{name}|{chapter_no}|{verse_no}"
                if key in seen_keys:
                    duplicates.append(key)
                seen_keys.add(key)
                if not text:
                    gaps.append(key + " empty")
                index[key] = text
                numbers.append(verse_no)
            expected = list(range(1, len(numbers) + 1))
            if numbers != expected:
                gaps.append(f"{name} {chapter_no} verses {numbers[:8]}...")
    if names != BOOK_ORDER:
        raise SystemExit("Book order/name mismatch:\n" + "\n".join(
            f"  {i+1}. got {got!r} expected {exp!r}"
            for i, (got, exp) in enumerate(zip(names, BOOK_ORDER))
            if got != exp
        ) or f"count got {len(names)} expected {len(BOOK_ORDER)}")
    if duplicates or gaps:
        raise SystemExit("KJV source is not clean:\n" + "\n".join(duplicates[:20] + gaps[:20]))
    ordered = {}
    for name in BOOK_ORDER:
        prefix = name + "|"
        for key in sorted(index, key=lambda item: key_sort(item)):
            if key.startswith(prefix):
                ordered[key] = index[key]
    if len(ordered) != len(index):
        raise SystemExit("Ordering dropped verses")
    return ordered


def key_sort(key: str):
    book, chapter, verse = key.split("|")
    return (BOOK_ORDER.index(book), int(chapter), int(verse))


def versification_from_index(index: dict) -> dict:
    books = []
    for name in BOOK_ORDER:
        chapters = {}
        for key in index:
            book, chapter, _verse = key.split("|")
            if book != name:
                continue
            chapters.setdefault(int(chapter), 0)
            chapters[int(chapter)] += 1
        if not chapters:
            raise SystemExit(f"No verses for {name}")
        numbers = sorted(chapters)
        if numbers != list(range(1, len(numbers) + 1)):
            raise SystemExit(f"Missing chapter in {name}: {numbers[:12]}")
        counts = [chapters[n] for n in numbers]
        books.append({"book": name, "chapters": counts, "verses": sum(counts)})
    return {"books": books, "verses": sum(item["verses"] for item in books)}


def check_index(index: dict, versification: dict) -> dict:
    duplicates = []
    seen = set()
    for key in index:
        if key in seen:
            duplicates.append(key)
        seen.add(key)
    built = versification_from_index(index)
    missing = []
    if [item["book"] for item in built["books"]] != [item["book"] for item in versification["books"]]:
        raise SystemExit("Versification book list does not match the index")
    for got, exp in zip(built["books"], versification["books"]):
        if got["chapters"] != exp["chapters"]:
            missing.append(got["book"])
    if built["verses"] != EXPECTED_VERSES or len(built["books"]) != EXPECTED_BOOKS:
        raise SystemExit(f"Unexpected size: {len(built['books'])} books, {built['verses']} verses")
    if versification.get("verses") != EXPECTED_VERSES:
        raise SystemExit("Versification file does not total 31102 verses")
    for (book, chapter, verse), prefix in SPOT_CHECKS.items():
        text = index.get(f"{book}|{chapter}|{verse}", "")
        if not text.startswith(prefix):
            raise SystemExit(f"Spot check failed for {book} {chapter}:{verse}: {text[:80]!r}")
    if duplicates or missing:
        raise SystemExit(
            "KJV validation failed. Duplicates: "
            + ", ".join(duplicates[:20])
            + ". Chapter/verse mismatch: "
            + ", ".join(missing[:20])
        )
    return built


def spans_from_index(index: dict, promises: list) -> dict:
    passages = {}
    missing = []
    for promise in promises:
        pid = promise["id"]
        if pid in passages:
            missing.append("duplicate promise id " + pid)
            continue
        parts = []
        start = int(promise["verseStart"])
        end = int(promise["verseEnd"] if promise.get("verseEnd") is not None else start)
        for verse in range(start, end + 1):
            key = f"{promise['book']}|{int(promise['chapter'])}|{verse}"
            text = index.get(key)
            if not text:
                missing.append(key + " for " + pid)
                break
            parts.append(text)
        else:
            passages[pid] = " ".join(parts)
    if missing or len(passages) != 1188:
        preview = "\n".join(missing[:30])
        raise SystemExit(f"Span build failed ({len(passages)} passages):\n{preview}")
    return {
        "translation": "kjv",
        "passageCount": 1188,
        "passages": passages,
    }


def dump(path: Path, obj) -> str:
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"
    path.write_text(text, encoding="utf-8")
    return sha256_text(text)


def report_for(index: dict, built: dict, spans: dict, normalized_sha: str) -> dict:
    return {
        "source_url": SOURCE_URL,
        "source_commit": SOURCE_COMMIT,
        "source_sha256": SOURCE_SHA256,
        "normalized_sha256": normalized_sha,
        "books": len(built["books"]),
        "chapters": sum(len(item["chapters"]) for item in built["books"]),
        "verses": built["verses"],
        "duplicates": 0,
        "missing": 0,
        "spans": len(spans["passages"]),
        "per_book": [
            {"book": item["book"], "chapters": len(item["chapters"]), "verses": item["verses"]}
            for item in built["books"]
        ],
    }


def write_from_scrollmapper(path: Path) -> None:
    raw_bytes = path.read_bytes()
    digest = sha256_bytes(raw_bytes)
    if digest != SOURCE_SHA256:
        raise SystemExit(f"Refusing to import {path}: sha256 {digest} != {SOURCE_SHA256}")
    raw = json.loads(raw_bytes)
    index = normalize_scrollmapper(raw)
    versification = versification_from_index(index)
    built = check_index(index, versification)
    promises = load_promises()
    spans = spans_from_index(index, promises)
    normalized_sha = dump(INDEX_PATH, index)
    dump(VERSIFICATION_PATH, versification)
    dump(SPANS_PATH, spans)
    source = {
        "translation": "King James Version (1769)",
        "canon": "Protestant, 66 books, no Apocrypha",
        "source_url": SOURCE_URL,
        "source_repo": "https://github.com/scrollmapper/bible_databases",
        "source_commit": SOURCE_COMMIT,
        "source_sha256": SOURCE_SHA256,
        "normalized_file": "scripts/kjv_index.json",
        "normalized_sha256": normalized_sha,
        "note": (
            "The upstream file is labeled King James Version (1769). "
            "Its verse text is prose, not Strong's numbers. "
            "Rights in the Authorized Version in the United Kingdom are vested in the Crown. "
            "This file does not grant those rights."
        ),
    }
    dump(SOURCE_PATH, source)
    built_report = report_for(index, built, spans, normalized_sha)
    dump(SCRIPTS / "kjv_import_report.json", built_report)
    print(json.dumps({k: built_report[k] for k in built_report if k != "per_book"}, indent=2))


def check() -> dict:
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    versification = json.loads(VERSIFICATION_PATH.read_text(encoding="utf-8"))
    source = json.loads(SOURCE_PATH.read_text(encoding="utf-8"))
    spans = json.loads(SPANS_PATH.read_text(encoding="utf-8"))
    normalized_sha = sha256_text(INDEX_PATH.read_text(encoding="utf-8"))
    if source.get("source_sha256") != SOURCE_SHA256 or source.get("normalized_sha256") != normalized_sha:
        raise SystemExit("KJV checksum record does not match the committed index")
    if source.get("source_url") != SOURCE_URL:
        raise SystemExit("KJV source URL changed")
    built = check_index(index, versification)
    promises = load_promises()
    expected = spans_from_index(index, promises)
    if expected["passages"] != spans.get("passages") or spans.get("passageCount") != 1188:
        raise SystemExit("data/kjv-spans.json is not the current 1,188-passage projection")
    info = report_for(index, built, spans, normalized_sha)
    print(
        f"KJV OK: {info['books']} books, {info['chapters']} chapters, {info['verses']} verses, "
        f"duplicates {info['duplicates']}, missing {info['missing']}, spans {info['spans']}"
    )
    return info


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--check":
        check()
        return
    if len(sys.argv) == 3 and sys.argv[1] == "--from-scrollmapper":
        write_from_scrollmapper(Path(sys.argv[2]))
        check()
        return
    raise SystemExit("Usage: import_kjv.py --check | --from-scrollmapper PATH")


if __name__ == "__main__":
    main()
