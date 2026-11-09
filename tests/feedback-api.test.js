/* Server-side checks for api/_lib/feedback-core.js: validation, allowlists, duplicate
 * prevention, cookies, origin/CSRF, fail-closed config and rate limits. No network. */
"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../api/_lib/feedback-core");
const { createFakeRpc } = require("./helpers/fake-feedback-rpc");

const ROOT = path.resolve(__dirname, "..");
const ENV = {
  SUPABASE_URL: "https://example-project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_only_not_a_real_key_0000",
  FEEDBACK_HASH_SECRET: "x".repeat(40),
};
const catalog = core.loadCatalog(ROOT);
const VERSION = fs.readFileSync(path.join(ROOT, "js/ui-shared.js"), "utf8").match(/const EXPLAIN_VERSION = "([^"]+)"/)[1];
const explanations = JSON.parse(fs.readFileSync(path.join(ROOT, "data/explanations.json"), "utf8"));
const VERSE = Object.keys(explanations)[0];
const HOST = "hispromisedaily.com";

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: "",
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b || ""; },
    json() { return JSON.parse(this.body); },
  };
}
function req(method, body, opts = {}) {
  const headers = Object.assign({
    host: HOST, origin: "https://" + HOST, "content-type": "application/json",
    "x-forwarded-for": opts.ip || "203.0.113.7", "sec-fetch-site": "same-origin",
  }, opts.headers || {});
  if (opts.cookie) headers.cookie = opts.cookie;
  for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];
  return { method, url: opts.url || "/api/feedback", headers, body };
}
async function call(handler, r) { const res = mockRes(); await handler(r, res); return res; }
function cookieOf(res) {
  const c = res.headers["set-cookie"];
  return c ? c.split(";")[0] : null;
}
const base = (extra) => Object.assign({ verseId: VERSE, explanationVersion: VERSION, language: "en", rating: "positive", categories: [], source: "card" }, extra || {});

(async () => {
  // Catalog mirrors the deployed explanations exactly (hash of the shown text).
  assert.equal(catalog.version, VERSION);
  assert.equal(catalog.verses.size, Object.keys(explanations).length);
  assert.equal(catalog.verses.get(VERSE).explanationSha256, crypto.createHash("sha256").update(explanations[VERSE], "utf8").digest("hex"));

  // —— Fail closed without configuration ——
  for (const env of [{}, { ...ENV, SUPABASE_URL: "" }, { ...ENV, SUPABASE_SERVICE_ROLE_KEY: "" },
    { ...ENV, FEEDBACK_HASH_SECRET: "short" }, { ...ENV, SUPABASE_URL: "http://insecure.example" }]) {
    let called = false;
    const h = core.createHandler({ env, catalog, rpc: async () => { called = true; }, log: () => {} });
    const res = await call(h, req("POST", base()));
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.json(), { error: "feedback_unavailable" });
    assert.equal(called, false);
  }

  const rpc = createFakeRpc();
  const h = core.createHandler({ env: ENV, catalog, rpc, log: () => {} });

  // —— Happy path: positive with categories, no comment; cookie issued ——
  let res = await call(h, req("POST", base({ categories: ["encouraging", "clear", "clear"] })));
  assert.equal(res.statusCode, 201, res.body);
  assert.deepEqual(res.json(), { ok: true, status: "created" });
  const setCookie = res.headers["set-cookie"];
  assert.match(setCookie, /^hpd_fb=[A-Za-z0-9_-]{43}; Path=\/api\/feedback; Max-Age=31536000; HttpOnly; SameSite=Strict; Secure$/);
  const cookie = cookieOf(res);
  const row = rpc.rows[0];
  assert.deepEqual(row.categories, ["clear", "encouraging"]);
  assert.equal(row.comment, null);
  assert.equal(row.explanation_version, VERSION);
  assert.equal(row.explanation_sha256, catalog.verses.get(VERSE).explanationSha256);
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, "promises.json"), "utf8")).promises.find((x) => x.id === VERSE);
  assert.equal(row.book, p.book); assert.equal(row.chapter, p.chapter); assert.equal(row.reference, p.reference);
  assert.equal(row.verse_start, p.verseStart); assert.equal(row.verse_end, p.verseEnd);
  assert.equal(row.language, "en"); assert.equal(row.local_user_id, null);
  // Raw cookie value is never stored; only a 64-hex HMAC.
  assert.match(row.submitter_key, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(rpc.rows).includes(cookie.split("=")[1]));
  assert.ok(!res.body.includes(ENV.SUPABASE_SERVICE_ROLE_KEY));

  // —— Duplicate: same cookie + verse + version -> 409, nothing stored, no new cookie ——
  res = await call(h, req("POST", base({ rating: "negative", categories: ["confusing"] }), { cookie }));
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.json(), { error: "already_submitted" });
  assert.equal(res.headers["set-cookie"], undefined);
  assert.equal(rpc.rows.length, 1);

  // —— Status endpoint: own cookie sees submitted, others don't, no cookie => false ——
  const statusUrl = `/api/feedback?verseId=${VERSE}&v=${VERSION}`;
  res = await call(h, req("GET", undefined, { url: statusUrl, cookie }));
  assert.deepEqual(res.json(), { submitted: true });
  res = await call(h, req("GET", undefined, { url: statusUrl }));
  assert.deepEqual(res.json(), { submitted: false });
  res = await call(h, req("GET", undefined, { url: statusUrl, cookie: "hpd_fb=" + "A".repeat(43) }));
  assert.deepEqual(res.json(), { submitted: false });
  res = await call(h, req("GET", undefined, { url: "/api/feedback?verseId=../../etc&v=" + VERSION }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.headers["cache-control"], "no-store");

  // —— New browser (no cookie) can rate the same verse: negative, multi-select, comment ——
  res = await call(h, req("POST", base({ rating: "negative", categories: ["missing_context", "too_general", "other"],
    comment: "  Needs more\u0000 context\u202E about the covenant.\r\n\r\n\r\n\r\nThanks  ",
    localUserId: "123e4567-e89b-42d3-a456-426614174000" }), { ip: "198.51.100.2" }));
  assert.equal(res.statusCode, 201, res.body);
  const r2 = rpc.rows[1];
  assert.deepEqual(r2.categories, ["missing_context", "other", "too_general"]);
  assert.equal(r2.comment, "Needs more context about the covenant.\n\nThanks");
  assert.equal(r2.local_user_id, "123e4567-e89b-42d3-a456-426614174000");
  assert.notEqual(r2.submitter_key, row.submitter_key);

  // —— Validation: every field is checked server-side ——
  const bad = [
    [{ verseId: "zzz-999-1" }, "verseId"],
    [{ verseId: "<script>" }, "verseId"],
    [{ verseId: 5 }, "verseId"],
    [{ rating: "meh" }, "rating"],
    [{ rating: "positive", categories: ["confusing"] }, "categories"],
    [{ rating: "negative", categories: ["clear"] }, "categories"],
    [{ categories: ["drop table"] }, "categories"],
    [{ categories: "clear" }, "categories"],
    [{ categories: [1] }, "categories"],
    [{ comment: "x".repeat(501) }, "comment"],
    [{ comment: 42 }, "comment"],
    [{ comment: "buy http://a.example http://b.example http://c.example" }, "comment"],
    [{ language: "de" }, "language"],
    [{ explanationVersion: "../x" }, "explanationVersion"],
    [{ localUserId: "admin" }, "localUserId"],
    [{ source: "admin" }, "source"],
    [{ isAdmin: true }, "isAdmin"],
    [{ submitter_key: "a".repeat(64) }, "submitter_key"],
  ];
  for (const [extra, field] of bad) {
    const before = rpc.rows.length;
    res = await call(h, req("POST", base(extra), { ip: "192.0.2." + Math.floor(Math.random() * 200) }));
    assert.equal(res.statusCode, 400, JSON.stringify(extra) + " -> " + res.body);
    assert.equal(res.json().field, field);
    assert.equal(rpc.rows.length, before);
  }
  // 500 characters exactly (including emoji counted as one character) is accepted; empty comment -> null.
  res = await call(h, req("POST", base({ verseId: Object.keys(explanations)[1], comment: "🙏" + "y".repeat(499) }), { ip: "192.0.2.250" }));
  assert.equal(res.statusCode, 201, res.body);
  res = await call(h, req("POST", base({ verseId: Object.keys(explanations)[2], comment: "   \n " }), { ip: "192.0.2.251" }));
  assert.equal(res.statusCode, 201);
  assert.equal(rpc.rows[rpc.rows.length - 1].comment, null);

  // Stale explanation version -> 409 explanation_updated (feedback must match the text shown).
  res = await call(h, req("POST", base({ explanationVersion: "promise-0" }), { ip: "192.0.2.252" }));
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.json(), { error: "explanation_updated" });

  // —— Transport / CSRF ——
  res = await call(h, req("POST", base(), { headers: { origin: "https://evil.example" } }));
  assert.equal(res.statusCode, 403);
  res = await call(h, req("POST", base(), { headers: { origin: undefined } }));
  assert.equal(res.statusCode, 403);
  res = await call(h, req("POST", base(), { headers: { "sec-fetch-site": "cross-site" } }));
  assert.equal(res.statusCode, 403);
  res = await call(h, req("POST", base(), { headers: { origin: "http://" + HOST } }));
  assert.equal(res.statusCode, 403);
  res = await call(h, req("POST", JSON.stringify(base()), { headers: { "content-type": "text/plain" } }));
  assert.equal(res.statusCode, 415);
  res = await call(h, req("POST", "{not json", { ip: "192.0.2.253" }));
  assert.equal(res.statusCode, 400);
  const throwing = req("POST", undefined, { ip: "192.0.2.240" });
  Object.defineProperty(throwing, "body", { get() { throw new Error("Invalid JSON"); } });
  res = await call(h, throwing);
  assert.equal(res.statusCode, 400);
  res = await call(h, req("POST", base(), { headers: { "content-length": "5000" } }));
  assert.equal(res.statusCode, 413);
  res = await call(h, req("POST", JSON.stringify(base({ comment: "z".repeat(4500) })), { ip: "192.0.2.254" }));
  assert.equal(res.statusCode, 413);
  res = await call(h, req("DELETE", undefined));
  assert.equal(res.statusCode, 405);
  res = await call(h, req("PUT", base()));
  assert.equal(res.statusCode, 405);
  // Preview deployments / localhost are same-origin too.
  assert.equal(core.originAllowed({ headers: { host: "gods-promises-git-x.vercel.app", origin: "https://gods-promises-git-x.vercel.app" } }), true);
  assert.equal(core.originAllowed({ headers: { host: "localhost:8790", origin: "http://localhost:8790" } }), true);

  // —— Honeypot: pretends success, stores nothing ——
  const before = rpc.rows.length;
  res = await call(h, req("POST", base({ verseId: Object.keys(explanations)[3], website: "http://spam.example" }), { ip: "192.0.2.9" }));
  assert.equal(res.statusCode, 201);
  assert.equal(rpc.rows.length, before);

  // —— Rate limits: per-instance IP limiter (10/min) and DB limiter (15/10 min per submitter) ——
  const h2 = core.createHandler({ env: ENV, catalog, rpc: createFakeRpc(), log: () => {} });
  const ids = Object.keys(explanations);
  let statuses = [];
  for (let i = 0; i < 12; i++) statuses.push((await call(h2, req("POST", base({ verseId: ids[i] }), { ip: "203.0.113.50" }))).statusCode);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(201));
  assert.deepEqual(statuses.slice(10), [429, 429]);
  const rpc3 = createFakeRpc();
  const h3 = core.createHandler({ env: ENV, catalog, rpc: rpc3, log: () => {} });
  let c3 = null; statuses = [];
  for (let i = 0; i < 17; i++) {
    const r = await call(h3, req("POST", base({ verseId: ids[i] }), { ip: "203.0.113." + (100 + i), cookie: c3 || undefined }));
    c3 = c3 || cookieOf(r);
    statuses.push(r.statusCode);
  }
  assert.deepEqual(statuses.slice(0, 15), Array(15).fill(201));
  assert.deepEqual(statuses.slice(15), [429, 429]);

  // —— Storage errors surface as 502 without leaking details ——
  const h4 = core.createHandler({ env: ENV, catalog, rpc: async () => { throw new Error("db down " + ENV.SUPABASE_SERVICE_ROLE_KEY); }, log: () => {} });
  res = await call(h4, req("POST", base()));
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.json(), { error: "storage_error" });

  // —— Real transport sends the key only to Supabase, with apikey header ——
  const sent = [];
  const h5 = core.createHandler({ env: ENV, catalog, log: () => {}, fetch: async (url, init) => {
    sent.push({ url, init });
    return { ok: true, json: async () => ({ status: "created", id: "x" }) };
  } });
  res = await call(h5, req("POST", base()));
  assert.equal(res.statusCode, 201);
  assert.equal(sent[0].url, ENV.SUPABASE_URL + "/rest/v1/rpc/hpd_feedback_submit");
  assert.equal(sent[0].init.headers.apikey, ENV.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(sent[0].init.headers.authorization, undefined);
  const args = JSON.parse(sent[0].init.body);
  assert.deepEqual(Object.keys(args).sort(), ["p_book", "p_categories", "p_chapter", "p_comment", "p_explanation_sha256", "p_explanation_version", "p_ip_key", "p_language", "p_local_user_id", "p_rating", "p_reference", "p_source", "p_submitter_key", "p_verse_end", "p_verse_id", "p_verse_start"]);
  assert.ok(!sent[0].init.body.includes("203.0.113.7"), "raw IP must not be sent to storage");

  // —— Client bundle never contains server secrets or Supabase endpoints ——
  for (const f of ["js/feedback.js", "js/ui-shared.js", "js/config.js"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/service_role|SERVICE_ROLE|sb_secret|supabase\.co/i.test(src), f);
  }
  // Category allowlists are identical in server, client and SQL.
  const sql = fs.readdirSync(path.join(ROOT, "supabase/migrations")).map((n) => fs.readFileSync(path.join(ROOT, "supabase/migrations", n), "utf8")).join("\n");
  for (const rating of ["positive", "negative"]) {
    const m = sql.match(new RegExp("when '" + rating + "' then array\\[([^\\]]+)\\]"));
    assert.ok(m, rating);
    assert.deepEqual(m[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1)), core.CATEGORIES[rating]);
  }

  console.log("feedback-api: all cases pass");
})().catch((e) => { console.error(e); process.exit(1); });
