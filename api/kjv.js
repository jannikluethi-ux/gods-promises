/**
 * Gated King James passages for the promise ids the page is showing.
 * The span file is generated at build time and is not a static asset.
 * A missing file, a bad country, or a thrown lookup returns no verse text.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { kjvDecision, UNAVAILABLE } = require("./_lib/kjv-access");

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+){1,8}$/;
function spansPath() {
  return process.env.KJV_SPANS_PATH || path.join(__dirname, "_lib", "kjv-spans.generated.json");
}

function countryFrom(req) {
  const headers = req && req.headers ? req.headers : {};
  const value = headers["x-vercel-ip-country"];
  if (Array.isArray(value)) return value[0];
  return value;
}

function readSpans() {
  const raw = fs.readFileSync(spansPath(), "utf8");
  const data = JSON.parse(raw);
  if (!data || typeof data.passages !== "object" || !data.passages) {
    throw new Error("spans");
  }
  return data.passages;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "private, no-store");
  res.setHeader("vary", "x-vercel-ip-country");
  res.end(JSON.stringify(body));
}

function idsFrom(req) {
  const url = new URL(req.url || "/", "https://hispromisedaily.com");
  const raw = url.searchParams.get("ids") || "";
  return raw.split(",").map(function (id) { return id.trim(); }).filter(Boolean).slice(0, 24);
}

module.exports = function kjv(req, res) {
  let decision;
  try {
    decision = kjvDecision(countryFrom(req), process.env);
  } catch (err) {
    send(res, 503, { allowed: false, offline: false, message: UNAVAILABLE });
    return;
  }
  if (!decision.allowed) {
    send(res, 200, { allowed: false, offline: false, message: decision.message });
    return;
  }
  const ids = idsFrom(req);
  if (!ids.length) {
    send(res, 200, { allowed: true, offline: true });
    return;
  }
  if (ids.some(function (id) { return !ID_RE.test(id); })) {
    send(res, 400, { allowed: false, offline: false, message: UNAVAILABLE });
    return;
  }
  let passages;
  try {
    const all = readSpans();
    passages = {};
    ids.forEach(function (id) {
      if (typeof all[id] === "string" && all[id]) passages[id] = all[id];
    });
  } catch (err) {
    send(res, 503, { allowed: false, offline: false, message: UNAVAILABLE });
    return;
  }
  send(res, 200, { allowed: true, offline: true, passages: passages });
};
