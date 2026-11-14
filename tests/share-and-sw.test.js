/* Share-card PNG and the service-worker network boundary. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { renderShareCardPng, WIDTH, HEIGHT } = require("../api/_lib/share-card");
const { bypassRequest, SHELL, CACHE } = require("../sw");

function pngSize(buffer) {
  assert.equal(buffer[0], 0x89);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

(async () => {
  const png = await renderShareCardPng({
    id: "gen-1-28",
    reference: "Genesis 1:28",
    text: "God blessed them. He said to them, “Be fruitful, multiply, fill the earth, and subdue it.”",
  });
  const size = pngSize(png);
  assert.equal(size.width, WIDTH);
  assert.equal(size.height, HEIGHT);
  fs.mkdirSync("/tmp/hpd-preview", { recursive: true });
  fs.writeFileSync("/tmp/hpd-preview/share-card.png", png);

  const origin = "https://hispromisedaily.com";
  for (const pathName of ["/api/feedback", "/api/account", "/api/daily-email", "/api/unsubscribe", "/api/og"]) {
    assert.equal(bypassRequest(new URL(origin + pathName), "GET", origin), true, pathName);
    assert.equal(bypassRequest(new URL(origin + pathName), "POST", origin), true, pathName);
  }
  assert.equal(bypassRequest(new URL(origin + "/"), "POST", origin), true);
  assert.equal(bypassRequest(new URL("https://ixxeidpdgktzvcbucosq.supabase.co/auth/v1/token"), "GET", origin), true);
  assert.equal(bypassRequest(new URL(origin + "/_vercel/insights/script.js"), "GET", origin), true);
  assert.equal(bypassRequest(new URL(origin + "/"), "GET", origin), false);
  assert.equal(bypassRequest(new URL(origin + "/promises-data.js"), "GET", origin), false);
  assert.equal(CACHE, "hpd-shell-v8");
  assert.ok(SHELL.includes("/js/discovery.js"));
  assert.ok(SHELL.includes("/js/discovery-data.js"));
  assert.ok(SHELL.includes("/js/filter-studies.js"));
  assert.ok(SHELL.includes("/js/smart-search.js"));
  assert.ok(SHELL.includes("/js/relevance.js"));
  assert.ok(SHELL.includes("/promises-data.js"));
  assert.ok(SHELL.includes("/data/explanations.json"));
  assert.ok(SHELL.includes("/"));
  assert.equal(SHELL.includes("/index.html"), false);
  assert.equal(SHELL.some((item) => item.startsWith("/api/")), false);

  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "His Promise Daily");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.background_color, "#e1e9f1");
  assert.equal(manifest.theme_color, "#e1e9f1");
  assert.ok(manifest.icons.length >= 2);

  console.log("share-and-sw: PNG card is 1080 square; /api, auth hosts, and non-GET bypass the cache");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
