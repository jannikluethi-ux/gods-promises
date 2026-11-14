# King James text

This note is a build record. It is not a legal determination and it does not grant rights in the Authorized Version.

## Source

The master is the file labeled King James Version (1769) in [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) at commit `e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c`.

- URL: `https://raw.githubusercontent.com/scrollmapper/bible_databases/e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c/formats/json/KJV.json`
- SHA-256: `f0b09dc49dfb97bb84f03aae1fbf026485048c3cab31a7a41017e2d86ac1d11c`
- Canon: 66 Protestant books, no Apocrypha
- Checked on 2026-11-13: 66 books, 1,189 chapters, 31,102 verses, no duplicate keys, no missing verse numbers
- Book names are mapped onto the catalog names (`1 Samuel`, `Psalms`, `Revelation`, and so on)
- The passage file uses the same promise ids and verse ranges as `promises-data.js` (1,188 spans)

`python3 scripts/import_kjv.py --fetch` downloads that URL, refuses a checksum mismatch, checks `scripts/kjv_versification.json`, and writes `api/_lib/kjv-spans.generated.json`. That file is gitignored. The production build runs the fetch before `scripts/build_site.py`. The span file is listed only in the `api/kjv.js` function bundle. It is not copied into `dist`.

## Where text is sent

`api/_lib/kjv-access.js` is the only allow/deny rule. `KJV_GLOBAL_ENABLED` defaults off and `KJV_ALLOWED_COUNTRIES` defaults empty, so a deploy sends no King James text. GB, GG, JE, and IM are always restricted. `UK` and the nation codes `ENG`, `SCT`, `WLS`, and `NIR` are treated as GB. A missing, empty, unknown, malformed, or failed country receives no text.

To send text at all, set `KJV_GLOBAL_ENABLED` to the string `true` and `KJV_ALLOWED_COUNTRIES` to an explicit comma-separated list, then redeploy. A restricted territory stays off unless `KJV_ENABLE_RESTRICTED=true` is also set after written Cambridge permission. None of these variables are set by this repository. See `docs/kjv-admin-gate.md`. A deploy does not turn the gate on.

Responses use `Cache-Control: private, no-store`. The service worker stores King James passages only when the API response sets `offline` to true.
