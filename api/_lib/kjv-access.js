/**
 * Server-side King James authorization.
 *
 * This is an operational control, not a legal determination.
 * KJV text is sent only when KJV_GLOBAL_ENABLED is exactly "true"
 * and the country is on KJV_ALLOWED_COUNTRIES. Both default off / empty.
 * Any other flag value is a broken configuration and denies everyone.
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

function parseFlag(name, value) {
  if (value == null || value === "" || value === "false") return { ok: true, enabled: false };
  if (value === "true") return { ok: true, enabled: true };
  return { ok: false, name: name };
}

function parseCountryList(name, value) {
  if (value == null || value === "") return { ok: true, codes: [] };
  if (typeof value !== "string") return { ok: false, name: name };
  const parts = value.split(",");
  const codes = [];
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i].trim();
    if (!/^[A-Za-z]{2}$/.test(token)) return { ok: false, name: name };
    const upper = token.toUpperCase();
    codes.push(UK_ALIASES[upper] || upper);
  }
  return { ok: true, codes: codes };
}

function readConfig(env) {
  const settings = env || {};
  const fields = [];
  const globalFlag = parseFlag("KJV_GLOBAL_ENABLED", settings.KJV_GLOBAL_ENABLED);
  if (!globalFlag.ok) fields.push(globalFlag.name);
  const restrictedFlag = parseFlag("KJV_ENABLE_RESTRICTED", settings.KJV_ENABLE_RESTRICTED);
  if (!restrictedFlag.ok) fields.push(restrictedFlag.name);
  const allowed = parseCountryList("KJV_ALLOWED_COUNTRIES", settings.KJV_ALLOWED_COUNTRIES);
  if (!allowed.ok) fields.push(allowed.name);
  const extraRestricted = parseCountryList("KJV_RESTRICTED_COUNTRIES", settings.KJV_RESTRICTED_COUNTRIES);
  if (!extraRestricted.ok) fields.push(extraRestricted.name);
  if (fields.length) {
    console.error("KJV config invalid: " + fields.join(","));
    return { ok: false, fields: fields };
  }
  return {
    ok: true,
    globalEnabled: globalFlag.enabled,
    enableRestricted: restrictedFlag.enabled,
    allowed: new Set(allowed.codes),
    restricted: new Set(RESTRICTED.concat(extraRestricted.codes)),
  };
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
  const config = readConfig(env);
  const parsed = normalizeCountry(country);
  if (!parsed.ok) return deny(parsed.reason);
  if (!config.ok) return deny("config_invalid");
  if (!config.globalEnabled) return deny("global_off");
  if (config.restricted.has(parsed.code) && !config.enableRestricted) return deny("restricted");
  if (!config.allowed.has(parsed.code)) return deny("not_allowlisted");
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
  readConfig,
};
