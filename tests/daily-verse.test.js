/* The landing page and the morning email must pick the same Zurich-midnight verse. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const daily = require("../js/daily-verse");

const MAX_TEXT = 320;
const STEP = 7919;

function gcd(a, b) {
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function referenceIndex(poolLength, key) {
  const [y, m, d] = key.split("-").map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const step = gcd(STEP % poolLength || 1, poolLength) === 1 ? STEP % poolLength || 1 : 1;
  return (((day % poolLength) * step) % poolLength + poolLength) % poolLength;
}

const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "promises.json"), "utf8")).promises;
const pool = catalog.filter((entry) => entry.text && entry.text.length <= MAX_TEXT);
assert.ok(pool.length > 10);

for (const key of ["1970-01-01", "2026-11-10", "2026-11-11", "2030-02-28"]) {
  const picked = daily.promiseFor(catalog, key);
  assert.equal(picked, pool[referenceIndex(pool.length, key)], key);
}

const today = daily.promiseFor(catalog, "2026-11-10");
const tomorrow = daily.promiseFor(catalog, "2026-11-11");
assert.notEqual(today.id, tomorrow.id);
assert.equal(daily.promiseFor(catalog, "2026-11-10").id, today.id);

assert.equal(daily.zurichDateKey(new Date("2026-01-15T22:30:00Z")), "2026-01-15");
assert.equal(daily.zurichDateKey(new Date("2026-01-15T23:30:00Z")), "2026-01-16");
assert.equal(daily.zurichDateKey(new Date("2026-07-15T21:30:00Z")), "2026-07-15");
assert.equal(daily.zurichDateKey(new Date("2026-07-15T22:30:00Z")), "2026-07-16");

assert.equal(daily.shiftDateKey("2026-03-01", 1), "2026-02-28");
assert.equal(daily.daysBetweenKeys("2026-11-10", "2026-11-12"), 2);
assert.equal(daily.relativeLabel(0, "2026-11-10"), "Today");
assert.equal(daily.relativeLabel(1, "2026-11-09"), "Yesterday");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.match(app, /GodsPromisesDaily/);
assert.match(app, /promiseForPool\(dailyPool/);
assert.doesNotMatch(app, /const DAILY_STEP/);

const tiny = [{ id: "long", text: "x".repeat(400) }, { id: "short", text: "short" }];
assert.equal(daily.promiseFor(tiny, "2026-11-10").id, "short");
assert.equal(daily.dailyPool([{ id: "only", text: "x".repeat(400) }])[0].id, "only");

console.log("daily-verse: Zurich midnight picker matches the landing-page formula");
