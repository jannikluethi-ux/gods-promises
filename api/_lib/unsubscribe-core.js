/**
 * One-click unsubscribe for the morning promise. GET (the link in the email)
 * and POST (List-Unsubscribe-Post) both turn the preference off. No login.
 */
"use strict";

const { verifyUnsubscribeToken } = require("./unsubscribe-token");

function header(req, name) {
  if (!req || !req.headers) return "";
  const value = req.headers[name] != null ? req.headers[name] : req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value || "";
}

function tokenFrom(req) {
  if (req.query && req.query.token) return String(req.query.token);
  try {
    const url = new URL(req.url || "/", "https://hispromisedaily.com");
    return url.searchParams.get("token") || "";
  } catch (err) {
    return "";
  }
}

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="en" class="theme-light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title}</title>
  <style>
    body { margin: 0; background: #e1e9f1; color: #1a2230; font-family: Georgia, "Times New Roman", serif; }
    main { max-width: 34rem; margin: 0 auto; padding: 4rem 1.5rem; }
    h1 { font-weight: 400; font-size: 1.8rem; }
    p, a { font-family: Arial, Helvetica, sans-serif; color: #3b4556; line-height: 1.55; }
    a { color: #3d5470; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    ${body}
    <p><a href="https://hispromisedaily.com/">Back to His Promise Daily</a></p>
  </main>
</body>
</html>`;
}

function readService(env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!/^https:\/\/[^/\s]+$/.test(url) || key.length < 20) return null;
  return { url: url, key: key };
}

function createHandler(deps) {
  const d = deps || {};
  const env = d.env || process.env;
  const fetchImpl = d.fetch || globalThis.fetch;
  const log = d.log || function (msg) { console.error(msg); };

  function send(res, status, html, contentType) {
    res.statusCode = status;
    res.setHeader("content-type", contentType || "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    res.end(html);
  }

  return async function handler(req, res) {
    const method = req.method || "GET";
    if (method !== "GET" && method !== "POST") {
      return send(res, 405, "method not allowed", "text/plain; charset=utf-8");
    }
    const secret = String(env.UNSUBSCRIBE_SECRET || "");
    const service = readService(env);
    if (secret.length < 16 || !service) {
      log("unsubscribe: not configured");
      const html = page("Unsubscribe unavailable", "<p>This link cannot be confirmed right now. You can turn the morning email off from your account page once you are signed in.</p>");
      return send(res, 503, method === "POST" ? "unavailable" : html, method === "POST" ? "text/plain; charset=utf-8" : undefined);
    }
    const userId = verifyUnsubscribeToken(tokenFrom(req), secret);
    if (!userId) {
      const html = page("Link not valid", "<p>This unsubscribe link is not valid. If you still receive the morning promise, turn it off from your account page.</p>");
      return send(res, 400, method === "POST" ? "invalid" : html, method === "POST" ? "text/plain; charset=utf-8" : undefined);
    }

    let updated;
    try {
      updated = await fetchImpl(service.url + "/rest/v1/profiles?id=eq." + userId, {
        method: "PATCH",
        headers: {
          apikey: service.key,
          authorization: "Bearer " + service.key,
          accept: "application/json",
          "content-type": "application/json",
          prefer: "return=minimal",
        },
        body: JSON.stringify({ daily_verse_email: false }),
      });
    } catch (err) {
      log("unsubscribe: update failed");
      updated = null;
    }
    if (!updated || !updated.ok) {
      log("unsubscribe: profile update rejected");
      const html = page("Please try again", "<p>We could not save that change. Open the link once more, or turn the morning email off from your account page.</p>");
      return send(res, 502, method === "POST" ? "error" : html, method === "POST" ? "text/plain; charset=utf-8" : undefined);
    }

    if (method === "POST") return send(res, 200, "unsubscribed", "text/plain; charset=utf-8");
    return send(res, 200, page(
      "You’re unsubscribed",
      "<p>You will no longer receive the morning promise by email. The rest of His Promise Daily is unchanged, and you can turn the email on again from your account page.</p>"
    ));
  };
}

module.exports = { createHandler, tokenFrom };
