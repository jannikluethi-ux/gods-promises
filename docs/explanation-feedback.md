# Explanation feedback

“Was this explanation helpful?” under every verse explanation: homepage/search/favorites cards
(`js/ui-shared.js` → `js/feedback.js`) and all static verse pages (`scripts/build_site.py`).
Feedback is collected for **human review only**. Nothing reads it back into the site, and no
explanation is ever rewritten or replaced automatically.

## How it fits together

| Piece | Where |
| --- | --- |
| Widget (markup, states, delegated events, localStorage UX cache) | `js/feedback.js`, styles in `styles.css` (“Explanation feedback”) |
| Card hook (widget under `.card-explain-text`, tied to `EXPLAIN_VERSION`) | `js/ui-shared.js` (`feedbackHtml`) |
| Verse-page hook (placeholder + deferred, content-hashed script) | `scripts/build_site.py` (`verse_page`, `explain_version`) |
| Server function `POST /api/feedback`, `GET /api/feedback?verseId=&v=` | `api/feedback.js`, `api/_lib/feedback-core.js` |
| Database (table, RPCs, rate limits, analytics views) | `supabase/migrations/20261109120000_explanation_feedback.sql` and `20261110153000_profiles_favorites_auth.sql` |

The browser only talks to the same-origin `/api/feedback`. The function validates everything,
derives book/chapter/verse/reference and the SHA-256 of the exact explanation text from the
deployed `promises.json` / `data/explanations.json`, and calls two Supabase RPCs with the
service-role key. Each row records the explanation version **and** the text hash, so feedback
on different versions of an explanation stays separate. Bumping `EXPLAIN_VERSION` (as already
required whenever `data/explanations.json` changes) lets readers rate the new version again.

## Required environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://ixxeidpdgktzvcbucosq.supabase.co` (existing project `his-promise-daily`, Zurich). Do not create another project. |
| `SUPABASE_SERVICE_ROLE_KEY` | that project’s secret / service-role key (server only, never in client JS) |
| `FEEDBACK_HASH_SECRET` | random string, ≥ 32 chars (e.g. `openssl rand -base64 48`); HMAC key for cookie and IP hashes |

Without all three the API fails closed with `503 {"error":"feedback_unavailable"}` and the widget
shows a gentle “couldn’t be sent” message. Rotating `FEEDBACK_HASH_SECRET` resets duplicate
detection for existing cookies (old rows stay).

## Applying the migrations

Use only the existing project `his-promise-daily` (`ixxeidpdgktzvcbucosq`). Apply
`supabase/migrations/` in filename order with the Supabase CLI (`supabase db push`) or the
SQL editor. Do not apply them to any other project. Afterwards, on a **throwaway** database
only: `node tests/run-sql.js` (in-memory Postgres; it does not touch production).

## Security model

- Raw feedback lives in the private schema `hpd_feedback` (not exposed by the Data API), RLS on,
  no policies, no grants to `anon`/`authenticated`. Writes go only through
  `public.hpd_feedback_submit`, reads of “did I already submit?” only through
  `public.hpd_feedback_status`; both are `SECURITY DEFINER`, `search_path=''`, and executable
  only by `service_role`. No endpoint returns anyone’s feedback rows.
- Anonymous submitter = httpOnly, Secure, SameSite=Strict cookie `hpd_fb` (random 256-bit,
  scoped to `/api/feedback`), stored only as an HMAC. Unique `(submitter_key, verse_id,
  explanation_version)`; duplicates return `409 already_submitted`.
- New rows store `local_user_id` as null. That column is historical only.
- If the browser sends `Authorization: Bearer <access token>`, the server asks Supabase Auth
  who that token is and stores that `auth.users` id in `auth_user_id`. A user id in the JSON
  body is ignored. Anonymous submissions (no token, including static verse pages) still work
  and store a null auth id. The id is not used for de-duplication or authorization of the
  feedback itself. Deleting the account sets `auth_user_id` back to null and keeps the row.
- Same-origin check (`Origin` = request host, `Sec-Fetch-Site`), JSON-only, 4 KB body cap,
  unknown fields rejected, category allowlists in server **and** database check constraints,
  comment ≤ 500 chars with control/bidi characters stripped and link-spam rejected, honeypot.
- Rate limits: 10 POST/min per IP per function instance, plus database limits of 15 attempts per
  submitter and 30 per IP per 10 minutes, 300 per IP per day (HMAC’d keys, pruned after 2 days).
- Comments are stored as plain text. Any future admin UI must escape them when rendering.

## Analytics (private schema `hpd_feedback_analytics`, `security_invoker` views)

`totals`, `rating_by_version`, `category_counts`, `explanation_summary` (per verse + version +
text hash, with a count column per problem category), `poor_explanations` (≥ 5 ratings,
≥ 60 % negative), `top_explanations` (≥ 5 ratings, ≥ 90 % positive), `daily_trend`,
`weekly_trend`, `comments_for_review`, `comment_theme_counts`. Theme tagging of comments goes
into `hpd_feedback.comment_reviews` (status, themes, notes), which is the hook for a later admin
dashboard or a separately approved, human-reviewed AI-assisted improvement process. Query them
in the Supabase SQL editor; they are not reachable with the anon key.

## Tests

- `node tests/feedback-api.test.js`: validation, allowlists, duplicates, cookies, origin, fail-closed, rate limits.
- `node tests/feedback-widget.test.js`: markup, labels, states cache, card hook.
- `python3 -m unittest discover -s tests -p 'test_*.py'`: every verse page has exactly one widget and one deferred feedback script.
- `tests/sql/explanation_feedback_checks.sql`: grants/RLS/RPC behavior on a throwaway Postgres with Supabase roles.
- `tests/e2e/feedback-widget.e2e.js`: browser flow + screenshots against `scripts/dev_feedback_server.js` (local only).
