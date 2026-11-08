require("../js/analytics.js");
const assert = require("assert");
const s = globalThis.HPDAnalyticsSanitize;
const D = "https://hispromisedaily.com";
const pv = (url) => ({ type: "pageview", url });
assert.deepStrictEqual(s(pv(D + "/")), { type: "pageview", url: D + "/" });
assert.deepStrictEqual(s(pv(D + "/login.html?next=me.html%23upgrade")), { type: "pageview", url: D + "/login.html" });
assert.deepStrictEqual(s(pv(D + "/index.html?q=anxiety&email=test%40example.invalid#v=JHN.3.16")), { type: "pageview", url: D + "/index.html" });
assert.deepStrictEqual(s(pv(D + "/me.html#upgrade")), { type: "pageview", url: D + "/me.html" });
assert.deepStrictEqual(s(pv("https://www.hispromisedaily.com/privacy.html?x=1")), { type: "pageview", url: "https://www.hispromisedaily.com/privacy.html" });
for (const u of [D + "/secret.html", D + "/verses/gen-1-28.html?q=private#saved", D + "/browse/", D + "/browse/topics/hope.html", D + "/data/explanations.json", D + "/login.html/extra", "https://jannikluethi-ux.github.io/gods-promises/", "https://gods-promises-azure.vercel.app/", "http://localhost:8766/", "http://hispromisedaily.com/", "https://evil.com/", "https://hispromisedaily.com.evil.com/", "not a url"])
  assert.strictEqual(s(pv(u)), null, u);
assert.strictEqual(s({ type: "event", url: D + "/" }), null);
assert.strictEqual(s(null), null);
const out = JSON.stringify(s(pv(D + "/index.html?q=grief&next=x&email=a%40b.invalid#h")));
for (const bad of ["grief", "next", "email", "#", "?"]) assert.ok(!out.includes(bad), bad);
assert.strictEqual(globalThis.HPDAnalyticsHostAllowed("jannikluethi-ux.github.io"), false);
assert.strictEqual(globalThis.va, undefined, "va must not be defined outside browser/allowed host");
console.log("analytics: all cases pass");
