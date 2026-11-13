# His Promise Daily — searchable web tool

**His Promise Daily** is a calm, offline-friendly single-page app for exploring God’s promises from Genesis through Revelation. It is run by Jannik Luethi and keeps a **comprehensive, curated catalog** (1186 promise units) anchored in the public-domain **World English Bible (WEB)**.

People often arrive by **how they feel** (lonely, angry, anxious…), not only by theological themes—so every promise carries pastoral `feelings` tags alongside themes.

## Open / use

**Easiest (works with double-click / `file://`):**

1. Open `index.html` in a browser.

Data is embedded in `promises-data.js`, so no server is required.

**Live site:** https://hispromisedaily.com (Vercel). The old GitHub Pages address is a move notice only.

> **Hard-cache note:** GitHub Pages (and browsers) may cache `promises-data.js`. If the count looks old after a deploy, do a hard refresh (Ctrl/Cmd+Shift+R) or open the site in a private window.

**Local server with sign-in:**

```bash
npm ci
python3 scripts/build_site.py --target production
python3 -m http.server 8080 --directory dist
```

Then visit `http://localhost:8080/`. Set `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`) in the environment before the build if you want sign-in to work. See `docs/supabase-auth.md`. Opening the source `index.html` still browses the catalog; the production client library is copied into `dist` by the build.

## How to search

- Type in the search box — filters live across reference, paraphrase, Scripture text, **feelings**, themes, and extra keywords (including feeling synonyms like *abandoned*, *grief*, *worried*).
- Open the filters icon in the search bar for the **Feeling**, **Theme**, **Book**, and **Version** dropdowns (and **Testament** buttons). Version choices are WEB (the default, in the catalog) and KJV from a local public-domain file, plus ASV, YLT, Darby, and Douay-Rheims from bible-api.com. KJV is not offered in the United Kingdom. See Terms.
- Tap the **cross** on a result card to save a personal favorite (sign in required).
- Across filter types, results must satisfy **all** active constraints.
- Results paginate (**Show more**) so large catalogs stay responsive.
- Click a feeling or theme tag on a result card to apply that filter.
- With an empty search and no filters, the page shows the **daily verse**, which changes at midnight Zurich time (Europe/Zurich). Press **Esc** in the search box to return to it.
- The daily verse is a **carousel of past days**: today shows first; swipe right, drag with the mouse, press ←, or tap **‹ Earlier** to step back to yesterday and earlier days (up to 60 days back). **Later ›** / → moves forward again, never past today. Each card is labelled “Today”, “Yesterday”, or its date (e.g. “Saturday 17 October”). Past days use the same deterministic Zurich-date picker, so each shows exactly the verse it showed on that day. Favorites and the Version filter work on every card.
- The site was renamed from “God’s Promises” to “Daily Promises” and then to **His Promise Daily**. Accounts and favorites now live in Supabase and are not copied from older browser-only saves. A chosen Bible version still has a device cache (`gods-promises-version`) and, while you are signed in, is stored on your profile.

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

- **Sign up / sign in:** `login.html` — email + password through Supabase Auth, including email verification and password reset. The Supabase client keeps the session. Passwords are not stored by this site.
- **Personal page:** `me.html` — name, email, Bible version, an opt-in for one promise by email each morning, favorites, sign out, and account deletion. Signed-out visits go to sign-in. The morning email is described in `docs/morning-email.md`.
- **Favorite control:** a Christian **cross** icon on each promise card (catalog + personal page). Outline = not saved; filled/emphasized = saved. Accessible `aria-pressed` with “Save favorite” / “Remove favorite”. Saved verses are rows in `public.favorites`.
- If you tap the cross while signed out, you’re sent to sign in.

### Subscription seam (no payments yet)

Config lives in `js/config.js`:

```js
subscriptionRequired: false  // stays false until a real payment integration exists
```

`supabaseUrl` and `supabaseAnonKey` are filled at build time in `dist/js/supabase-public.js`. See `docs/supabase-auth.md`.

- `js/subscription.js` exposes `canAccessFavorites(user)` and `canAccessApp(user)`.
- While `subscriptionRequired` is `false`, a signed-in person can use favorites. A disabled account cannot.
- The profile stores `none`, `inactive`, `active`, `canceled`, and `expired`. A canceled plan is treated as active only until `subscriptionExpiresAt`. The browser cannot change these fields.
- Payments are not implemented. A later server-side job may call `hpd_private.set_subscription`.

## Files

| File | Role |
|------|------|
| `index.html` | Catalog search UI |
| `login.html` | Sign in / create account |
| `me.html` | Personal favorites landing |
| `styles.css` | Layout and calm typography |
| `app.js` | Search / filter / pagination + favorite buttons |
| `js/config.js` | App name and `subscriptionRequired` (stays false) |
| `js/supabase-public.js` | Placeholder overwritten in `dist` with the public Supabase URL and anon key |
| `js/subscription.js` | Access checks for favorites / personal area |
| `js/auth.js` | Supabase Auth (`signUp`, `signIn`, `signOut`, `getCurrentUser`, `onAuthChange`, `whenReady`) |
| `js/favorites.js` | Per-user favorites in Supabase (`toggle`, `list`, `isFavorite`, all async) |
| `api/account.js` | Signed-in account deletion (service role stays on the server) |
| `js/ui-shared.js` | Cross icon, cards, auth nav helpers |
| `promises-data.js` | Embedded data (loaded by the page) |
| `promises.json` | Same data as structured JSON — **edit via catalog, then regenerate** |
| `scripts/catalog/` | Book-by-book curated metadata |
| `scripts/build_promises.py` | Fills WEB text from `web_index.json`, writes JSON + JS |
| `scripts/web_index.json` | Parsed engwebp verse index |
| `data/explanations.json` | One short original explanation per promise id, fetched after first paint |
| `scripts/explanations/` | Notes on how the explanations were written, plus `sources.json` (commentaries consulted per entry) |
| `js/feedback.js`, `api/feedback.js`, `supabase/migrations/` | “Was this explanation helpful?” feedback (server function + Supabase); see `docs/explanation-feedback.md` |

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
