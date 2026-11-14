# King James gate report

Operational report for the commits on top of `ee68b0d5cb1822c732c57e387add4d3be3a10c2a`. Not a legal determination. IP geolocation is not legal compliance. A VPN that exits in an allowlisted country would be treated as that country if the global switch were on. The switch is off, so that path currently sends nothing.

The audit of the previous gate is `docs/kjv-geo-gate-audit.md` (`f7aae1bd2d233369869db0623712924a44135fcb`). The gate change is `c8397f7e2db8d984c905e49159395b9f2f26d136`. This file is the following commit.

## 1. Existing control assessment

Before this change, an unset allowlist meant US, CA, AU, and DE received King James text, and there was no global off switch. Restricted territories could be opened with `KJV_ENABLE_RESTRICTED` plus an allowlist entry, without a global switch. The menu always offered KJV. Allowed responses could be stored in the Cache API. Details are in the audit note.

## 2. Files changed

`api/_lib/kjv-access.js`, `api/kjv.js`, `js/bible-versions.js`, `sw.js`, the King James access and preference tests, the service-worker cache assertion, the pinned script hash, the public terms and footer lines, `docs/kjv-provenance.md`, `docs/kjv-admin-gate.md`, and an unapplied migration `supabase/migrations/20261114103000_kjv_access_audit.sql`.

Not changed: `scripts/check_kjv_exposure.py` and its workflow, `js/discovery.js`, `data/explanations.json`, `promises-data.js`, `promises.json`, and `EXPLAIN_VERSION` (`promise-4`).

## 3. Authorization architecture

`authorizeKjv(req, env)` in `api/_lib/kjv-access.js` is the only decision. `api/kjv.js` calls it on every request.

Access requires all of the following:

1. `KJV_GLOBAL_ENABLED` is the string `true`.
2. The country is present, two letters, and not `XX`, `T1`, or `UNKNOWN`. `UK`, `ENG`, `SCT`, `WLS`, and `NIR` become `GB`. Anything else malformed is denied.
3. The country is not in the built-in restricted set `GB`, `GG`, `JE`, `IM`, unless `KJV_ENABLE_RESTRICTED` is `true`. That flag is the written-Cambridge-permission path. It still requires the global switch and an allowlist entry. It is unset.
4. The country is in `KJV_ALLOWED_COUNTRIES`. The default list is empty. Unset does not mean "everyone else."

The country is read only from `x-vercel-ip-country`. `cf-ipcountry`, `x-country`, and `?country=` are ignored. On Vercel the platform overwrites `x-vercel-*` headers, so a browser-supplied value does not survive. The function does not prefer any other header if that one is missing: a missing header is a denial.

A denial body is only `{allowed:false, offline:false, message:"KJV is not available in your region."}`. It has no passage text and no configuration.

## 4. Protected routes

| Route | King James |
| --- | --- |
| `GET /api/kjv` | Only this route can return it, and only after `authorizeKjv`. With the defaults it returns the denial body. |
| Search, feeling and theme studies | Browser ranking of the WEB catalog. No server search route. Card text changes only if `/api/kjv` allows it. |
| `/`, `/verses/{id}.html`, sitemap, listings | WEB baked at build time |
| `GET /api/og` | WEB share card |
| `/api/daily-email` | WEB morning email |
| Feedback, account, unsubscribe | No scripture |
| `bible-api.com` | ASV, YLT, Darby, Douay-Rheims. KJV is not requested there |

## 5. Cache and service worker

Allowed and denied `/api/kjv` responses set `Cache-Control: private, no-store`, `CDN-Cache-Control: no-store`, `Vercel-CDN-Cache-Control: no-store`, and `Vary: x-vercel-ip-country`. `offline` is false, so a client that cached only when the server set `offline: true` does not store the body. The page no longer writes the Cache API. The service worker no longer accepts a `kjv-offline` message. Its shell cache is `hpd-shell-v8` and does not list a King James URL. `/api/` still bypasses the service worker. Static `dist` (1,498 files) passed the exposure scanner.

## 6. Admin access

There is no in-app admin screen and no public config endpoint. The four variables are changed by a Vercel team member in the project settings. Vercel's audit log is the record of those edits. This app does not copy that log.

`supabase/migrations/20261114103000_kjv_access_audit.sql` sketches a later `hpd_admin` config row and an append-only audit table, granted to `service_role` only. It is not applied and not called by the API.

## 7. Security tests

`tests/kjv-access.test.js` passed. Simulated, not a live Vercel geo observation:

- Global off, including US, CA, AU, DE, FR, GB: denied, reason `global_off`
- Global on and US allowlisted: allowed, `offline` false, one test snippet
- Global on and GB, UK, ENG, SCT, WLS, NIR, GG, JE, IM allowlisted: denied, reason `restricted`
- Global off with the Cambridge flag and GB allowlisted: denied
- Global on, Cambridge flag, GB allowlisted: allowed
- Cambridge flag without GB on the allowlist: denied
- Missing, blank, XX, T1, UNKNOWN, GBR, and a throwing country: denied
- `x-country` and `cf-ipcountry` without the Vercel header: denied
- Vercel header GB plus forged US headers: denied
- Direct `/api/kjv?ids=` for US with the default env: denial body, no snippet, private no-store and both CDN no-store headers
- Same for GB, JE, GG, IM, UK, ENG when the switch is on
- Global turned off after an allow: denied
- Missing span file while allowed: 503 and no snippet

`tests/kjv-preference.test.js`: a device value of `kjv` displays WEB and the stored value stays `kjv`. Sign-in still does not copy the device value onto an empty profile.

Local server on this machine, global switch unset, country header forced to US: `GET /api/kjv?ids=php-4-6-7` returned `allowed: false` and the neutral message, 82 bytes, no passage. The static King James paths returned 404. In the browser the version menu was WEB, ASV, YLT, Darby, and Douay-Rheims. With `gods-promises-version` set to `kjv`, the card stayed on the World English Bible wording, the note was "KJV is not available in your region.", and the stored value remained `kjv`.

The new preview that Vercel builds from the push of this branch was not observed when this file was written. Do not treat the earlier preview, which still allowed an allowlisted IP, as evidence for this gate.

## 8. Scanner

`python3 scripts/check_kjv_exposure.py --git` passed for 205 tracked files before this report was added, and for 206 once this report was the newest tracked file. Those two numbers are the same tree plus this document. `--root dist --public` passed for 1,498 files. The scanner script and its thresholds were not edited. The count at the later hardening head is in `docs/kjv-final-hardening.md`.

## 9. Remaining weaknesses

- Live Vercel geo for this commit is not verified here. Header spoofing was verified in unit tests and, on the previous preview, the platform ignored a client `x-vercel-ip-country`. That observation was not repeated against this commit's deployment.
- A VPN is invisible. It does not matter while the global switch is off. If the switch is later turned on, an exit node in an allowlisted country receives the text.
- Vercel environment history is outside this repository. The unused admin table does not record anything until it is applied and wired, which this change does not do.
- GitHub still serves the historical files from closed pull request 13. That is unchanged.
- The old preview `dpl_HLkQ5yftNJUoxQymVtLFzGqgbChQ` was still present at the last audit. It was not deleted.

## 10. Config state

`KJV_GLOBAL_ENABLED` is unset in git and was not set in Vercel by this change. `KJV_ALLOWED_COUNTRIES` is unset, so the allowlist is empty. Restricted codes are GB, GG, JE, and IM. `KJV_ENABLE_RESTRICTED` is unset. No territory is authorized. A failed authorization returns no King James text.

Pull request 14 stays a draft. It was not merged. No production deploy and no production migration were run.

## Regression

Python unittest: 20 passed, including the pinned-source import check and the exposure guard. Node: access, preference, parity (same ids for 16 feelings and 75 themes), behavior, auth, discovery, meanings, filters, service worker, analytics, safe-next (31), feedback, and account passed.

Precision against the project's curated evaluation set: @5 1.000, @10 0.770. Keyword baseline @5 0.261. Unchanged. The discovery engine was not edited.
