/**
 * Signed unsubscribe tokens. The link in a morning email carries the user id
 * and an HMAC. No login, and the secret never goes to the browser.
 */
"use strict";

const crypto = require("crypto");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PURPOSE = "hpd-daily-email-unsubscribe:";

function signUnsubscribeToken(userId, secret) {
  if (!UUID_RE.test(String(userId || "")) || !secret) return "";
  const id = String(userId).toLowerCase();
  const sig = crypto.createHmac("sha256", String(secret)).update(PURPOSE + id).digest("base64url");
  return id + "." + sig;
}

function verifyUnsubscribeToken(token, secret) {
  if (!secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !UUID_RE.test(parts[0])) return null;
  const id = parts[0].toLowerCase();
  const expected = crypto.createHmac("sha256", String(secret)).update(PURPOSE + id).digest("base64url");
  const given = Buffer.from(parts[1]);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return null;
  if (!crypto.timingSafeEqual(given, want)) return null;
  return id;
}

module.exports = { signUnsubscribeToken, verifyUnsubscribeToken, UUID_RE };
