# Explanation build scripts

Produces `data/henry.json` and `data/notes/<book>.json`. Working files live in `/workspace/hb/` (not committed).

1. `extract_sword.py` – downloads the public-domain CrossWire SWORD modules MHCC (Matthew Henry Concise), Barnes (NT), JFB and KJV, dumps raw verse markup to JSON (`pip install pysword`).
2. `scrape.py` – fetches biblehub chapter pages, gently throttled (2.5 s between requests), only for chapters in the catalog: Barnes for Job/Psalms/Isaiah/Daniel, Ellicott for the other OT books. Cached in `/workspace/hb/cache/`.
3. `run_henry.py` (uses `mhcc.py`, `select_henry.py`, `modern.py`) – picks 2–5 Matthew Henry sentences per promise (verse-position + KJV/WEB overlap scoring, 3-gram anchors, 4-gram near-copy guard), light modernising only, writes `data/henry.json`.
4. `build_notes.py` – cleans Barnes / Ellicott / JFB verse notes (HTML, Greek/Hebrew stripped, lemma + paragraphs kept), picks the source per entry, writes `data/notes/*.json`.

Sources are public domain only (Matthew Henry 1706–14; Barnes 1834–; Ellicott 1878–84; JFB 1871).
