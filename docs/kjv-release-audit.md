# Release audit, draft pull request 14

This is an operational audit. It is not a legal determination and it does not grant rights in the Authorized Version. IP geolocation is not legal compliance. A VPN can make a request look as if it came from an allowed country, and this site cannot detect that.

Checked on 13 November 2026. The application head before the guard commit was `db6cb0efc82cdd8cc724715be5ef5ba49668947d`. The commit that adds this document is the pull-request head; the summary posted with the audit names that SHA.

Protected files compared with `origin/main`: `data/explanations.json`, `promises-data.js`, `promises.json`, and `js/ui-shared.js` (`EXPLAIN_VERSION` is still `promise-4`). The diff is empty. **VERIFIED.**

## 1. Historical exposure

Closed, unmerged pull request 13 still points at commit `7d8606cbd47fad6e460142a6061c94d8a693bbba`. GitHub has not removed the files. Anonymous HTTP, recorded 13 November 2026:

| URL | Status |
| --- | --- |
| Commit page `.../commit/7d8606cbd47fad6e460142a6061c94d8a693bbba` | 200 |
| Blob page `.../blob/7d8606c.../scripts/kjv_index.json` | 200 |
| Blob page `.../blob/7d8606c.../data/kjv-spans.json` | 200 |
| `raw.githubusercontent.com/.../7d8606c.../scripts/kjv_index.json` | 200, 4,694,141 bytes |
| `raw.githubusercontent.com/.../7d8606c.../data/kjv-spans.json` | 200, 323,471 bytes |
| `api.github.com/.../git/blobs/04cbd02dd4fd65187580cf2b13ee92c09cd48660` | 200, base64 content present, size 4,694,141 |
| `api.github.com/.../git/blobs/bd96571b7020a0766afe2f7ad7d47d1a78a5ef6e` | 200, base64 content present, size 323,471 |
| Contents API for the index at that commit and at `refs/pull/13/head` | 200, download URL present |
| Contents API for the span file at that commit and at `refs/pull/13/head` | 200, base64 content present |
| Pull request page and Files Changed page | 200 |
| `codeload.github.com/.../tar.gz/7d8606c...` | 200, archive contains both paths |
| `codeload.github.com/.../zip/7d8606c...` | 200, archive contains both paths (4,694,141 and 323,471 bytes) |

`refs/pull/13/head` is still that commit. API state: `closed`, `merged` false, `merged_at` null. **VERIFIED.**

All 13 remote branches were fetched and their object graphs searched for both blob ids, the commit, and the two paths. Every branch is clean, including `main` and `cursor/kjv-gated-clean-38a5`. Of 14 pull-request head refs, only `refs/pull/13/head` contains the blobs. **VERIFIED.** Deleting the branch did not remove the pull-request ref, and GitHub still serves the blobs.

Vercel project `prj_eUzZehkqLo6gGVdYLDgnT4ZbFdJ9`, team `team_5ZLX5i3eFlu2Rkg80R1lcYDW`: 32 deployments, and a second page older than the earliest of those returned none. The old preview `dpl_HLkQ5yftNJUoxQymVtLFzGqgbChQ` is still `READY` (`gods-promises-1h2rxm6e8-actof-god.vercel.app`, alias `gods-promises-git-cursor-kjv-local-spans-38a5-actof-god.vercel.app`), built from `7d8606c`. There is no delete-deployment tool in this session and no `VERCEL_TOKEN`, so it was not deleted.

Anonymous requests to that preview redirect to Vercel SSO (302). With deployment authentication, `GET /scripts/kjv_index.json`, `GET /data/kjv-spans.json`, and `GET /api/kjv` return 404. The old build's public output directory did not contain those paths. Whether Vercel still stores the git source inside the deployment is **UNTESTED**. The owner should delete `dpl_HLkQ5yftNJUoxQymVtLFzGqgbChQ`.

`https://hispromisedaily.com/scripts/kjv_index.json` and `/data/kjv-spans.json` return 404 with no login. **VERIFIED.** Other preview hostnames are behind SSO. Their public KJV paths were not all fetched with authentication. **UNTESTED** except the old preview and the clean preview, both 404 for those paths.

If GitHub Support will not purge the objects, the remaining options are a support request (already drafted; not sent), a notice from the rights holder, or deleting and recreating the repository. Recreation drops issues, stars, the GitHub connection used by Vercel, and does not erase forks or clones. It is a last resort. None of those steps were taken.

## 2. Pull request 14 history

Before this audit commit, the branch had one commit, `db6cb0e`. `git rev-list --objects origin/main..db6cb0e` contains neither blob id and neither path. The exposure guard, run on every tracked file, finds no verse-hash cluster, no known whole-file hash, and no archaic-token density over the limit. The same guard passes on an archive of `origin/main` (185 files) and on `dist` (1,498 files). **VERIFIED.**

The full King James text cannot be rebuilt from the committed tree. The tree has the source URL, the upstream SHA-256, versification counts, and four short spot-check prefixes in `scripts/import_kjv.py`. It does not have the verse table. The build downloads the master into a temporary file and writes `api/_lib/kjv-spans.generated.json`, which is gitignored. `dist` receives `data/explanations.json` only from `data/`. **VERIFIED** by reading `scripts/build_site.py` and by the public-bundle scan.

On the clean preview, `GET /api/kjv.js` returns the 31-byte status JSON, not the function source. `GET /api/_lib/kjv-spans.generated.json` is 404. **VERIFIED.**

## 3. CI guard

`scripts/check_kjv_exposure.py` plus `scripts/kjv_exposure_fingerprints.json` (hashes only). It runs on every pull request and push, at the start of the existing workflows, and twice in the Vercel build: on the git checkout, and on `dist` after the site is built. How to regenerate the hashes is in `docs/kjv-exposure-guard.md`.

Results:

- Tracked files on this branch: pass. **VERIFIED**
- Archive of `main`: pass, 185 files. **VERIFIED**
- `dist`: pass, 1,498 files. **VERIFIED**
- Temporary renamed copies of the historical index and span file: fail (whole-file hash, git blob, verse hashes, archaic density). **VERIFIED**, not committed
- Gzip of the index, base64 of the index, and the span JSON embedded in a JavaScript file: fail. **VERIFIED**, not committed
- A throwaway git repository whose only commit was the span file under another name: fail. That repository was not this one and was not pushed. **VERIFIED**
- A short citation and a World English Bible sentence in a temporary file: pass. **VERIFIED**
- `tests/test_kjv_exposure.py`: 3 tests passed, using synthetic sentences rather than scripture. **VERIFIED**

## 4. Geo controls

Superseded. The paragraph below describes commit `ee68b0d`, when an unset allowlist still meant US, CA, AU, and DE. That default is gone. Current behavior is in `docs/kjv-admin-gate.md` and `docs/kjv-geo-gate-report.md`: the global switch defaults off, the allowlist defaults empty, and GB, GG, JE, and IM stay restricted.

`api/_lib/kjv-access.js` is the only allow/deny module. At `ee68b0d` the default allowlist was US, CA, AU, DE. Restricted, and denied unless both `KJV_ENABLE_RESTRICTED=true` and an allowlist entry exist: GB, GG, JE, IM. England, Wales, Scotland, and Northern Ireland all arrive as GB. Missing, blank, `XX`, `T1`, and `UNKNOWN` are denied. A thrown country lookup and a missing span file return no text (`503` for the missing file). Nothing in the repository sets the enable flag. **VERIFIED** at that commit by `tests/kjv-access.test.js`.

`Cache-Control: private, no-store` and `Vary: x-vercel-ip-country` are set on every API response. **VERIFIED** in the unit test and on the preview.

The service worker does not precache a King James URL. `/api/` bypasses the cache. The page writes Cache Storage only when `offline` is true. There is no IndexedDB store for the text. `localStorage` stores the version id under `gods-promises-version`, and a signed-in session does not write that key. **VERIFIED** by reading `sw.js` and `js/bible-versions.js`, and by `tests/kjv-preference.test.js` and `tests/share-and-sw.test.js`.

Preview `dpl_GdEAbye2LSZs4wMQDN1nYfscxuea` (commit `db6cb0e`), authenticated from this environment:

- `/data/kjv-spans.json`, `/scripts/kjv_index.json`, `/api/_lib/kjv-spans.generated.json`: 404
- `/api/kjv?ids=php-4-6-7` with no country header, and with `x-vercel-ip-country` set to GB, XX, empty, and US: all 200, same 298-byte body, `passages` present. The client header was ignored. This environment's IP is on the allowlist.
- `/api/kjv` with no ids: 200, 31 bytes, no `passages` key
- `/`: 200, World English Bible page

A live GB denial on the preview is **UNTESTED**. Vercel overwrites the country header, and this environment is not in GB. The denial paths are covered by the unit test, not by the preview.

## 5. Content validation

`tests/test_kjv_import.py` downloaded the pinned file, checked SHA-256 `f0b09dc49dfb97bb84f03aae1fbf026485048c3cab31a7a41017e2d86ac1d11c`, and checked 66 books, 1,189 chapters, 31,102 verses, no gaps. The generated passage file has the same 1,188 ids as `promises-data.js`. John 3:16–17 starts with the expected short prefix. **VERIFIED** (the download is not committed). `scripts/kjv_versification.json` is counts only.

Psalm 23:1 in that source includes the superscription in verse 1. That is a property of the source, recorded here so a reviewer does not treat it as a join bug.

## 6. Semantic results

Precision against the project's curated evaluation set: @5 1.000, @10 0.770. Keyword baseline @5 0.261. **VERIFIED**, `tests/discovery.test.js`.

`tests/discovery-meanings.test.js`: 158 checks passed. `tests/kjv-parity.test.js`: the 16 feelings and 75 themes, plus five searches, return the same ids for WEB and KJV wording. Switching translation does not change promise ids. **VERIFIED.**

## 7. Regression

Python `unittest`: 20 tests passed, including reachability of 1,460 public URLs, the shipped catalog regression (0 changed WEB texts), and the exposure guard.

Node: kjv-access, kjv-preference, kjv-parity, behavior regression, discovery, discovery-meanings, filter presentation, share and service worker, analytics, safe-next (31), feedback API, feedback widget, account API, and auth-cloud passed.

`tests/auth-cloud.test.js` had been failing because loading the version module called `fetch` synchronously and the test's stub throws. `requestKjv` now turns that throw into a rejection, which the existing fail-closed path already handles. The same test now asserts that a new account does not inherit the device version. That assertion replaced the old expectation that the device value was copied onto the profile. **VERIFIED** by rerunning the test.

Sign-in is not configured in this build (`SUPABASE_ANON_KEY` empty). Browser sign-in, favorites, and feedback against the live project were not exercised in a browser. The client and API tests cover those flows with fakes. Live browser account flows are **UNTESTED**.

Preview screenshots at 1280 and 390, deployment `dpl_GdEAbye2LSZs4wMQDN1nYfscxuea`: Job 23:13–14 shows the catalog wording on WEB and the King James wording when KJV is selected. The explanation and feedback controls stay on the card. **VERIFIED.**

## 8. Security

Environment names read from code, values not printed: `KJV_ALLOWED_COUNTRIES`, `KJV_ENABLE_RESTRICTED`, `KJV_RESTRICTED_COUNTRIES`, `KJV_SPANS_PATH`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FEEDBACK_HASH_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`. No secret file is tracked. `build_site.py` refuses to read the service-role key. **VERIFIED** by search.

There is no `.vercelignore`. Public output is whatever `scripts/build_site.py` writes to `dist`. The King James span file is not in that copy list. **VERIFIED.**

Project `ixxeidpdgktzvcbucosq` only, read-only. RLS is on for `public.profiles`, `public.favorites`, `public.daily_email_sends`, and the four `hpd_feedback` tables. Policies: `profiles_select_own`, `profiles_update_own`, `favorites_select_own`, `favorites_insert_own`, `favorites_delete_own`. No favorites or profile policy for `anon`. The feedback tables have RLS and no policies. `hpd_feedback_submit`, `hpd_feedback_status`, and `hpd_feedback_search_submit` are security definer and granted to `postgres` and `service_role` only. **VERIFIED.** No migration was applied.

Preview deployments redirect anonymous clients to Vercel SSO. **VERIFIED.**

## 9. Outstanding risks and owner actions

1. GitHub still serves both historical files by commit SHA, blob SHA, the contents API, and codeload archives, because `refs/pull/13/head` still exists. A support purge is the realistic fix. Repository recreation is a last resort and does not erase clones.
2. Delete Vercel deployment `dpl_HLkQ5yftNJUoxQymVtLFzGqgbChQ`. Its public KJV paths already 404. The deployment record and any stored source should still go.
3. Do not set `KJV_ALLOWED_COUNTRIES` or `KJV_ENABLE_RESTRICTED` until there is written permission. A deploy does not turn a restricted territory on.
4. A visitor in a restricted country who exits through an allowed-country VPN receives the text. The site cannot see the VPN.
5. Live browser sign-in was not run here.
6. The importer docstring still mentions a committed index in one line. The code path used by the build does not write that file.

## 10. Recommendation

The branch is ready for human review. It is not a recommendation to merge today. Merge should wait until the owner has decided what to do about the historical GitHub objects and the old preview deployment. Those are outside this pull request. The code, the guard, and the tests on this branch do what the gated design asked: WEB stays the public catalog, and King James text is not in git or in `dist`.
