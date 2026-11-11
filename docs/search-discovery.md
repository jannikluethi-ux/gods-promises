# Scripture discovery

Search stays in the browser. `js/discovery.js` understands a query and ranks a curated set of connections. `app.js` uses that result for ordinary language. A scripture reference or a bare book name still uses the older literal match.

## What was wrong

The previous engine expanded a feeling or a money word into very common catalog words (`hope`, `peace`, `strength`) and then kept every verse that contained one of them. “I wish I was rich” matched nothing and fell through to the comfort list headed “For a hard moment,” opening on Philippians 4:6–7. “I need financial blessings” matched more than a thousand verses because “financial” was tied to that same broad expansion. Nothing recorded whether a passage was a promise, a principle, a warning, or a verse that only shares a word. 2 Corinthians 8:9 (“that you might become rich”) would have been indistinguishable from a promise of money.

There is no vector index, no full-text index, and no AI call. Supabase (`ixxeidpdgktzvcbucosq`) stores accounts, favorites, email, and explanation feedback. It does not store the catalog or search rankings. The public-domain WEB text already lives in `scripts/web_index.json` and in `promises-data.js`, so it can be read locally.

Postgres full-text search would still treat “I wish I was rich” as the tokens it happens to contain. pgvector would need an embedding of every passage plus an API key, and short verses cluster on words like God, Lord, and peace. That cannot reliably tell 2 Corinthians 8:9 (Christ’s grace) from Deuteronomy 8:18 (God gives the power to get wealth), or keep Deuteronomy 28:12 inside its covenant setting. The catalog is 1,188 passages. A curated connection list is the accurate index. No second search system was added, and no embedding job is required.

## How a query is answered

1. **Understanding.** Signals score a subject (wealth, patience, fear, marriage, and so on). An emotion word does not override a concrete subject: “anxious about money” stays money. Intention is separate: a wish to be rich, worry about losing money, a question about handling money, and “is it wrong?” are not the same search. If two concrete subjects are close, the heading is the neutral “Passages that may speak to this.”
2. **Everyday phrases.** This check runs before the signal scoring above. `readMeaning` in `js/discovery.js` matches a short list of conversational phrases. The first match locks one subject and one intention. A second intention is added only when the phrase itself asks for two needs (a heavy life load also includes a hard season; “I cannot cope” and “exhausted and need strength” include both rest and strength). “Overwhelmed by fear” is anxiety, not rest. “Overwhelmed by work,” “emotionally drained,” “too much on my shoulders,” and “stressed” are rest. “I feel like giving up” is strength to continue. “I feel lost” is guidance, and it does not claim “I lost someone” or “I lost my money.” A phrase never copies one synonym into every category, and it does not change a passage’s label or why-line.
3. **Expansion.** The subject’s intentions name which angles are direct and which are only related. Expansion does not add generic words to a haystack.
4. **Retrieval.** Only passages linked to that subject are candidates. Each link points at a catalog span when one exists, or at a supplement whose text is verbatim WEB from `scripts/web_index.json`. Missing from the 1,188 and added only as supplements: Deuteronomy 8:17–18, 2 Chronicles 1:11–12, Proverbs 22:7, 2 Corinthians 8:9, Proverbs 23:4–5, Luke 12:15, Matthew 6:19–21, Ecclesiastes 5:10, Proverbs 13:11, Colossians 3:23–24, Proverbs 14:23, Proverbs 21:5, 1 Timothy 6:9–10, plus a few marriage, parenting, forgiveness, and doubt texts. `data/explanations.json` and `EXPLAIN_VERSION` (`promise-4`) are unchanged. Supplements have no explanation and no favorite button.
5. **Reranking.** Score is the passage’s directness times whether this intention treats that angle as direct, related, or off to the side. A shared word such as God or peace adds nothing. A distinctive alias (“power to get wealth”) can lift the passage that actually says it. A second intention, when a phrase asked for one, is scored the same way and then reduced slightly so the first reading still leads.
6. **Why.** Each link carries one sentence about what the passage is doing. 2 Corinthians 8:9 says the “rich” is Christ’s grace, not a paycheck. Deuteronomy 28:11–12 says the bounty is a covenant blessing for Israel in the land.

Direct results score at least 72. Related perspectives score at least 46 and below 72. Anything lower is dropped. There is no fixed count and no padding. A thin set says the search found limited matches. When a query matches no subject, the page says the search was not understood and offers topic chips. A short list of familiar comfort passages may still appear underneath, labelled “Not a match for that search.” A understood topic, including distress that the engine recognizes, never uses that screen.

Each card is labelled Promise, Principle, Instruction, Encouragement, or Related passage.

“Did these results address your search?” posts to the existing `/api/feedback` as `kind: "search"`. The row stores the original query, intent, the heading, result ids and references in display order, yes/no, optional reason, optional comment (500 characters), an HMAC submitter key, an HMAC of the IP, the auth user id when a bearer token is present, and `created_at`. RLS is on with no policies. `anon` and `authenticated` cannot read, write, or execute `public.hpd_feedback_search_submit`. Limits match the explanation feedback design: 15 per submitter per 10 minutes, 30 per IP per 10 minutes, 300 per IP per day. The migration is in the repo and has not been applied to production.

## Keys, plan, and cost

No new environment variable. No AI provider key. No Vercel AI Gateway call. No pgvector extension. Estimated added monthly cost for a small site: **$0**.

Already required for feedback, and still required if you want the new yes/no signal to be stored:

| Name | Where |
| --- | --- |
| `SUPABASE_URL` | `https://ixxeidpdgktzvcbucosq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | server only |
| `FEEDBACK_HASH_SECRET` | server only, at least 32 characters |

If those three are missing, `/api/feedback` keeps failing closed with 503 and the button says it could not be sent. Search itself does not call the API.

## Go-live

1. Merge the pull request. The static site and the new scripts ship with the existing Vercel production deploy. No embedding job.
2. On project `ixxeidpdgktzvcbucosq` only, apply `supabase/migrations/20261110223000_search_feedback.sql` after the earlier migrations. Do not apply it to any other project.
3. Leave the existing feedback env vars in place. Do not add an AI key for this release.
4. Hard-refresh once if a phone is still on the previous service-worker shell. The cache name is `hpd-shell-v4`.

`node tests/discovery.test.js` prints precision at 5 and at 10. Those figures are precision against the project’s curated evaluation set (`tests/discovery.test.js` judgments, compared with `tests/discovery-baseline.json`, the keyword engine at `982c29d`). The labels were written for this project, so the set is a regression check and is not independent of the implementation. It is not a measure of general search accuracy or of real-world satisfaction. Real searches can differ. Judging real user searches separately is future work. `node tests/discovery-meanings.test.js` checks conversational phrases. `node tests/run-sql.js` applies migrations on a throwaway in-memory database only.
