# Final technical hardening

On top of `290fae6841fadf30d82cad628c2b1d5eef6e7222`. No copyright permission was obtained. King James distribution stays unauthorized: the global switch is off and the allowlist is empty. This is not a legal determination.

## 1. Commits

| SHA | Subject |
| --- | --- |
| `370b79c42693e46b158657d24ac2033f8ec326fd` | Fail closed on malformed King James configuration and oversized requests |
| this document | The head after `370b79c`. `290fae6` and `ee68b0d` remain in the history |

## 2. Files changed in `370b79c`

`api/_lib/kjv-access.js`, `api/kjv.js`, `tests/kjv-access.test.js`, `tests/kjv-access-audit-db.test.js`, `tests/run-sql.js`, `tests/e2e/feedback-widget.e2e.js`, `scripts/run-js-tests.sh`, `.github/workflows/seo-checks.yml`, `.github/workflows/pages-migration.yml`, `supabase/migrations/20261114103000_kjv_access_audit.sql`, `docs/kjv-admin-gate.md`, `docs/kjv-geo-gate-audit.md`, `docs/kjv-geo-gate-report.md`, `docs/kjv-release-audit.md`.

Not changed: `authorizeKjv`'s order for a valid configuration, `scripts/check_kjv_exposure.py`, `js/discovery.js`, `data/explanations.json`, `promises-data.js`, `promises.json`, `EXPLAIN_VERSION`.

## 3. Security issues resolved

- Switches accept only the exact string `true`. Unset, empty, and exact `false` are off. `TRUE`, ` true `, `1`, `yes`, and a zero-width character are `config_invalid`, the gate stays off, and the public body does not contain that reason. The log line names the variable and not its value.
- Country lists are comma-separated ISO 3166-1 alpha-2 codes, optional spaces, either case. `UK`, `ENG`, `SCT`, `WLS`, and `NIR` still mean `GB`. Any other token rejects the whole list and denies everyone.
- A bad country is still reported as unknown, malformed, or a lookup error before the config reason, which is the previous order.
- Cache headers are set before the URL is parsed. `http://[` returns 400 with those headers and no verse text.
- More than 24 ids, a raw `ids` value over 1024 bytes, or any id that fails the pattern returns 400. The list is not truncated.
- Docs that described US, CA, AU, and DE as the current default are marked superseded.

## 4. Migration

`supabase/migrations/20261114103000_kjv_access_audit.sql` was edited in place because it has never been applied. Row security is enabled and forced. `anon` and `authenticated` have no grants. `service_role` can read and update the config row. A security-definer trigger with an empty search path writes the audit row, including the previous JSON, the new JSON, `changed_by`, the reason, `auth.uid()`, the session user, the current user, and the time. A blank name or reason is rejected. `service_role` has no insert, update, delete, or truncate on the audit table, and triggers reject those statements. There is no sequence.

The table owner and superusers (`postgres`, `supabase_admin`) can disable triggers or delete rows. The Supabase SQL editor runs as a privileged role. This is not absolute immutability. The file was not applied to `ixxeidpdgktzvcbucosq`.

## 5. Tests

Against `370b79c` before this document:

- Python `unittest`: 20 tests, OK. Includes the pinned-source import check (66 books, 31,102 verses, 1,188 span ids) and the exposure guard.
- JavaScript: 18 / 18 files under `tests/*.test.js`, each exited 0. That includes the four that CI used to skip: `tests/share-and-sw.test.js`, `tests/daily-email.test.js`, `tests/daily-verse.test.js`, and `tests/search-feedback-db.test.js`. CI now runs that whole directory via `scripts/run-js-tests.sh`.
- `tests/discovery-meanings.test.js`: 158 checks.
- Precision against the project's curated evaluation set: @5 1.000, @10 0.770. Keyword baseline @5 0.261. Unchanged.
- `tests/safe-next.test.js`: 31 cases.
- `tests/kjv-access-audit-db.test.js` on throwaway PGlite: passed. `tests/run-sql.js` also applied the migration and the older SQL checks passed.
- Scanner: 208 tracked files at `370b79c` (206 was the tree at `290fae6`; 205 was that tree before `docs/kjv-geo-gate-report.md` was added). `dist` after `build_site.py --target production`: 1,498 files, passed. This document makes the tracked count 209.
- Playwright `tests/e2e/feedback-widget.e2e.js`: passed locally against `http://127.0.0.1:18790` and `:18791` with an in-memory fake. The signed-in association was skipped because sign-in is not configured. It does not call production or Supabase. A separate CI job runs the same command. Its GitHub result is reported with the pull request after that job finishes; it had not been observed on GitHub when this file was written.

## 6. Remaining technical limitations

- `current_user` inside the security-definer trigger is the function owner, not the invoker. The required `changed_by` column is the administrator name. `session_user` is the database login.
- A superuser can still bypass the audit triggers.
- Vercel may not echo `Vercel-CDN-Cache-Control` back to the client. The function still sets it, with `Cache-Control: private, no-store` and `CDN-Cache-Control: no-store`.
- A VPN is invisible. It does not matter while the global switch is off.
- Live proof that Vercel overwrites a forged `x-vercel-ip-country` was observed on an earlier preview, not repeated as a country-by-country matrix on this head. This head's preview, once built, is expected to deny every country because the switch is off.

## 7. Outstanding external dependencies

- GitHub Support, if the historical objects should disappear: commit `7d8606cbd47fad6e460142a6061c94d8a693bbba` and `refs/pull/13/head` still serve the old files.
- The `solution-guru` Vercel team still had a project deploying this branch. Disconnecting it and deleting its deployments is that team's action. This session cannot administer that team.
- Written Cambridge permission is still required before `KJV_ENABLE_RESTRICTED` may be set. It is unset.
- Real-world geolocation from inside GB, JE, GG, and IM has not been observed from this environment.

Pull request 14 stays a draft. It was not merged. No production deploy and no production migration were run. `KJV_GLOBAL_ENABLED` is not `true`. The allowlist is empty.
