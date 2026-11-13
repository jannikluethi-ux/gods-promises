/**
 * Tells the browser whether this visitor may be shown the self-hosted KJV.
 * Uses the country Vercel sets on the request. A missing country is not
 * treated as the United Kingdom, so local development still works.
 */
"use strict";

const { kjvAllowedForCountry } = require("./_lib/kjv-access");

module.exports = function bibleRegion(req, res) {
  const header = req && req.headers ? req.headers["x-vercel-ip-country"] : "";
  const country = String(header || "").trim().toUpperCase();
  const allowed = kjvAllowedForCountry(country);
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "private, no-store");
  res.end(JSON.stringify({ country: country || null, kjv: allowed }));
};
