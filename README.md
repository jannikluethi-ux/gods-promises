# God’s Promises — searchable web tool

A calm, offline-friendly single-page app for exploring God’s promises from Genesis through Revelation. Built for Carlos with a strong **Genesis** seed set and a light sampling of later books so search feels useful immediately.

People often arrive by **how they feel** (lonely, angry, anxious…), not only by theological themes—so every promise carries pastoral `feelings` tags alongside themes.

## Open / use

**Easiest (works with double-click / `file://`):**

1. Open `/workspace/gods-promises/index.html` in a browser  
   (or from this folder: open `index.html`).

Data is embedded in `promises-data.js`, so no server is required.

**Live site:** https://jannikluethi-ux.github.io/gods-promises/

**Optional local server:**

```bash
cd /workspace/gods-promises
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`.

## How to search

- Type in the search box — filters live across reference, paraphrase, Scripture text, **feelings**, themes, and extra keywords (including feeling synonyms like *abandoned*, *grief*, *worried*).
- Click **feeling chips** to refine (multi-select; **OR** within feelings — a promise matches if it has any selected feeling).
- Click **theme chips** to refine (multi-select; **AND** within themes — a promise must include every selected theme).
- Use the **book** dropdown to limit to one book.
- **Across** filter types (feelings × themes × book × text), results must satisfy **all** active constraints.
- Click a feeling or theme tag on a result card to apply that filter.
- **Clear** resets search, book, feelings, and themes.

Try: `lonely`, `angry`, `anxious`, `guilty`, `weary`, or themes like `covenant`, `presence`.

## Files

| File | Role |
|------|------|
| `index.html` | UI shell |
| `styles.css` | Layout and calm typography |
| `app.js` | Search / filter logic |
| `promises-data.js` | Embedded data (loaded by the page) |
| `promises.json` | Same data as structured JSON — **edit here, then regenerate** |

## Extending the data

1. Add entries to `promises.json` using the existing schema (`id`, `reference`, `book`, `chapter`, `verseStart`, `verseEnd`, `promise`, `text`, `context`, `themes`, `feelings`, `searchTerms`).
2. Prefer genuine divine promises (spoken by God or clearly God’s commitment).
3. Use **World English Bible (WEB)** or another public-domain text for `text`; keep `promise` as a short plain-language paraphrase.
4. Give each promise **1–4 honest `feelings`** from the vocabulary in `feelingsVocabulary` (e.g. `lonely`, `angry`, `sad`, `anxious`, `guilty`, `weary`, `loved`). Put synonyms in `searchTerms`.
5. Regenerate the embedded file:

```bash
python3 -c "
import json
from pathlib import Path
p = Path('promises.json')
meta = json.loads(p.read_text())
Path('promises-data.js').write_text(
    '/* Auto-generated from promises.json — World English Bible (public domain) */\\n'
    + 'window.GODS_PROMISES_DATA = ' + json.dumps(meta, ensure_ascii=False, indent=2) + ';\\n'
)
print('Updated promises-data.js')
"
```

Suggested next books to fill systematically: **Exodus** (more deliverance/presence), **Deuteronomy**, **Psalms** (wider comfort set), **Isaiah**, **Jeremiah**, **Gospels**, **Epistles**, then complete **Revelation**.

## Translation note

Scripture quotations use the **World English Bible (WEB)**, which is public domain. Do not invent verse text. Paraphrases in the `promise` field are original summaries for discovery and clarity.
