# Daily Promises — searchable web tool

**Daily Promises** is a calm, offline-friendly single-page app for exploring God’s promises from Genesis through Revelation. Built for Carlos with a **comprehensive, curated catalog** (1186 promise units) anchored in the public-domain **World English Bible (WEB)**.

People often arrive by **how they feel** (lonely, angry, anxious…), not only by theological themes—so every promise carries pastoral `feelings` tags alongside themes.

## Open / use

**Easiest (works with double-click / `file://`):**

1. Open `index.html` in a browser.

Data is embedded in `promises-data.js`, so no server is required.

**Live site:** https://jannikluethi-ux.github.io/gods-promises/

> **Hard-cache note:** GitHub Pages (and browsers) may cache `promises-data.js`. If the count looks old after a deploy, do a hard refresh (Ctrl/Cmd+Shift+R) or open the site in a private window.

**Optional local server:**

```bash
cd /workspace/gods-promises
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`.

## How to search

- Type in the search box — filters live across reference, paraphrase, Scripture text, **feelings**, themes, and extra keywords (including feeling synonyms like *abandoned*, *grief*, *worried*).
- Open the filters icon in the search bar for the **Feeling**, **Theme**, **Book**, and **Version** dropdowns (and **Testament** buttons). Version choices are public-domain only (WEB default; KJV, ASV, YLT, Darby, Douay-Rheims). Non-WEB text loads from bible-api.com and is cached in the session.
- Tap the **cross** on a result card to save a personal favorite (sign in required).
- Across filter types, results must satisfy **all** active constraints.
- Results paginate (**Show more**) so large catalogs stay responsive.
- Click a feeling or theme tag on a result card to apply that filter.
- With an empty search and no filters, the page shows the **daily verse**, which changes at midnight Zurich time (Europe/Zurich). Press **Esc** in the search box to return to it.
- The daily verse is a **carousel of past days**: today shows first; swipe right, drag with the mouse, press ←, or tap **‹ Earlier** to step back to yesterday and earlier days (up to 60 days back). **Later ›** / → moves forward again, never past today. Each card is labelled “Today”, “Yesterday”, or its date (e.g. “Saturday 17 October”). Past days use the same deterministic Zurich-date picker, so each shows exactly the verse it showed on that day. Favorites and the Version filter work on every card.
- The site was renamed from “God’s Promises” to **Daily Promises**; the repo and URL stay `gods-promises`, and existing `localStorage` keys (accounts, favorites, version choice) are unchanged.

Try: `lonely`, `angry`, `anxious`, `guilty`, `weary`, or themes like `covenant`, `presence`.

## Catalog size & methodology

**Current count:** 1186 unique promise entries (WEB text).

Different ministries count “promises” differently—some aim near ~3000 by including every blessing, inferred assurance, or command-with-benefit. **This catalog prioritizes clear divine promissory statements** (God speaking commitment, covenant, assurance) and closely related sworn assurances attributed as God’s word, plus NT declarations of God’s sure commitment in Christ. Quality and accurate citation over padding. **Verse `text` is never invented**—only WEB.

### Coverage by book

| Book | Entries |
|------|--------:|
| Psalms | 201 |
| Isaiah | 102 |
| John | 70 |
| Matthew | 51 |
| Luke | 50 |
| Proverbs | 48 |
| Deuteronomy | 46 |
| Jeremiah | 41 |
| Romans | 37 |
| Revelation | 34 |
| Genesis | 33 |
| Hebrews | 29 |
| Exodus | 25 |
| Ezekiel | 25 |
| 2 Corinthians | 22 |
| Zechariah | 21 |
| Ephesians | 20 |
| 1 John | 19 |
| Mark | 19 |
| 1 Corinthians | 18 |
| Job | 18 |
| Daniel | 17 |
| 1 Peter | 15 |
| Acts | 12 |
| Colossians | 11 |
| James | 11 |
| Galatians | 10 |
| Hosea | 10 |
| Joshua | 10 |
| Micah | 10 |
| Numbers | 10 |
| Joel | 9 |
| Philippians | 9 |
| 2 Timothy | 8 |
| 1 Thessalonians | 7 |
| 2 Chronicles | 7 |
| Malachi | 7 |
| 1 Samuel | 6 |
| 1 Timothy | 6 |
| 2 Samuel | 6 |
| Zephaniah | 6 |
| 2 Thessalonians | 5 |
| Haggai | 5 |
| Jonah | 5 |
| Leviticus | 5 |
| Nehemiah | 5 |
| 1 Chronicles | 4 |
| 1 Kings | 4 |
| 2 Peter | 4 |
| Amos | 4 |
| Ecclesiastes | 4 |
| Habakkuk | 4 |
| Lamentations | 4 |
| 2 Kings | 3 |
| Jude | 3 |
| Titus | 3 |
| Ezra | 2 |
| Obadiah | 2 |
| 2 John | 1 |
| 3 John | 1 |
| Nahum | 1 |
| Philemon | 1 |

### Still thinner (next passes)

Historicals beyond Davidic covenant threads, Mark (vs Matthew/Luke/John), some wisdom books, and denser harvest of the Twelve’s judgment-adjacent comfort oracles remain growth areas. Prefer distinct promise units over splitting redundant adjacent verses.

## Accounts & favorites

Browse/search stays **open to everyone** (no login required).

- **Sign up / sign in:** `login.html` — email + password. Auth is **local for now** (`localStorage` + Web Crypto salted PBKDF2 hashes). Plaintext passwords are never stored.
- **Personal page:** `me.html` — welcome + **your favorited promises** (primary content).
- **Favorite control:** a Christian **cross** icon on each promise card (catalog + personal page). Outline = not saved; filled/emphasized = saved. Accessible `aria-pressed` with “Save favorite” / “Remove favorite”.
- If you tap the cross while signed out, you’re sent to sign in.

### Subscription seam (no payments yet)

Config lives in `js/config.js`:

```js
subscriptionRequired: false  // flip to true later
supabaseUrl: ""
supabaseAnonKey: ""
```

- `js/subscription.js` exposes `canAccessFavorites(user)` and `canAccessApp(user)`.
- While `subscriptionRequired` is `false`, both always allow access.
- When you set it to `true`, access requires `user.subscriptionStatus === "active"` (field already on the local user profile).
- Later: plug **Supabase Auth** into `js/auth.js` (same API: `signUp`, `signIn`, `signOut`, `getCurrentUser`, `onAuthChange`), remote favorites into `js/favorites.js` (`toggle`, `list`, `isFavorite`), and **Stripe** (or similar) to set `subscriptionStatus`.

## Files

| File | Role |
|------|------|
| `index.html` | Catalog search UI |
| `login.html` | Sign in / create account |
| `me.html` | Personal favorites landing |
| `styles.css` | Layout and calm typography |
| `app.js` | Search / filter / pagination + favorite buttons |
| `js/config.js` | App name, `subscriptionRequired`, Supabase placeholders |
| `js/subscription.js` | Access checks for favorites / personal area |
| `js/auth.js` | Local auth (API ready for Supabase swap) |
| `js/favorites.js` | Per-user favorite IDs (API ready for remote table) |
| `js/ui-shared.js` | Cross icon, cards, auth nav helpers |
| `promises-data.js` | Embedded data (loaded by the page) |
| `promises.json` | Same data as structured JSON — **edit via catalog, then regenerate** |
| `scripts/catalog/` | Book-by-book curated metadata |
| `scripts/build_promises.py` | Fills WEB text from `web_index.json`, writes JSON + JS |
| `scripts/web_index.json` | Parsed engwebp verse index |
| `data/explanations.json` | One short original explanation per promise id, fetched after first paint |
| `scripts/explanations/` | Notes on how the explanations were written, plus `sources.json` (commentaries consulted per entry) |

## Extending the data

1. Add entries under `scripts/catalog/` using `e(...)` from `_entry.py`.
2. Prefer genuine divine promises (spoken by God or clearly God’s commitment).
3. Scripture `text` is filled automatically from WEB (engwebp).
4. Give each promise **1–4 honest `feelings`** from `feelingsVocabulary`. Put synonyms / life situations in `searchTerms`.
5. Regenerate:

```bash
python3 scripts/build_promises.py
```

## Explanations under each verse

Each card shows one short explanation, usually one or two sentences of plain modern English, saying what the passage means in context. It does not repeat the verse.

Openings are honest about who is speaking:

- "God promises…" or "Jesus promises…" is used only for real divine promises.
- Promises made to a particular person or nation say so, e.g. "God promised Israel…".
- Prayers, praise, wisdom sayings and teaching name the speaker, e.g. "David asks God…", "Paul explains…" or "This proverb teaches…".

`data/explanations.json` (~220 KB) is fetched once after first paint. The `promise` and `context` fields stay in the data for search but are not displayed. See `scripts/explanations/README.md`.

**Credit:** the explanations are original summaries informed by public-domain commentaries: Barnes' Notes and Matthew Henry's Concise Commentary, plus Gill's Exposition and Ellicott's Commentary where used.

## Translation note

Scripture quotations use the **World English Bible (WEB)**, public domain. Do not invent verse text. Paraphrases in the `promise` field are original summaries used for search (not displayed).
