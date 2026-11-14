# King James geo gate audit

Superseded as a description of the current defaults. This note is the inspection of `ee68b0d5cb1822c732c57e387add4d3be3a10c2a`, when an unset allowlist still authorized US, CA, AU, and DE. The current gate defaults the global switch off and the allowlist empty. See `docs/kjv-admin-gate.md`.

Inspected before the gate change in the following commits. This is an operational review. It is not a legal determination and it does not grant rights in the Authorized Version.

## What decides access today

`api/_lib/kjv-access.js` is the only allow/deny module. `api/kjv.js` is the only route that reads it.

- The country comes only from `x-vercel-ip-country`. The code does not read `cf-ipcountry`, `x-country`, a query parameter, or a cookie.
- On Vercel, the platform overwrites incoming `x-vercel-*` headers at the edge. A browser cannot keep a forged `x-vercel-ip-country`. That was observed on the preview for commit `db6cb0e`: GB, XX, an empty value, and US sent by the client all produced the same response as no extra header. This environment's IP was allowlisted, so the body contained one passage. A live denial for GB on the preview was not observed.
- Missing, blank, `XX`, `T1`, and `UNKNOWN` are denied. A thrown lookup is denied.
- Restricted set: GB, GG, JE, IM. England, Wales, Scotland, and Northern Ireland are not separate codes here; Vercel reports them as GB. The code does not map a `UK` alias or `ENG` / `SCT` / `WLS` / `NIR`.
- If `KJV_ALLOWED_COUNTRIES` is unset, the allowlist falls back to US, CA, AU, DE. Those four are therefore authorized without any explicit configuration.
- There is no global off switch. A deploy of this commit sends King James text to an allowlisted country.
- `KJV_ENABLE_RESTRICTED=true` plus an allowlist entry can turn a restricted territory on. The repository does not set that variable. The documented step is written permission, then both variables, then a redeploy. Nothing in a deploy sets it.

## Supabase

Project `ixxeidpdgktzvcbucosq` stores `profiles.preferred_bible_version`. The column already allows `web`, `kjv`, `asv`, `ylt`, `darby`, and `dra`. It stores a code, not verse text. Favorites store promise ids. Feedback tables store ratings, not scripture. No bible text table exists. This audit did not write to the database.

There is no admin table and no audit log for the gate. The only controls are server environment variables. Ordinary requests cannot change them. Vercel account members change them in the dashboard. This repository does not record those edits.

## Routes that can carry scripture

| Route | Text it sends | King James? |
| --- | --- | --- |
| `GET /api/kjv` and `GET /api/kjv?ids=` | Passages from `api/_lib/kjv-spans.generated.json` when the gate allows. The file is gitignored and bundled only into that function. | Yes. This is the only King James route. |
| `GET /`, `/verses/{id}.html`, listings, sitemap | World English Bible baked by `scripts/build_site.py` from `promises.json` | No |
| `GET /data/explanations.json` | Original explanations, not verse text | No |
| `GET /api/og` | Share card from `promises.json` via `api/_lib/verse-catalog.js`. The card is labeled WEB. | No |
| `GET/POST /api/daily-email` | Morning mail from the same WEB catalog. The template labels WEB. Cron is `0 5 * * *`. | No |
| `POST /api/feedback`, `POST /api/account`, unsubscribe | No scripture body | No |
| Client search and feeling/theme studies | Rank catalog ids in the browser. The haystack and the cards use `promises-data.js` (WEB) until `/api/kjv` replaces a card. | Only after a successful `/api/kjv` response |
| Service worker | Precaches the shell and WEB catalog. `/api/` is not cached. A `kjv-offline` message can store passages in the Cache API when `offline` is true. The page writes that cache itself after an allowed response. | Yes, after an allow, in browser storage |
| `bible-api.com` | ASV, YLT, Darby, Douay-Rheims only. KJV has `api: null` and is not requested from that host. | No |

`vercel.json` has no rewrites that point at the span file. The only redirect is `/index.html` to `/`. There is no middleware file. Static output copies `data/explanations.json` and does not copy a King James file.

A denied `/api/kjv` response is `{allowed:false, offline:false, message}` and does not include a `passages` key. Headers are `Cache-Control: private, no-store` and `Vary: x-vercel-ip-country`. There is no `CDN-Cache-Control` or `Vercel-CDN-Cache-Control` header.

## Client

The version menu always lists KJV. If the status call says not allowed, or the call throws, a saved KJV choice is shown as WEB without writing the profile or the device key. The card can still show the unavailable sentence. The menu does not hide KJV. Other translations stay on their own requests.

## Gaps this change has to close

1. US, CA, AU, and DE are allowed when no environment variable is set. The required default is a global switch off and an empty allowlist.
2. A restricted code can be allowed without a global switch, if `KJV_ENABLE_RESTRICTED` and the allowlist both name it.
3. `UK` and the nation codes are not normalized to GB.
4. Denied and allowed responses are not marked `no-store` on the CDN cache headers.
5. After an allow, the page and the service worker can keep King James text in the Cache API.
6. The menu still offers KJV when the server has refused it.
7. There is no append-only record of who changed the gate. Environment edits, if made later, show up in Vercel's own audit log and nowhere in this repo.
