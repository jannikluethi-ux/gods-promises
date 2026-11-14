/**
 * Server-side King James authorization.
 *
 * This is an operational control, not a legal determination.
 * KJV text is sent only when KJV_GLOBAL_ENABLED is the string "true"
 * and the country is on KJV_ALLOWED_COUNTRIES. Both default off / empty.
 * GB, GG, JE, and IM stay blocked unless KJV_ENABLE_RESTRICTED is also
 * "true" after written Cambridge permission. A deploy does not set any
 * of these. Ordinary requests cannot change them.
 *
 * Country comes only from x-vercel-ip-country. On Vercel the platform
 * overwrites that header, so a value typed by the browser does not arrive.
 * This module does not read cf-ipcountry, x-country, or a query string.
 */
"use strict";

const RESTRICTED = ["GB", "GG", "JE", "IM"];
const UK_ALIASES = {
  UK: "GB",
  GB: "GB",
  ENG: "GB",
  SCT: "GB",
  WLS: "GB",
  NIR: "GB",
};
const UNAVAILABLE = "KJV is not available in your region.";

function parseList(value) {
  if (value == null || String(value).trim() === "") return [];
  return String(value)
    .split(",")
    .map(function (part) { return part.trim().toUpperCase(); })
    .filter(Boolean)
    .map(function (code) { return UK_ALIASES[code] || code; });
}

function globalEnabled(env) {
  return String((env || {}).KJV_GLOBAL_ENABLED || "").trim().toLowerCase() === "true";
}

function restrictedSet(env) {
  return new Set(RESTRICTED.concat(parseList((env || {}).KJV_RESTRICTED_COUNTRIES)));
}

function allowSet(env) {
  return new Set(parseList((env || {}).KJV_ALLOWED_COUNTRIES));
}

function normalizeCountry(country) {
  let code = "";
  try {
    code = String(country == null ? "" : country).trim().toUpperCase();
  } catch (err) {
    return { ok: false, reason: "lookup_error" };
  }
  if (!code || code === "XX" || code === "T1" || code === "UNKNOWN") {
    return { ok: false, reason: "unknown_country" };
  }
  if (UK_ALIASES[code]) code = UK_ALIASES[code];
  if (!/^[A-Z]{2}$/.test(code)) return { ok: false, reason: "malformed" };
  return { ok: true, code: code };
}

function deny(reason) {
  return { allowed: false, offline: false, reason: reason, message: UNAVAILABLE };
}

function kjvDecision(country, env) {
  const settings = env || {};
  const parsed = normalizeCountry(country);
  if (!parsed.ok) return deny(parsed.reason);
  if (!globalEnabled(settings)) return deny("global_off");
  const restricted = restrictedSet(settings);
  const enableRestricted = String(settings.KJV_ENABLE_RESTRICTED || "").trim().toLowerCase() === "true";
  if (restricted.has(parsed.code) && !enableRestricted) return deny("restricted");
  if (!allowSet(settings).has(parsed.code)) return deny("not_allowlisted");
  return { allowed: true, offline: false, reason: "allowlisted", message: "" };
}

function countryFrom(req) {
  const headers = req && req.headers ? req.headers : {};
  const value = headers["x-vercel-ip-country"];
  if (Array.isArray(value)) return value[0];
  return value;
}

function authorizeKjv(req, env) {
  return kjvDecision(countryFrom(req), env);
}

module.exports = {
  RESTRICTED,
  UNAVAILABLE,
  kjvDecision,
  authorizeKjv,
  countryFrom,
  globalEnabled,
};
