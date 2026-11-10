# Morning email, share cards, and the home-screen app

These three pieces ship in code only. Nothing here is applied to the live Supabase project or to the production Vercel deployment until you do the steps below.

## Environment variables

Set these on the Vercel project **gods-promises** (team actof-god), for Production. They are server-only. Do not put them in `js/`, HTML, or git.

| Variable | Where it is read | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | `api/daily-email.js` only | Sends from `His Promise Daily <no-reply@hispromisedaily.com>`. If it is missing, the cron logs that and sends nothing. |
| `CRON_SECRET` | `api/daily-email.js` | Vercel sends `Authorization: Bearer <CRON_SECRET>`. Requests without it get 401. Use a long random value (at least 16 characters). |
| `UNSUBSCRIBE_SECRET` | `api/daily-email.js` and `api/unsubscribe.js` | HMAC key for the one-click unsubscribe link. At least 16 characters. If it is missing, no email is sent and unsubscribe links cannot be checked. |
| `SUPABASE_URL` | already set | `https://ixxeidpdgktzvcbucosq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | already set | Used by the cron and the unsubscribe route to read opted-in profiles and to turn the preference off. Never sent to the browser. |

`SUPABASE_ANON_KEY` is unchanged and remains a **build-time** public key. See `docs/supabase-auth.md`.

Generate the two new secrets locally, for example:

```sh
openssl rand -base64 32
```

Use a different value for `CRON_SECRET` and `UNSUBSCRIBE_SECRET`.

The sending domain `hispromisedaily.com` must be verified in Resend (SPF, DKIM, and ideally DMARC) before real mail will arrive. The code does not create that DNS.

## Migration to apply

On project `ixxeidpdgktzvcbucosq` only, after the profiles migration:

`supabase/migrations/20261110210000_daily_verse_email.sql`

It adds:

- `public.profiles.daily_verse_email` (boolean, default **false**) — the owner may update only their own row.
- `public.profiles.daily_verse_email_updated_at` — set by a trigger. The browser cannot write it.
- `public.daily_email_sends` — user id and Zurich date only, RLS on, no policies, no grants for `anon` or `authenticated`. The cron uses the service role.

Do not apply it from this repository automatically. `node tests/run-sql.js` checks it on disposable Postgres and does not connect to production.

Until the migration is applied, the account toggle will not save (the column is missing) and the cron will find no opted-in rows. The public catalog and anonymous explanation feedback keep working.

## Cron

`vercel.json` schedules `GET /api/daily-email` at `0 5 * * *` (05:00 UTC), once a day, which is what Vercel Hobby allows.

- In winter (CET, UTC+1) that is **06:00 Europe/Zurich**.
- In summer (CEST, UTC+2) that is **07:00 Europe/Zurich**.

The verse is the same passage the site shows for that Zurich calendar date (`js/daily-verse.js`: short WEB verses, step 7919). The message includes the explanation and a link to `/verses/<id>.html`.

Vercel invokes crons on **production** deployments only. Preview URLs will not send the morning email.

Each message has a signed unsubscribe URL and `List-Unsubscribe` / `List-Unsubscribe-Post` headers. Opening the link, or the mail client’s one-click POST, sets `daily_verse_email` to false. No sign-in.

### Free-tier caps

Resend’s free tier is 100 emails a day and 3,000 a month. One run sends at most 100, and never more than the month still has room for. Extra opted-in addresses are counted in the log and skipped. The send log stops a retry the same Zurich day from emailing someone twice. Idempotency keys are `batch-daily-verse/<zurich-date>/<hash of recipient ids>`.

## Share cards

`GET /api/og?id=<promise id>` returns a 1080×1080 PNG (Yellowtail title, italic verse, reference, cloud blue). Verse pages use that URL as `og:image`. Canonical URLs, the sitemap, and the Article JSON-LD fields stay as they were; JSON-LD also gains an `image` property.

The Share button uses the Web Share API with the PNG when the browser accepts files, and otherwise downloads the image and copies the verse link.

Cards are rendered when requested and cached (`s-maxage=604800`). They are not pre-built into `dist`, so the Hobby deployment does not carry one PNG per verse.

## Home screen

`manifest.webmanifest` names the app **His Promise Daily**, with cloud-blue theme `#e1e9f1` and the icons in `icons/`. `sw.js` caches the shell, `promises-data.js`, and `data/explanations.json`, and stores the verse the landing page last showed.

These always go to the network and are not cached by the service worker:

- `/api/*` (feedback, account deletion, the cron, unsubscribe, and share cards)
- any non-GET request
- Supabase (`*.supabase.co` is a different origin)
- `/_vercel/` analytics

## Before going live

1. Apply `20261110210000_daily_verse_email.sql` on `ixxeidpdgktzvcbucosq`.
2. Set `RESEND_API_KEY`, `CRON_SECRET`, and `UNSUBSCRIBE_SECRET` on the Vercel project.
3. Confirm `hispromisedaily.com` is a verified Resend domain and that `no-reply@hispromisedaily.com` is allowed to send.
4. Deploy this branch only after review. Do not treat a preview deploy as the sender; crons run in production.
5. Turn the account toggle on for one real mailbox and confirm the message, the verse link, and the unsubscribe link.
