# His Promise Daily — Supabase Auth

Accounts, favorites, and signed-in preferences use the existing Supabase project. Production stays on **Vercel** at https://hispromisedaily.com. This is not a Cloudflare Pages app.

| | |
| --- | --- |
| Project | `his-promise-daily` |
| Ref | `ixxeidpdgktzvcbucosq` |
| Region | `eu-central-2` (Zurich) |
| API URL | `https://ixxeidpdgktzvcbucosq.supabase.co` |

Do not create a second Supabase project. Feedback (`hpd_feedback`) and accounts share this one.

## What is code-complete

- Email/password sign-up, email verification messaging, sign-in, password reset, session restore, and sign-out in `js/auth.js` via `@supabase/supabase-js` 2.119.0.
- `whenReady()` finishes restoring the session before the header or `me.html` decides someone is signed out.
- `public.profiles` is created by a trigger on `auth.users`. The owner can change display name, Bible version, and `reading_prefs`. Subscription and account status are not client-writable.
- `public.favorites` replaces `gp_favorites_v1_*`. `toggle`, `list`, and `isFavorite` are async.
- `POST /api/account` deletes the Auth user after verifying the bearer token. Profile and favorites cascade. Feedback rows stay, with `auth_user_id` set to null.
- Anonymous explanation feedback is unchanged. A signed-in card may send the access token; the server stores `auth_user_id` only after Auth confirms it. `EXPLAIN_VERSION` is still `promise-4`. `data/explanations.json` is unchanged.
- `subscriptionRequired` stays `false`. The profile can represent `none`, `inactive`, `active`, `canceled`, and `expired`.

## How the static site gets the public key

`scripts/build_site.py` writes `dist/js/supabase-public.js` at build time.

| Environment variable | Role |
| --- | --- |
| `SUPABASE_URL` | Optional at build time. Defaults to `https://ixxeidpdgktzvcbucosq.supabase.co`. Already set on the Vercel project for the feedback function. |
| `SUPABASE_ANON_KEY` | **Build-time.** Public anon or publishable key, written into `dist/js/supabase-public.js`. |
| `SUPABASE_PUBLISHABLE_KEY` | Build-time fallback if `SUPABASE_ANON_KEY` is empty. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Runtime, server only** (`api/feedback.js`, `api/account.js`). The build refuses to embed a service-role or `sb_secret_` value. |
| `FEEDBACK_HASH_SECRET` | Runtime, server only. Unchanged. |

`vercel.json` builds with `npm ci && python3 scripts/build_site.py --target production` and serves `dist`. Pages load `js/config.js`, then `js/supabase-public.js`, then `js/vendor/supabase.js` (the official UMD build copied from `node_modules`).

A build without `SUPABASE_ANON_KEY` still publishes the catalog and prints a warning. Sign-in shows “not configured” until the key is present at **build** time and the site is rebuilt. Putting the key only in Vercel’s runtime environment does not update the static file.

The source placeholder `js/supabase-public.js` stays empty and is safe to commit. `js/vendor/supabase.js` in the repo is a stub; `dist` receives the real library.

## Migrations

Apply these files, in order, on `ixxeidpdgktzvcbucosq` only. This change does **not** apply them to the live database.

1. `supabase/migrations/20261109120000_explanation_feedback.sql` (already live)
2. `supabase/migrations/20261110153000_profiles_favorites_auth.sql` (new)

Use the Supabase CLI (`supabase db push`) or the SQL editor. Then run `node tests/run-sql.js` locally. That uses in-memory Postgres and does not connect to production.

### Tables

- `public.profiles` — `id` references `auth.users`, email, display name, account status, Bible version, reading prefs, subscription status / expiry / cancellation timestamps.
- `public.favorites` — `id`, `user_id`, `promise_id`, `created_at`, unique `(user_id, promise_id)`.
- `hpd_feedback.explanation_feedback.auth_user_id` — nullable, `on delete set null`. `local_user_id` is no longer written.

### RLS

- `profiles_select_own`, `profiles_update_own` — `id = (select auth.uid())`. No insert or delete policy. Authenticated users may update only `display_name`, `preferred_bible_version`, and `reading_prefs`.
- `favorites_select_own`, `favorites_insert_own`, `favorites_delete_own`.
- `anon` has no grants on these tables.
- `hpd_private` is not granted to `anon` or `authenticated`. `hpd_private.set_subscription` is `security definer` and executable by `service_role` only.
- Trigger functions that seed or protect profiles live in `hpd_private`. `raw_user_meta_data` is read only to seed a display name. Policies do not use it.
- Feedback tables stay in the private schema with RLS and no policies. `public.hpd_feedback_submit` remains service-role only and now takes `p_auth_user_id`. The old local-id argument is discarded.

## Auth redirects

The client uses the implicit email-link flow so a verification or reset link works in the browser that opens it. After sign-in, favorites come from the database on any device.

In the Supabase dashboard for this project:

- Site URL: `https://hispromisedaily.com`
- Redirect URLs:
  - `https://hispromisedaily.com/login.html`
  - `https://www.hispromisedaily.com/login.html`
  - `http://localhost:8080/login.html`
  - `http://127.0.0.1:8080/login.html`
- Enable email confirmations.
- Minimum password length: 8.
- Add a Vercel preview origin only if you need email links to return there. The client uses `location.origin` for `*.vercel.app` and localhost, and `https://hispromisedaily.com` otherwise.

## Auth emails

The six branded messages in `supabase/templates/` are the source to paste into Supabase Dashboard > Authentication > Emails for `ixxeidpdgktzvcbucosq` ([Email templates](https://supabase.com/dashboard/project/ixxeidpdgktzvcbucosq/auth/templates)). Hosted Auth reads the subject and HTML from that screen. The site build publishes the wordmark and leaves the HTML in the repo.

Each template’s `<img>` src is `https://hispromisedaily.com/email/hpd-wordmark.png`. `scripts/build_site.py` copies `email/hpd-wordmark.png` to `dist/email/hpd-wordmark.png` for the production target. Sitemap entries come from public pages, so this file stays out of `sitemap.xml`. `robots.txt` allows `/`, and `vercel.json` has no header or rewrite on `/email/hpd-wordmark.png`. A long cache on that file is fine.

Paste the body of each file and the subject below. Further notes (Go template variables and the one-hour link copy) are in `supabase/templates/subjects.txt`.

| Dashboard template | Subject | File |
| --- | --- | --- |
| Confirm signup | Confirm your email for His Promise Daily | `confirm-signup.html` |
| Reset password | Reset your His Promise Daily password | `reset-password.html` |
| Change email address | Confirm your new email for His Promise Daily | `change-email.html` |
| Magic link | Your His Promise Daily sign-in link | `magic-link.html` |
| Invite user | You’re invited to His Promise Daily | `invite-user.html` |
| Reauthentication | Your His Promise Daily confirmation code | `reauthentication.html` |

## Vercel

Keep the existing project. Do not add Cloudflare Pages.

Already present (do not rotate blindly): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FEEDBACK_HASH_SECRET`.

Add for Production (and Preview, if previews should sign in):

- `SUPABASE_ANON_KEY` — available to **builds**, not only to functions.

Redeploy after the migration is applied and the anon key is set. `api/feedback.js` and `api/account.js` are Vercel Functions. The service-role key stays in the function environment.

## Local development

```sh
npm ci
# export SUPABASE_ANON_KEY=...   # public key only
python3 scripts/build_site.py --target production
python3 -m http.server 8080 --directory dist
```

## Tests

```sh
npm ci
python3 -m unittest discover -s tests -p 'test_*.py'
node tests/analytics.test.js
node tests/safe-next.test.js
node tests/feedback-api.test.js
node tests/feedback-widget.test.js
node tests/account-api.test.js
node tests/auth-cloud.test.js
node tests/run-sql.js
node tests/behavior-regression.test.js
```

`node tests/run-sql.js` applies the migrations and `tests/sql/*.sql` to disposable PGlite. It needs the `pgcrypto` contrib bundled with `@electric-sql/pglite`. Do not point it at production.

## Account deletion

The account page asks the person to type `DELETE`. `POST /api/account` checks the same-origin request, verifies the bearer token with `GET /auth/v1/user`, and calls `DELETE /auth/v1/admin/users/<that id>` with the service-role key. The body cannot name a user id. Deleting the Auth user removes the profile and favorites. Existing feedback remains anonymous.

## Legacy browser data

On load, the client removes `gp_auth_users_v1`, `gp_auth_session_v1`, and keys starting with `gp_favorites_v1_`. It does not clear the feedback UX cache (`hpd.feedback.v1`) or the device Bible-version cache. Old local accounts cannot sign in. They are not imported.

## Manual steps still required

1. Apply `20261110153000_profiles_favorites_auth.sql` on `ixxeidpdgktzvcbucosq`.
2. Add `SUPABASE_ANON_KEY` to the Vercel project so the **build** can see it, then redeploy.
3. Set the Auth site URL, redirect URLs, email confirmation, and minimum password length as listed above.
4. After `/email/hpd-wordmark.png` is on https://hispromisedaily.com, paste the six templates and subjects from `supabase/templates/` into Authentication > Emails.
5. Send a real verification email and a password-reset email on the production URL. The automated tests use a fake client and do not call the live Auth service.

Until steps 1 and 2 are done, the catalog and anonymous feedback keep working, and sign-in cannot succeed in production.
