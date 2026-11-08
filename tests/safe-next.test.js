require("../js/safe-next.js");
const assert = require("assert");
const f = globalThis.GodsPromisesSafeNext;
const H = "https://jannikluethi-ux.github.io/gods-promises/login.html?next=x";
const B = "https://jannikluethi-ux.github.io/gods-promises/";
const ok = { "me.html": B+"me.html", "index.html": B+"index.html", "index.html?q=1#v": B+"index.html?q=1#v", "me.html#upgrade": B+"me.html#upgrade", "/gods-promises/me.html": B+"me.html", "./me.html": B+"me.html" };
for (const [i,o] of Object.entries(ok)) assert.strictEqual(f(i,H), o, i);
const bad = ["javascript:alert(1)","JavaScript:alert(1)"," javascript:alert(1)","java\tscript:alert(1)","data:text/html,<script>alert(1)</script>","//evil.com/me.html","\\\\evil.com/me.html","/\\evil.com","https://evil.com/me.html","http://jannikluethi-ux.github.io/gods-promises/me.html","https:evil.com","%2F%2Fevil.com","/%2F%2Fevil.com/me.html","login.html","../other/me.html","/me.html","me.html.evil","vbscript:x","","https://jannikluethi-ux.github.io@evil.com/me.html", null, undefined];
for (const i of bad) assert.strictEqual(f(i,H), B+"me.html", String(i));
// root deployment (e.g. Vercel)
const R = "https://hispromisesdaily.com/login.html";
assert.strictEqual(f("me.html",R),"https://hispromisesdaily.com/me.html");
assert.strictEqual(f("/",R),"https://hispromisesdaily.com/");
assert.strictEqual(f("//evil.com",R),"https://hispromisesdaily.com/me.html");
console.log("safe-next: all", Object.keys(ok).length+bad.length+3, "cases pass");
