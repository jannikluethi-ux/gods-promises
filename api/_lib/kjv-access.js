/**
 * Single switch for self-hosted KJV in the United Kingdom.
 * Default off. Carlos turns this to true only after UK distribution rights
 * are explicitly allowed. GB plus the Crown dependencies GG, JE, and IM.
 */
"use strict";

const KJV_UK_ENABLED = false;
const UK_COUNTRIES = new Set(["GB", "GG", "JE", "IM"]);

function kjvAllowedForCountry(country, ukEnabled) {
  const enabled = ukEnabled == null ? KJV_UK_ENABLED : !!ukEnabled;
  const code = String(country || "").trim().toUpperCase();
  if (UK_COUNTRIES.has(code)) return enabled;
  return true;
}

module.exports = { KJV_UK_ENABLED, UK_COUNTRIES, kjvAllowedForCountry };
