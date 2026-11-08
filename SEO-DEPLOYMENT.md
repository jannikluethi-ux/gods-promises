# SEO build and old-demo migration

## Two deliberately separate artifacts

- Production: `python3 scripts/build_site.py --target production` → `dist/`.
  `vercel.json` builds and serves **only** this directory. No SPA catch-all rewrite is added;
  unknown verse URLs remain 404s. The existing homepage and account/search/support scripts are retained.
- Old GitHub Pages demo: `python3 scripts/build_site.py --target migration` → `pages-dist/`.
  `.github/workflows/pages-migration.yml` uploads **only** this directory. It has no app scripts,
  styles, catalog JSON, explanations, or copied production content. Every known page has an immediate
  HTML meta refresh, production canonical, and visible fallback link. This is **not** an HTTP 301/308.
  Unknown old paths get a real Pages 404 with links to production, not an invented matching destination.
- Both directories are disposable and gitignored. The repository and source data remain intact.

## Source of truth and what gets built

Every build reads the current `promises.json` catalog (IDs, references, spans, books, topics),
`scripts/web_index.json` Scripture source, and `data/explanations.json` reviewed explanations.
It fails for duplicate/unsafe IDs, missing Scripture, missing explanations, mismatched explanation IDs,
or colliding public URLs. It never rewrites source explanations or trims their text.
The production catalog/JS is rebuilt with those same current WEB spans so the interactive homepage
and static verse pages agree. Counts and directory text are derived from actual input, not hardcoded.

Current input generates 1,188 verse pages, 62 book groups, 75 topic groups, and 1,460 canonical public
URLs. Verse URLs are `/verses/{existing-stable-id}.html`. `/browse/` links to every book/topic;
listings contain at most 30 verse links per page and ordinary pagination links. All public pages are
reachable from the homepage's quiet browse link with JavaScript disabled.

Production HTML has unique titles, descriptions and H1s, absolute production canonicals,
Open Graph and Twitter summary metadata. Only the homepage has WebSite JSON-LD, with the real site
name and URL and no invented image, logo, SearchAction or organization. Login/profile pages have
`noindex, follow`; they remain crawlable and are excluded from the sitemap. Robots allows crawling
and points to the production sitemap. Sitemap URLs are public, canonical, query-free and unique;
there are no guessed last-modified dates.

The generated reading pages reuse the existing cloud-blue CSS tokens, Yellowtail headings and
Newsreader Scripture text; `browse.css` is scoped to them. No generated reading page loads analytics,
auth, search, or external Scripture APIs. The existing analytics allowlist and query/hash stripping
are unchanged; regression tests explicitly reject verse and browse paths.

## Release gate: existing Pages setting must change

Read-only GitHub API inspection found **legacy Pages built from `main` at `/`**, not a repository
Actions workflow. Adding our workflow alone does NOT retire that duplicate raw-root site.
Before the first migration workflow deploy, the release coordinator must switch this repository's
Pages build source to **GitHub Actions** (`build_type: workflow`), then verify it. Do not change the
Pages custom domain to the production domain. No Pages setting was changed during preparation.

Authorized coordinator sequence (only after local review and integration):

1. Integrate this commit with the latest explanation-review commit(s), preserving that branch's
   `data/explanations.json`, explanation cache-version changes, and asset-version changes in HTML.
   This change does not touch explanation data or `js/ui-shared.js`. The only homepage edits are its
   semantic H1 and a footer browse link; do not replace newer source files wholesale.
2. Run the full commands below on the combined tree. Commit the combined tree normally; do not
   force-push or deploy the older isolated checkout as an alternative.
3. Push/merge the coordinated release to `main` under the governing approval rules. Vercel Git
   integration should build the real site from `vercel.json`; verify the resulting build is READY
   and that its commit is the intended combined release before retiring the demo.
4. Once production is verified, switch Pages to Actions (GitHub Settings → Pages → Build and
   deployment → Source → GitHub Actions, or the documented Pages settings API `build_type: workflow`).
   If the initial migration workflow already failed under legacy mode, re-run it or manually dispatch
   `pages-migration.yml` at the same approved `main` commit. Confirm the deployed artifact is
   `pages-dist`, never repository root or `dist`. The setting switch may temporarily remove the
   legacy demo until that Actions deployment completes.
5. Verify old root, `/index.html`, each existing public `.html` path, `/login.html` and `/me.html`,
   plus a generated verse path. Their HTML must contain an immediate refresh and canonical to
   `https://hispromisedaily.com` with the matching path. Root and `/index.html` target production `/`.
   No target is `github.io` or `vercel.app`, and production itself contains no migration refresh.

This preparation did not push, create a PR, change hosting settings, deploy, or submit Search Console.
Google crawling/indexing/ranking and canonical selection are separate, unconfirmed outcomes.

## Repeatable local verification

From the release checkout:

```sh
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/analytics.test.js
node tests/safe-next.test.js
python3 scripts/build_site.py --target production
python3 scripts/build_site.py --target migration
git diff --check
```

The Python suite checks every output page, exact Scripture/explanation text, unique metadata and H1s,
public URL graph reachability without JavaScript, every local HTML link and asset, 30-entry pagination,
sitemap/robots/noindex, JSON-LD, HTML/attribute/JSON/XML escaping, deterministic builds, source changes
on the very next build, removal of orphaned output, host-artifact separation and no redirect loops.
Node tests verify analytics sanitization and the existing safe-next handling. A local static HTTP
server can serve `dist/` for visual review without changing any hosting service.

## After publishing: verify actual responses

Check at least the following production URLs, without assuming successful local output means a live deploy:

- `/`, `/terms.html`, `/privacy.html`, `/contact.html`, `/support.html`
- `/browse/`, `/browse/books/psalms.html`, `/browse/books/psalms-2.html`, `/browse/topics/hope.html`
- `/verses/gen-1-28.html`, `/verses/psa-24-3-5.html` (if present in the current catalog), and one final-book verse
- `/robots.txt`, `/sitemap.xml`, `/login.html`, `/me.html`, and a nonexistent verse (must be 404)

Compare returned canonical/metadata, public URL count and a reviewed explanation against the approved
combined input. Confirm script/CSS content types and asset loads, not just status 200. Inspect the live
old-demo HTML separately. Search Console ownership, sitemap submission and any URL inspection/indexing
requests require their own confirmed account access and must not be reported as done based on this code.
