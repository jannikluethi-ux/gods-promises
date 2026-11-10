/* Morning email: cron auth, opt-in only, caps, unsubscribe, no secrets in the browser. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHandler, FROM, DAILY_CAP, MONTHLY_CAP } = require("../api/_lib/daily-email-core");
const { createHandler: unsubscribeHandler } = require("../api/_lib/unsubscribe-core");
const { signUnsubscribeToken, verifyUnsubscribeToken } = require("../api/_lib/unsubscribe-token");
const { renderDailyEmail } = require("../api/_lib/daily-email-template");
const daily = require("../js/daily-verse");

const ROOT = path.resolve(__dirname, "..");
const SECRET = "cron-secret-test-value";
const UNSUB = "unsubscribe-secret-test";
const SERVICE = "service-role-test-key-value";

function verses() {
  return [
    { id: "gen-1-28", reference: "Genesis 1:28", text: "Be fruitful and multiply.", explanation: "God blesses them." },
    { id: "psa-23-1", reference: "Psalm 23:1", text: "The LORD is my shepherd.", explanation: "David trusts God." },
  ];
}

function responseStub() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(payload) { this.body = payload; },
  };
}

function parse(res) {
  return JSON.parse(res.body);
}

async function invoke(handler, headers, method) {
  const res = responseStub();
  await handler({ method: method || "GET", headers: headers || {}, url: "/api/daily-email" }, res);
  return res;
}

function world(opted, sentToday, monthCount) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const target = String(url);
    if (target.includes("/profiles?")) {
      return { ok: true, json: async () => opted, headers: { get: () => null } };
    }
    if (target.includes("zurich_date=eq.")) {
      return { ok: true, json: async () => sentToday.map((id) => ({ user_id: id })), headers: { get: () => null } };
    }
    if (target.includes("zurich_date=gte.")) {
      return { ok: true, status: 200, headers: { get: (name) => name === "content-range" ? "0-0/" + monthCount : null } };
    }
    if (target.includes("/daily_email_sends") && options.method === "POST") {
      return { ok: true, status: 201, headers: { get: () => null } };
    }
    if (target.includes("/profiles?id=eq.") && options.method === "PATCH") {
      return { ok: true, status: 204, headers: { get: () => null } };
    }
    throw new Error("unexpected " + target);
  };
  return { fetch, calls };
}

function handlerFor(fetch, resend, extra) {
  return createHandler(Object.assign({
    env: {
      CRON_SECRET: SECRET,
      RESEND_API_KEY: "re_test_key",
      UNSUBSCRIBE_SECRET: UNSUB,
      SUPABASE_URL: "https://ixxeidpdgktzvcbucosq.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    },
    fetch,
    resend,
    verses: verses(),
    now: new Date("2026-11-10T05:00:00Z"),
    log() {},
    info() {},
  }, extra || {}));
}

(async () => {
  const denied = await invoke(handlerFor(async () => { throw new Error("no network"); }, null), {});
  assert.equal(denied.statusCode, 401);

  const missing = await invoke(createHandler({
    env: { CRON_SECRET: SECRET },
    verses: verses(),
    log() {},
    info() {},
  }), { authorization: "Bearer " + SECRET });
  assert.equal(missing.statusCode, 200);
  assert.equal(parse(missing).skipped, "not_configured");
  assert.ok(parse(missing).missing.includes("RESEND_API_KEY"));
  assert.ok(parse(missing).missing.includes("UNSUBSCRIBE_SECRET"));

  const expected = daily.promiseFor(verses(), "2026-11-10");
  const people = [
    { id: "11111111-1111-4111-8111-111111111111", email: "one@example.invalid", display_name: "Ada" },
    { id: "22222222-2222-4222-8222-222222222222", email: "not-an-email", display_name: "" },
    { id: "33333333-3333-4333-8333-333333333333", email: "two@example.invalid", display_name: "" },
  ];
  let sentPayload = null;
  let sentOptions = null;
  const resend = { batch: { send: async (payload, options) => { sentPayload = payload; sentOptions = options; return { data: [{ id: "email_1" }] }; } } };
  const live = world(people, [], 0);
  const ok = await invoke(handlerFor(live.fetch, resend), { authorization: "Bearer " + SECRET });
  assert.equal(ok.statusCode, 200);
  const body = parse(ok);
  assert.equal(body.ok, true);
  assert.equal(body.verseId, expected.id);
  assert.equal(body.sent, 2);
  assert.equal(body.invalid, 1);
  assert.equal(sentPayload.length, 2);
  assert.equal(sentPayload[0].from, FROM);
  assert.deepEqual(sentPayload[0].to, ["one@example.invalid"]);
  assert.match(sentPayload[0].subject, new RegExp(expected.reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sentPayload[0].html, /Good morning, Ada\./);
  assert.match(sentPayload[1].html, /Good morning\./);
  assert.doesNotMatch(sentPayload[1].html, /Good morning, two/);
  assert.match(sentPayload[0].html, /His Promise Daily/);
  assert.match(sentPayload[0].html, /#3d5470/);
  assert.match(sentPayload[0].html, /font-style:italic/);
  assert.match(sentPayload[0].html, /hpd-wordmark\.png/);
  assert.match(sentPayload[0].text, /Unsubscribe from the morning promise/);
  assert.match(sentPayload[0].html, new RegExp("/verses/" + expected.id + "\\.html"));
  const unsubHeader = sentPayload[0].headers["List-Unsubscribe"];
  assert.match(unsubHeader, /^<https:\/\/hispromisedaily\.com\/api\/unsubscribe\?token=/);
  assert.equal(sentPayload[0].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(sentOptions.idempotencyKey, /^batch-daily-verse\/2026-11-10\//);
  assert.ok(live.calls.some((call) => call.options.method === "POST" && call.url.includes("daily_email_sends")));
  assert.equal(JSON.stringify(sentPayload).includes(SERVICE), false);
  assert.equal(JSON.stringify(sentPayload).includes(UNSUB), false);

  const over = [];
  for (let i = 0; i < DAILY_CAP + 5; i += 1) {
    const n = String(i).padStart(12, "0");
    over.push({ id: "44444444-4444-4444-8444-" + n.slice(0, 12), email: "p" + i + "@example.invalid", display_name: "" });
  }
  let count = 0;
  const capped = world(over, [], 0);
  const resendCount = { batch: { send: async (payload) => { count = payload.length; return { data: [] }; } } };
  const cappedRes = await invoke(handlerFor(capped.fetch, resendCount), { authorization: "Bearer " + SECRET });
  assert.equal(count, DAILY_CAP);
  assert.equal(parse(cappedRes).skipped, 5);

  const month = world(people, [], MONTHLY_CAP);
  let monthSent = -1;
  const monthResend = { batch: { send: async () => { monthSent = 1; return { data: [] }; } } };
  const monthRes = await invoke(handlerFor(month.fetch, monthResend), { authorization: "Bearer " + SECRET });
  assert.equal(parse(monthRes).sent, 0);
  assert.equal(monthSent, -1);

  const already = world(people, [people[0].id], 1);
  let secondTo = null;
  const alreadyResend = { batch: { send: async (payload) => { secondTo = payload.map((item) => item.to[0]); return { data: [] }; } } };
  await invoke(handlerFor(already.fetch, alreadyResend), { authorization: "Bearer " + SECRET });
  assert.deepEqual(secondTo, ["two@example.invalid"]);

  const token = signUnsubscribeToken(people[0].id, UNSUB);
  assert.equal(verifyUnsubscribeToken(token, UNSUB), people[0].id);
  assert.equal(verifyUnsubscribeToken(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), UNSUB), null);
  assert.equal(verifyUnsubscribeToken("not-a-token", UNSUB), null);

  const preview = renderDailyEmail({
    displayName: "Ada",
    reference: expected.reference,
    text: expected.text,
    explanation: expected.explanation,
    verseUrl: "https://hispromisedaily.com/verses/" + expected.id + ".html",
    unsubscribeUrl: "https://hispromisedaily.com/api/unsubscribe?token=" + token,
  });
  assert.match(preview.html, /<h1[^>]*>\s*Good morning, Ada\.\s*<\/h1>/);
  assert.match(preview.html, /lang="en"/);
  fs.mkdirSync("/tmp/hpd-preview", { recursive: true });
  fs.writeFileSync("/tmp/hpd-preview/email.html", preview.html);

  let patched = null;
  const unsubFetch = async (url, options) => {
    patched = { url, body: options.body };
    return { ok: true, status: 204 };
  };
  const unsubRoute = unsubscribeHandler({
    env: {
      UNSUBSCRIBE_SECRET: UNSUB,
      SUPABASE_URL: "https://ixxeidpdgktzvcbucosq.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    },
    fetch: unsubFetch,
    log() {},
  });
  const page = responseStub();
  await unsubRoute({ method: "GET", headers: {}, url: "/api/unsubscribe?token=" + encodeURIComponent(token), query: { token } }, page);
  assert.equal(page.statusCode, 200);
  assert.match(page.body, /unsubscribed/i);
  assert.match(patched.body, /"daily_verse_email":false/);
  assert.ok(patched.url.includes(people[0].id));
  const post = responseStub();
  await unsubRoute({ method: "POST", headers: {}, url: "/api/unsubscribe?token=" + token, query: { token } }, post);
  assert.equal(post.statusCode, 200);
  assert.equal(post.body, "unsubscribed");
  const bad = responseStub();
  await unsubRoute({ method: "GET", headers: {}, url: "/api/unsubscribe?token=nope", query: { token: "nope" } }, bad);
  assert.equal(bad.statusCode, 400);

  for (const relative of ["js/auth.js", "js/me-page.js", "js/share.js", "js/pwa.js", "js/daily-verse.js", "sw.js", "app.js"]) {
    const source = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.equal(source.includes("RESEND_API_KEY"), false, relative);
    assert.equal(source.includes("CRON_SECRET"), false, relative);
    assert.equal(source.includes("UNSUBSCRIBE_SECRET"), false, relative);
    assert.equal(source.includes("SUPABASE_SERVICE_ROLE"), false, relative);
  }

  console.log("daily-email: cron auth, caps, branded message, and one-click unsubscribe pass");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
