/**
 * Explanation feedback — server-side core (no dependencies; Node 18+ for fetch/crypto).
 *
 * Exposes createHandler(deps) so tests can inject env, catalog and the Supabase RPC transport.
 * The browser never talks to Supabase: only this server function does, with the service-role
 * key from environment variables. Nothing here ever changes a published explanation.
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const COOKIE_NAME = "hpd_fb";
const COOKIE_PATH = "/api/feedback";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const MAX_BODY_BYTES = 4096;
const MAX_COMMENT = 500;
const LANGUAGES = ["en"];
const SOURCES = ["card", "verse_page"];
const CATEGORIES = Object.freeze({
  positive: ["clear", "accurate", "understanding", "practical", "encouraging"],
  negative: ["confusing", "too_general", "missing_context", "inaccurate",
    "no_application", "too_long", "unclear_meaning", "other"],
});
const BODY_KEYS = ["verseId", "explanationVersion", "language", "rating", "categories",
  "comment", "localUserId", "source", "website"];
const VERSE_ID_RE = /^[a-z0-9]+(?:-[0-9]+){2,3}$/;
const VERSION_RE = /^[a-z0-9][a-z0-9._-]{0,39}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const PRODUCTION_HOSTS = ["hispromisedaily.com", "www.hispromisedaily.com"];

/* —— Catalog: what the deployed site actually shows (bundled with the function) —— */

function loadCatalog(root) {
  const base = root || path.join(__dirname, "..", "..");
  const promises = JSON.parse(fs.readFileSync(path.join(base, "promises.json"), "utf8")).promises;
  const explanations = JSON.parse(fs.readFileSync(path.join(base, "data", "explanations.json"), "utf8"));
  const shared = fs.readFileSync(path.join(base, "js", "ui-shared.js"), "utf8");
  const m = shared.match(/const EXPLAIN_VERSION = "([^"]+)"/);
  if (!m || !VERSION_RE.test(m[1])) throw new Error("EXPLAIN_VERSION not found");
  const verses = new Map();
  for (const p of promises) {
    const text = explanations[p.id];
    if (typeof text !== "string" || !text.trim()) continue;
    verses.set(p.id, {
      reference: p.reference,
      book: p.book,
      chapter: p.chapter,
      verseStart: p.verseStart,
      verseEnd: p.verseEnd,
      explanationSha256: crypto.createHash("sha256").update(text, "utf8").digest("hex"),
    });
  }
  return { version: m[1], language: "en", verses };
}

/* —— Validation —— */

function cleanComment(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string" || raw.length > MAX_COMMENT * 4) return { ok: false };
  let s = raw.normalize("NFC")
    .replace(/\r\n?/g, "\n")
    // Strip control chars (keep \n and \t), zero-width/bidi overrides used for spoofing.
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!s) return { ok: true, value: null };
  if ([...s].length > MAX_COMMENT) return { ok: false };
  // More than two links in a 500-char note is almost always spam.
  if ((s.match(/https?:\/\/|www\./gi) || []).length > 2) return { ok: false, spam: true };
  return { ok: true, value: s };
}

/**
 * @returns {{ok:true, value:object}|{ok:false, field:string, code?:string}}
 */
function validateSubmission(body, catalog) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, field: "body" };
  for (const k of Object.keys(body)) if (!BODY_KEYS.includes(k)) return { ok: false, field: k };
  const { verseId, explanationVersion, rating } = body;
  if (typeof verseId !== "string" || !VERSE_ID_RE.test(verseId) || verseId.length > 40) return { ok: false, field: "verseId" };
  const verse = catalog.verses.get(verseId);
  if (!verse) return { ok: false, field: "verseId" };
  if (typeof explanationVersion !== "string" || !VERSION_RE.test(explanationVersion)) return { ok: false, field: "explanationVersion" };
  if (explanationVersion !== catalog.version) return { ok: false, field: "explanationVersion", code: "explanation_updated" };
  const language = body.language === undefined ? "en" : body.language;
  if (!LANGUAGES.includes(language) || language !== catalog.language) return { ok: false, field: "language" };
  if (rating !== "positive" && rating !== "negative") return { ok: false, field: "rating" };
  const cats = body.categories === undefined ? [] : body.categories;
  if (!Array.isArray(cats) || cats.length > CATEGORIES[rating].length) return { ok: false, field: "categories" };
  for (const c of cats) if (typeof c !== "string" || !CATEGORIES[rating].includes(c)) return { ok: false, field: "categories" };
  const categories = [...new Set(cats)].sort();
  const comment = cleanComment(body.comment);
  if (!comment.ok) return { ok: false, field: "comment", code: comment.spam ? "spam" : undefined };
  let localUserId = null;
  if (body.localUserId !== undefined && body.localUserId !== null) {
    if (typeof body.localUserId !== "string" || !UUID_RE.test(body.localUserId)) return { ok: false, field: "localUserId" };
    localUserId = body.localUserId;
  }
  const source = body.source === undefined ? "card" : body.source;
  if (!SOURCES.includes(source)) return { ok: false, field: "source" };
  if (body.website !== undefined && typeof body.website !== "string") return { ok: false, field: "website" };
  return {
    ok: true,
    honeypot: typeof body.website === "string" && body.website.trim() !== "",
    value: { verseId, verse, explanationVersion, language, rating, categories,
      comment: comment.value, localUserId, source },
  };
}

/* —— Request helpers —— */

function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

function header(req, name) {
  const v = req.headers ? req.headers[name] : undefined;
  return Array.isArray(v) ? v[0] : v;
}

function clientIp(req) {
  const fwd = header(req, "x-vercel-forwarded-for") || header(req, "x-forwarded-for") || header(req, "x-real-ip") || "";
  const first = String(fwd).split(",")[0].trim();
  return first || (req.socket && req.socket.remoteAddress) || "unknown";
}

function isLocalHost(host) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

/** Same-origin only: Origin must match the request host (production, preview or localhost). */
function originAllowed(req) {
  const site = header(req, "sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = header(req, "origin");
  const host = header(req, "x-forwarded-host") || header(req, "host") || "";
  if (!origin || !host) return false;
  let u;
  try { u = new URL(origin); } catch (_) { return false; }
  if (u.host !== host) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && isLocalHost(host);
}

function hmac(secret, label, value) {
  return crypto.createHmac("sha256", secret).update(label + ":" + value).digest("hex");
}

function readConfig(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  const secret = String(env.FEEDBACK_HASH_SECRET || "");
  if (!/^https:\/\/[^/\s]+$/.test(url) || key.length < 20 || secret.length < 32) return null;
  return { url, key, secret };
}

/** Small per-instance limiter in front of the database limiter (cheap first line of defense). */
function memoryLimiter(limit, windowMs) {
  const hits = new Map();
  return function allow(key, now) {
    const t = now || Date.now();
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < t) hits.delete(k);
    const cur = hits.get(key);
    if (!cur || cur.reset < t) { hits.set(key, { n: 1, reset: t + windowMs }); return true; }
    cur.n += 1;
    return cur.n <= limit;
  };
}

/** Supabase PostgREST RPC call with the service-role key (server only). */
function supabaseRpc(cfg, fetchImpl) {
  return async function rpc(fn, args) {
    const headers = { "content-type": "application/json", apikey: cfg.key, accept: "application/json" };
    // Legacy JWT service_role keys also need Authorization; new sb_secret_ keys use apikey only.
    if (cfg.key.startsWith("eyJ")) headers.authorization = "Bearer " + cfg.key;
    const res = await fetchImpl(cfg.url + "/rest/v1/rpc/" + fn, {
      method: "POST", headers, body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error("rpc " + fn + " failed: " + res.status);
    return res.json();
  };
}

/* —— Handler —— */

function createHandler(deps) {
  const d = deps || {};
  const env = d.env || process.env;
  const fetchImpl = d.fetch || globalThis.fetch;
  const log = d.log || ((msg) => console.error(msg));
  let catalog = d.catalog || null;
  const postLimit = memoryLimiter(10, 60 * 1000);
  const getLimit = memoryLimiter(60, 60 * 1000);

  function send(res, status, payload, extraHeaders) {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
    res.end(JSON.stringify(payload));
  }

  function newToken() {
    return crypto.randomBytes(32).toString("base64url");
  }

  function cookieHeader(token, req) {
    const host = header(req, "x-forwarded-host") || header(req, "host") || "";
    const secure = isLocalHost(host) && !d.forceSecureCookie ? "" : "; Secure";
    return `${COOKIE_NAME}=${token}; Path=${COOKIE_PATH}; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Strict${secure}`;
  }

  async function readBody(req) {
    const len = Number(header(req, "content-length") || 0);
    if (len > MAX_BODY_BYTES) return { tooLarge: true };
    let body;
    try {
      body = req.body; // Vercel's helper getter throws on malformed JSON.
    } catch (_) {
      return { invalid: true };
    }
    if (body === undefined && typeof req.on === "function") {
      body = await new Promise((resolve, reject) => {
        let size = 0; const chunks = [];
        req.on("data", (c) => { size += c.length; if (size > MAX_BODY_BYTES) { reject(Object.assign(new Error("too large"), { tooLarge: true })); } else chunks.push(c); });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
      }).catch((e) => (e && e.tooLarge ? { __tooLarge: true } : undefined));
      if (body && body.__tooLarge) return { tooLarge: true };
    }
    if (Buffer.isBuffer(body)) body = body.toString("utf8");
    if (typeof body === "string") {
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) return { tooLarge: true };
      try { body = JSON.parse(body); } catch (_) { return { invalid: true }; }
    } else if (body && JSON.stringify(body).length > MAX_BODY_BYTES) {
      return { tooLarge: true };
    }
    return { body };
  }

  return async function handler(req, res) {
    const method = req.method || "GET";
    if (method !== "GET" && method !== "POST") {
      return send(res, 405, { error: "method_not_allowed" }, { allow: "GET, POST" });
    }
    const cfg = readConfig(env);
    if (!cfg) {
      log("feedback: missing or invalid SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / FEEDBACK_HASH_SECRET");
      return send(res, 503, { error: "feedback_unavailable" });
    }
    try {
      if (!catalog) catalog = loadCatalog(d.root);
    } catch (e) {
      log("feedback: catalog load failed");
      return send(res, 503, { error: "feedback_unavailable" });
    }
    const rpc = d.rpc || supabaseRpc(cfg, fetchImpl);
    const ipKey = hmac(cfg.secret, "ip", clientIp(req));
    const cookies = parseCookies(header(req, "cookie"));
    const token = TOKEN_RE.test(cookies[COOKIE_NAME] || "") ? cookies[COOKIE_NAME] : null;

    if (method === "GET") {
      if (!getLimit(ipKey)) return send(res, 429, { error: "rate_limited" }, { "retry-after": "60" });
      let q;
      try { q = new URL(req.url || "", "http://x").searchParams; } catch (_) { q = new URLSearchParams(); }
      const verseId = q.get("verseId") || "";
      const version = q.get("v") || "";
      if (!VERSE_ID_RE.test(verseId) || !catalog.verses.has(verseId) || !VERSION_RE.test(version)) {
        return send(res, 400, { error: "invalid_request" });
      }
      if (!token) return send(res, 200, { submitted: false });
      try {
        const out = await rpc("hpd_feedback_status", {
          p_submitter_key: hmac(cfg.secret, "submitter", token),
          p_verse_id: verseId, p_explanation_version: version,
        });
        return send(res, 200, { submitted: !!(out && out.submitted === true) });
      } catch (e) {
        log("feedback: status rpc failed");
        return send(res, 502, { error: "storage_error" });
      }
    }

    // POST
    if (!originAllowed(req)) return send(res, 403, { error: "forbidden_origin" });
    const ctype = String(header(req, "content-type") || "").toLowerCase();
    if (!ctype.startsWith("application/json")) return send(res, 415, { error: "unsupported_media_type" });
    if (!postLimit(ipKey)) return send(res, 429, { error: "rate_limited" }, { "retry-after": "60" });
    const parsed = await readBody(req);
    if (parsed.tooLarge) return send(res, 413, { error: "payload_too_large" });
    if (parsed.invalid) return send(res, 400, { error: "invalid_request", field: "body" });
    const v = validateSubmission(parsed.body, catalog);
    if (!v.ok) {
      if (v.code === "explanation_updated") return send(res, 409, { error: "explanation_updated" });
      return send(res, 400, { error: "invalid_request", field: v.field });
    }
    const sessionToken = token || newToken();
    const extra = token ? undefined : { "set-cookie": cookieHeader(sessionToken, req) };
    // Honeypot filled: look successful to the bot, store nothing.
    if (v.honeypot) return send(res, 201, { ok: true, status: "created" }, extra);
    const f = v.value;
    let out;
    try {
      out = await rpc("hpd_feedback_submit", {
        p_verse_id: f.verseId,
        p_reference: f.verse.reference,
        p_book: f.verse.book,
        p_chapter: f.verse.chapter,
        p_verse_start: f.verse.verseStart,
        p_verse_end: f.verse.verseEnd,
        p_explanation_version: f.explanationVersion,
        p_explanation_sha256: f.verse.explanationSha256,
        p_language: f.language,
        p_rating: f.rating,
        p_categories: f.categories,
        p_comment: f.comment,
        p_local_user_id: f.localUserId,
        p_submitter_key: hmac(cfg.secret, "submitter", sessionToken),
        p_ip_key: ipKey,
        p_source: f.source,
      });
    } catch (e) {
      log("feedback: submit rpc failed");
      return send(res, 502, { error: "storage_error" }, extra);
    }
    const status = out && out.status;
    if (status === "created") return send(res, 201, { ok: true, status: "created" }, extra);
    if (status === "duplicate") return send(res, 409, { error: "already_submitted" }, extra);
    if (status === "rate_limited") return send(res, 429, { error: "rate_limited" }, Object.assign({ "retry-after": "600" }, extra || {}));
    log("feedback: unexpected rpc result");
    return send(res, 502, { error: "storage_error" }, extra);
  };
}

module.exports = {
  createHandler, validateSubmission, cleanComment, loadCatalog, originAllowed, readConfig,
  parseCookies, memoryLimiter, CATEGORIES, COOKIE_NAME, MAX_COMMENT,
};
