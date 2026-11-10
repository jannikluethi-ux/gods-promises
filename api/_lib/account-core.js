/**
 * Account deletion for His Promise Daily.
 * Verifies the caller's Supabase access token, then deletes that auth user
 * with the service-role key. The browser never supplies the user id, and the
 * service-role key never leaves this server.
 */
"use strict";

const { originAllowed, verifiedAuthUserId, memoryLimiter } = require("./feedback-core");

const BODY_KEYS = ["action", "confirmation"];

function header(req, name) {
  const value = req.headers ? req.headers[name] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

function readServiceConfig(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!/^https:\/\/[^/\s]+$/.test(url) || key.length < 20) return null;
  return { url, key };
}

function serviceHeaders(key) {
  const headers = { apikey: key, accept: "application/json" };
  headers.authorization = "Bearer " + key;
  return headers;
}

function createHandler(deps) {
  const d = deps || {};
  const env = d.env || process.env;
  const fetchImpl = d.fetch || globalThis.fetch;
  const log = d.log || ((msg) => console.error(msg));
  const limit = memoryLimiter(5, 60 * 60 * 1000);

  function send(res, status, payload, extra) {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    if (extra) for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
    res.end(JSON.stringify(payload));
  }

  return async function handler(req, res) {
    if ((req.method || "GET") !== "POST") {
      return send(res, 405, { error: "method_not_allowed" }, { allow: "POST" });
    }
    const cfg = readServiceConfig(env);
    if (!cfg) {
      log("account: missing or invalid SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
      return send(res, 503, { error: "account_unavailable" });
    }
    if (!originAllowed(req)) return send(res, 403, { error: "forbidden_origin" });
    const ctype = String(header(req, "content-type") || "").toLowerCase();
    if (!ctype.startsWith("application/json")) return send(res, 415, { error: "unsupported_media_type" });

    const ip = String(header(req, "x-forwarded-for") || header(req, "x-real-ip") || "unknown").split(",")[0].trim();
    if (!limit(ip)) return send(res, 429, { error: "rate_limited" }, { "retry-after": "3600" });

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (_) { return send(res, 400, { error: "invalid_request" }); }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return send(res, 400, { error: "invalid_request" });
    for (const key of Object.keys(body)) {
      if (!BODY_KEYS.includes(key)) return send(res, 400, { error: "invalid_request", field: key });
    }
    if (body.action !== "delete") return send(res, 400, { error: "invalid_request", field: "action" });
    if (body.confirmation !== "DELETE") return send(res, 400, { error: "confirmation_required", message: "Type DELETE to confirm account deletion." });

    const verified = await verifiedAuthUserId(req, cfg, fetchImpl);
    if (verified.error) return send(res, 502, { error: "storage_error" });
    if (!verified.id) return send(res, 401, { error: "invalid_session", message: "Sign in again, then retry account deletion." });

    let deleted;
    try {
      deleted = await fetchImpl(cfg.url + "/auth/v1/admin/users/" + verified.id, {
        method: "DELETE",
        headers: serviceHeaders(cfg.key),
      });
    } catch (_) {
      log("account: delete request failed");
      return send(res, 502, { error: "storage_error" });
    }
    if (!deleted.ok && deleted.status !== 404) {
      log("account: delete rejected");
      return send(res, 502, { error: "storage_error" });
    }
    return send(res, 200, { ok: true });
  };
}

module.exports = { createHandler, readServiceConfig };
