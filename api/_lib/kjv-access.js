/**
 * Where the server may send King James text.
 *
 * This is an operational control, not a legal determination. Restricted
 * territories are off unless an administrator sets KJV_ENABLE_RESTRICTED=true
 * after written permission and also lists that territory in
 * KJV_ALLOWED_COUNTRIES. Nothing in a deploy turns a restricted territory on.
 *
 * Default allowlist, used when KJV_ALLOWED_COUNTRIES is unset: US, CA, AU, DE.
 * Missing, empty, unknown, and XX countries receive no KJV text.
 */
"use strict";

const RESTRICTED = ["GB", "GG", "JE", "IM"];
const DEFAULT_ALLOWED = ["US", "CA", "AU", "DE"];
const UNAVAILABLE = "KJV is currently unavailable in your region.";

function parseList(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback.slice();
  return String(value)
    .split(",")
    .map(function (part) { return part.trim().toUpperCase(); })
    .filter(Boolean);
}

function kjvDecision(country, env) {
  const settings = env || {};
  let code = "";
  try {
    code = String(country == null ? "" : country).trim().toUpperCase();
  } catch (err) {
    return { allowed: false, offline: false, reason: "lookup_error", message: UNAVAILABLE };
  }
  if (!code || code === "XX" || code === "T1" || code === "UNKNOWN") {
    return { allowed: false, offline: false, reason: "unknown_country", message: UNAVAILABLE };
  }
  const restricted = new Set(parseList(settings.KJV_RESTRICTED_COUNTRIES, RESTRICTED));
  const enableRestricted = String(settings.KJV_ENABLE_RESTRICTED || "").toLowerCase() === "true";
  if (restricted.has(code) && !enableRestricted) {
    return { allowed: false, offline: false, reason: "restricted", message: UNAVAILABLE };
  }
  const allowed = new Set(parseList(settings.KJV_ALLOWED_COUNTRIES, DEFAULT_ALLOWED));
  if (!allowed.has(code)) {
    return { allowed: false, offline: false, reason: "not_allowlisted", message: UNAVAILABLE };
  }
  return { allowed: true, offline: true, reason: "allowlisted", message: "" };
}

module.exports = {
  RESTRICTED,
  DEFAULT_ALLOWED,
  UNAVAILABLE,
  kjvDecision,
};
