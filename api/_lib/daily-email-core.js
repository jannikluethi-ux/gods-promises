/**
 * Morning promise send. Vercel Cron calls GET /api/daily-email with
 * Authorization: Bearer CRON_SECRET. Resend, the unsubscribe secret, and the
 * Supabase service role stay in the server environment.
 *
 * Free-tier caps: 100 emails a day and 3,000 a month. Beyond that the run
 * logs a count and skips. It does not throw if Resend is not configured.
 */
"use strict";

const crypto = require("crypto");
const daily = require("../../js/daily-verse");
const { loadVerses } = require("./verse-catalog");
const { signUnsubscribeToken } = require("./unsubscribe-token");
const { renderDailyEmail, ORIGIN } = require("./daily-email-template");

const FROM = "His Promise Daily <no-reply@hispromisedaily.com>";
const DAILY_CAP = 100;
const MONTHLY_CAP = 3000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function header(req, name) {
  if (!req || !req.headers) return "";
  const value = req.headers[name] != null ? req.headers[name] : req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
}

function authorized(req, secret) {
  const key = String(secret || "");
  if (key.length < 16) return false;
  const value = String(header(req, "authorization") || "");
  const expected = "Bearer " + key;
  if (value.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

function readService(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!/^https:\/\/[^/\s]+$/.test(url) || key.length < 20) return null;
  return { url: url, key: key };
}

function monthBounds(dateKey) {
  const parts = dateKey.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const start = y + "-" + String(m).padStart(2, "0") + "-01";
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  const next = nextYear + "-" + String(nextMonth).padStart(2, "0") + "-01";
  return { start: start, next: next };
}

function contentRangeTotal(res) {
  const headers = res && res.headers;
  const raw = headers && (headers.get ? headers.get("content-range") : headers["content-range"]);
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = /\/(\d+|\*)$/.exec(String(value || ""));
  if (!match || match[1] === "*") return 0;
  return Number(match[1]);
}

async function rest(fetchImpl, cfg, method, query, body, extra) {
  const headers = {
    apikey: cfg.key,
    authorization: "Bearer " + cfg.key,
    accept: "application/json",
  };
  if (extra) Object.assign(headers, extra);
  if (body) headers["content-type"] = "application/json";
  return fetchImpl(cfg.url + "/rest/v1/" + query, {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function listAll(fetchImpl, cfg, query) {
  const rows = [];
  let offset = 0;
  const page = 1000;
  for (;;) {
    const res = await rest(fetchImpl, cfg, "GET", query, null, {
      range: offset + "-" + (offset + page - 1),
    });
    if (!res.ok) {
      const err = new Error("supabase_read_failed");
      err.status = res.status;
      throw err;
    }
    const batch = await res.json();
    if (!Array.isArray(batch)) break;
    rows.push.apply(rows, batch);
    if (batch.length < page) break;
    offset += page;
    if (offset > 20000) break;
  }
  return rows;
}

function validEmail(value) {
  const email = String(value || "").trim();
  return email.length <= 320 && EMAIL_RE.test(email) ? email : "";
}

function createHandler(deps) {
  const d = deps || {};
  const env = d.env || process.env;
  const fetchImpl = d.fetch || globalThis.fetch;
  const log = d.log || function (msg) { console.error(msg); };
  const info = d.info || function (msg) { console.log(msg); };

  function send(res, status, payload) {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    res.end(JSON.stringify(payload));
  }

  return async function handler(req, res) {
    if ((req.method || "GET") !== "GET" && req.method !== "POST") {
      return send(res, 405, { ok: false, error: "method_not_allowed" });
    }
    if (!authorized(req, env.CRON_SECRET)) {
      log("daily-email: rejected (CRON_SECRET missing or does not match)");
      return send(res, 401, { ok: false, error: "unauthorized" });
    }

    const missing = [];
    if (!String(env.RESEND_API_KEY || "").trim()) missing.push("RESEND_API_KEY");
    if (String(env.UNSUBSCRIBE_SECRET || "").length < 16) missing.push("UNSUBSCRIBE_SECRET");
    const service = readService(env);
    if (!service) missing.push("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
    if (missing.length) {
      log("daily-email: not configured (" + missing.join(", ") + ")");
      return send(res, 200, { ok: false, skipped: "not_configured", missing: missing });
    }

    const now = d.now ? new Date(d.now) : new Date();
    const dateKey = daily.zurichDateKey(now);
    let verses;
    try {
      verses = d.verses || loadVerses(d.root);
    } catch (err) {
      log("daily-email: catalog unreadable");
      return send(res, 500, { ok: false, error: "catalog_unreadable" });
    }
    const verse = daily.promiseFor(verses, dateKey);
    if (!verse || !verse.id || !verse.text) {
      log("daily-email: no verse for " + dateKey);
      return send(res, 200, { ok: false, skipped: "no_verse", date: dateKey });
    }

    let opted;
    let sentTodayIds;
    let monthCount;
    try {
      opted = await listAll(
        fetchImpl,
        service,
        "profiles?select=id,email,display_name&daily_verse_email=eq.true&account_status=eq.active&order=id.asc"
      );
      const todayRows = await listAll(
        fetchImpl,
        service,
        "daily_email_sends?select=user_id&zurich_date=eq." + dateKey
      );
      sentTodayIds = new Set(todayRows.map(function (row) { return row.user_id; }));
      const bounds = monthBounds(dateKey);
      const countRes = await rest(
        fetchImpl,
        service,
        "GET",
        "daily_email_sends?select=user_id&zurich_date=gte." + bounds.start + "&zurich_date=lt." + bounds.next,
        null,
        { prefer: "count=exact", range: "0-0" }
      );
      if (!countRes.ok) throw new Error("count");
      monthCount = contentRangeTotal(countRes);
    } catch (err) {
      log("daily-email: could not read subscribers");
      return send(res, 500, { ok: false, error: "storage_error" });
    }

    const already = sentTodayIds.size;
    const remainingToday = Math.max(0, DAILY_CAP - already);
    const remainingMonth = Math.max(0, MONTHLY_CAP - monthCount);
    const budget = Math.min(remainingToday, remainingMonth, DAILY_CAP);
    let invalid = 0;
    const pending = [];
    for (const row of opted) {
      if (!row || sentTodayIds.has(row.id)) continue;
      const email = validEmail(row.email);
      if (!email) {
        invalid += 1;
        continue;
      }
      pending.push({ id: row.id, email: email, displayName: row.display_name || "" });
    }
    pending.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    const chosen = pending.slice(0, budget);
    const skipped = pending.length - chosen.length;
    if (skipped > 0 || invalid > 0) {
      log("daily-email: skipped " + skipped + " over the free-tier cap and " + invalid + " invalid addresses");
    }
    if (!chosen.length) {
      info("daily-email: date=" + dateKey + " verse=" + verse.id + " sent=0 skipped=" + skipped);
      return send(res, 200, {
        ok: true,
        date: dateKey,
        verseId: verse.id,
        sent: 0,
        skipped: skipped,
        invalid: invalid,
        monthSent: monthCount,
      });
    }

    const messages = chosen.map(function (person) {
      const token = signUnsubscribeToken(person.id, env.UNSUBSCRIBE_SECRET);
      const unsubscribeUrl = ORIGIN + "/api/unsubscribe?token=" + encodeURIComponent(token);
      const verseUrl = ORIGIN + "/verses/" + verse.id + ".html";
      const rendered = renderDailyEmail({
        displayName: person.displayName,
        reference: verse.reference,
        text: verse.text,
        explanation: verse.explanation,
        verseUrl: verseUrl,
        unsubscribeUrl: unsubscribeUrl,
      });
      return {
        from: FROM,
        to: [person.email],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          "List-Unsubscribe": "<" + unsubscribeUrl + ">",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    const idHash = crypto.createHash("sha256").update(chosen.map(function (p) { return p.id; }).join(",")).digest("hex").slice(0, 32);
    const idempotencyKey = "batch-daily-verse/" + dateKey + "/" + idHash;

    let resend = d.resend;
    if (!resend) {
      try {
        const { Resend } = require("resend");
        resend = new Resend(String(env.RESEND_API_KEY).trim());
      } catch (err) {
        log("daily-email: Resend client unavailable");
        return send(res, 200, { ok: false, skipped: "resend_unavailable" });
      }
    }

    let result;
    try {
      result = await resend.batch.send(messages, { idempotencyKey: idempotencyKey });
    } catch (err) {
      log("daily-email: send threw");
      return send(res, 500, { ok: false, error: "send_failed" });
    }
    if (!result || result.error) {
      log("daily-email: send rejected" + (result && result.error && result.error.message ? " (" + result.error.message + ")" : ""));
      return send(res, 500, { ok: false, error: "send_failed" });
    }

    try {
      const recorded = await rest(
        fetchImpl,
        service,
        "POST",
        "daily_email_sends?on_conflict=user_id,zurich_date",
        chosen.map(function (person) { return { user_id: person.id, zurich_date: dateKey }; }),
        { prefer: "resolution=ignore-duplicates,return=minimal" }
      );
      if (!recorded.ok) log("daily-email: sent, but the send log was not written");
    } catch (err) {
      log("daily-email: sent, but the send log was not written");
    }

    info("daily-email: date=" + dateKey + " verse=" + verse.id + " sent=" + chosen.length + " skipped=" + skipped);
    return send(res, 200, {
      ok: true,
      date: dateKey,
      verseId: verse.id,
      sent: chosen.length,
      skipped: skipped,
      invalid: invalid,
      monthSent: monthCount + chosen.length,
    });
  };
}

module.exports = {
  createHandler,
  authorized,
  DAILY_CAP,
  MONTHLY_CAP,
  FROM,
  EMAIL_RE,
};
