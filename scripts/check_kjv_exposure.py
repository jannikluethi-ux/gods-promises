#!/usr/bin/env python3
"""Fail if King James verse text is committed or placed in a public bundle.

The fingerprint file stores hashes only. It does not store verse text.
Whole-file SHA-256 values, the two known git blob ids, and a per-verse
hash sample catch a renamed, gzipped, zipped, or base64 copy. Archaic-token
density catches a minified or lightly edited copy that no longer hashes
line for line.

Exit 0 when nothing matches. Exit 1 and print reasons otherwise.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FINGERPRINT_PATH = Path(__file__).resolve().parent / "kjv_exposure_fingerprints.json"
TOKEN_RE = re.compile(r"\b(?:thou|thee|thy|thine|ye|hath|saith|unto)\b", re.I)
QUOTED_RE = re.compile(r'"((?:\\.|[^"\\]){40,})"')
B64_RE = re.compile(r"(?:[A-Za-z0-9+/]{80,}={0,2})")
TOKEN_LIMIT = 40
VERSE_HITS = 3
MAX_BYTES = 30_000_000
MAX_DEPTH = 3
SKIP_DIRS = {".git", "node_modules", "dist", "pages-dist", "__pycache__"}


def load_fingerprints(path: Path = FINGERPRINT_PATH) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        "whole": set(data["whole_sha256"]),
        "blobs": set(data["git_blob_sha1"]),
        "verses": set(data["verse_sha256_16"]),
    }


def normalize(text: str) -> str:
    text = text.lower().replace("\u2019", "'").replace("\u2018", "'")
    text = re.sub(r"[^a-z\s]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def verse_key(text: str) -> str | None:
    norm = normalize(text)
    if len(norm) < 40:
        return None
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()[:16]


def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def walk_strings(value, found: list[str]) -> None:
    if isinstance(value, str):
        found.append(value)
    elif isinstance(value, dict):
        for item in value.values():
            walk_strings(item, found)
    elif isinstance(value, list):
        for item in value:
            walk_strings(item, found)


def candidate_strings(text: str) -> list[str]:
    found: list[str] = []
    decoder = json.JSONDecoder()
    idx = 0
    while idx < len(text):
        brace = text.find("{", idx)
        bracket = text.find("[", idx)
        starts = [n for n in (brace, bracket) if n >= 0]
        if not starts:
            break
        start = min(starts)
        try:
            value, end = decoder.raw_decode(text, start)
        except json.JSONDecodeError:
            idx = start + 1
            continue
        walk_strings(value, found)
        idx = max(end, start + 1)
        if len(found) > 40000:
            break
    if not found:
        found.extend(match.group(1).replace('\\"', '"').replace("\\n", " ") for match in QUOTED_RE.finditer(text))
    found.append(text)
    pieces: list[str] = []
    for item in found:
        pieces.append(item)
        pieces.extend(re.split(r"(?<=[.!?])\s+", item))
    return pieces


def text_findings(data: bytes, label: str, verses: set[str]) -> list[str]:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return []
    findings = []
    tokens = len(TOKEN_RE.findall(text))
    if tokens >= TOKEN_LIMIT:
        findings.append(f"archaic-density:{tokens}:{label}")
    hits = set()
    for piece in candidate_strings(text):
        key = verse_key(piece)
        if key and key in verses:
            hits.add(key)
            if len(hits) >= VERSE_HITS:
                break
    if len(hits) >= VERSE_HITS:
        findings.append(f"verse-hashes:{len(hits)}:{label}")
    return findings


def decoded_base64_chunks(data: bytes) -> list[bytes]:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return []
    out = []
    for match in B64_RE.finditer(text):
        raw = match.group(0)
        pad = "=" * ((4 - len(raw) % 4) % 4)
        try:
            decoded = base64.b64decode(raw + pad, validate=False)
        except Exception:
            continue
        if len(decoded) >= 80:
            out.append(decoded)
        if len(out) >= 20:
            break
    return out


def inspect(data: bytes, label: str, fp: dict, depth: int = 0) -> list[str]:
    findings = []
    if len(data) > MAX_BYTES:
        findings.append(f"too-large:{len(data)}:{label}")
        data = data[:MAX_BYTES]
    digest = hashlib.sha256(data).hexdigest()
    if digest in fp["whole"]:
        findings.append(f"whole-sha256:{label}")
    if git_blob_sha1(data) in fp["blobs"]:
        findings.append(f"git-blob:{label}")
    if depth < MAX_DEPTH and data.startswith(b"\x1f\x8b"):
        try:
            findings.extend(inspect(gzip.decompress(data), label + "!gzip", fp, depth + 1))
        except Exception:
            pass
    if depth < MAX_DEPTH and data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                for info in archive.infolist()[:40]:
                    if info.is_dir() or info.file_size > MAX_BYTES:
                        continue
                    findings.extend(inspect(archive.read(info), f"{label}!zip:{info.filename}", fp, depth + 1))
        except zipfile.BadZipFile:
            pass
    if depth < MAX_DEPTH and len(data) > 262 and data[257:262] == b"ustar":
        try:
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:") as archive:
                count = 0
                for member in archive:
                    if not member.isfile() or member.size > MAX_BYTES:
                        continue
                    extracted = archive.extractfile(member)
                    if extracted is None:
                        continue
                    findings.extend(inspect(extracted.read(), f"{label}!tar:{member.name}", fp, depth + 1))
                    count += 1
                    if count >= 40:
                        break
        except tarfile.TarError:
            pass
    findings.extend(text_findings(data, label, fp["verses"]))
    if depth < MAX_DEPTH:
        for index, chunk in enumerate(decoded_base64_chunks(data)):
            findings.extend(inspect(chunk, f"{label}!b64:{index}", fp, depth + 1))
    return findings


def iter_git_files(root: Path):
    listed = subprocess.check_output(["git", "ls-files", "-z"], cwd=root)
    for name in listed.split(b"\0"):
        if not name:
            continue
        path = root / name.decode("utf-8", "surrogateescape")
        if path.is_file():
            yield path


def iter_tree_files(root: Path):
    root = root.resolve()
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.resolve().relative_to(root)
        if any(part in SKIP_DIRS for part in relative.parts):
            continue
        yield path


def scan(paths, fp: dict) -> list[str]:
    findings = []
    for path in paths:
        try:
            data = path.read_bytes()
        except OSError as err:
            findings.append(f"unreadable:{path}:{err}")
            continue
        findings.extend(inspect(data, str(path), fp))
    return findings


def generate(index_path: Path, spans_path: Path, upstream_sha: str, exclude_root: Path | None) -> dict:
    keys = []
    for source in (index_path, spans_path):
        payload = json.loads(source.read_text(encoding="utf-8"))
        strings: list[str] = []
        walk_strings(payload, strings)
        for item in strings:
            key = verse_key(item)
            if key:
                keys.append(key)
    distinctive = set(keys)
    if exclude_root is not None:
        excluded = set()
        for path in iter_tree_files(exclude_root):
            if path.suffix.lower() not in {".js", ".json", ".html", ".md", ".py", ".txt"}:
                continue
            if "kjv-spans" in path.name or "kjv_index" in path.name:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            for piece in candidate_strings(text):
                key = verse_key(piece)
                if key:
                    excluded.add(key)
        distinctive -= excluded
    return {
        "note": "Hashes only. No verse text. Regenerate with scripts/check_kjv_exposure.py --generate after a pinned source change.",
        "whole_sha256": sorted({
            upstream_sha,
            hashlib.sha256(index_path.read_bytes()).hexdigest(),
            hashlib.sha256(spans_path.read_bytes()).hexdigest(),
        }),
        "git_blob_sha1": sorted({
            git_blob_sha1(index_path.read_bytes()),
            git_blob_sha1(spans_path.read_bytes()),
        }),
        "verse_sha256_16": sorted(distinctive),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fail if KJV verse text is in a tree or git checkout.")
    parser.add_argument("--git", action="store_true", help="Scan tracked files in the current checkout.")
    parser.add_argument("--root", type=Path, help="Scan this directory.")
    parser.add_argument("--public", action="store_true", help="This root is a public bundle. Same rules, labeled as public.")
    parser.add_argument("--generate", nargs=2, metavar=("INDEX", "SPANS"), help="Write fingerprints from local files. Does not keep the verse text.")
    parser.add_argument("--exclude-root", type=Path, help="With --generate, drop hashes that already match this tree (the WEB catalog).")
    parser.add_argument("--upstream-sha256", default="f0b09dc49dfb97bb84f03aae1fbf026485048c3cab31a7a41017e2d86ac1d11c")
    args = parser.parse_args(argv)
    if args.generate:
        payload = generate(Path(args.generate[0]), Path(args.generate[1]), args.upstream_sha256, args.exclude_root)
        FINGERPRINT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {FINGERPRINT_PATH} verses={len(payload['verse_sha256_16'])}")
        return 0
    if not args.git and args.root is None:
        parser.error("pass --git or --root")
    fp = load_fingerprints()
    paths = []
    if args.git:
        paths.extend(iter_git_files(ROOT))
    if args.root is not None:
        paths.extend(iter_tree_files(args.root))
    findings = scan(paths, fp)
    label = "public bundle" if args.public else "tree"
    if findings:
        print(f"KJV exposure check failed for {label}: {len(findings)} finding(s)")
        for item in findings:
            print(item)
        return 1
    print(f"KJV exposure check passed for {label}: {len(paths)} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
