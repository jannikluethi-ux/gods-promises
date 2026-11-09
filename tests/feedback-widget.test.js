/* Non-browser checks for js/feedback.js markup/state and its hook in js/ui-shared.js.
 * Interactive states (expand, multi-select, submit, errors) are covered by the browser
 * script tests/e2e/feedback-widget.e2e.js. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}
function context(extra) {
  const listeners = {};
  const document = {
    readyState: "complete",
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    querySelectorAll: () => [],
  };
  const ctx = vm.createContext(Object.assign({ console, localStorage: memoryStorage(), document, setTimeout, clearTimeout,
    addEventListener: () => {} }, extra || {}));
  ctx.window = ctx;
  ctx.__listeners = listeners;
  return ctx;
}
function load(ctx, rel) { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), "utf8"), ctx, { filename: rel }); }

(async () => {
  const ctx = context();
  load(ctx, "js/feedback.js");
  const FB = ctx.HPDFeedback;
  assert.ok(FB && FB.html);
  // Delegated listeners are installed once on document, not per card.
  assert.deepEqual(Object.keys(ctx.__listeners).sort(), ["click", "input", "submit"]);

  // Collapsed state.
  const h = FB.html("jhn-3-16", "promise-4", "card");
  assert.match(h, /^<section class="fb" data-fb-verse="jhn-3-16" data-fb-version="promise-4" data-fb-source="card" aria-label="Feedback on this explanation">/);
  assert.ok(h.includes(">Was this explanation helpful?</p>"));
  assert.ok(h.includes('data-fb-rating="positive" aria-pressed="false" aria-expanded="false"><span aria-hidden="true">👍</span> Yes, helpful</button>'));
  assert.ok(h.includes('data-fb-rating="negative" aria-pressed="false" aria-expanded="false"><span aria-hidden="true">👎</span> Not really</button>'));
  assert.ok(h.includes('role="group" aria-labelledby="fb-q-'));
  assert.ok(!h.includes("<form"), "form is built only on demand");
  assert.equal(FB.html("verse-page", "promise-4", "verse_page").includes('data-fb-source="verse_page"'), false);
  assert.ok(FB.html("psa-23-1", "promise-4", "verse_page").includes('data-fb-source="verse_page"'));
  assert.ok(FB.html("psa-23-1", "promise-4", "evil").includes('data-fb-source="card"'));
  // Unknown / unsafe ids render nothing (no injection into markup).
  assert.equal(FB.html('x"><img src=x onerror=alert(1)>', "promise-4"), "");
  assert.equal(FB.html("jhn-3-16", ""), "");
  assert.ok(!FB.html("jhn-3-16", 'promise-4"><b>').includes("<b>"));

  // Expanded forms: exact categories, multi-select checkboxes, optional comment.
  const T = FB._test;
  const yes = T.formHtml("positive");
  const no = T.formHtml("negative");
  const labels = (s) => [...s.matchAll(/<input type="checkbox" name="fb-cat" value="([a-z_]+)" \/><span>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(labels(yes).map((x) => x[1]), ["Clear and easy to understand", "Biblically accurate and relevant",
    "Helped me understand the verse better", "Practical and applicable to my daily life", "Encouraged or inspired me"]);
  assert.deepEqual(labels(no).map((x) => x[1]), ["The explanation is confusing", "Too general or superficial",
    "Missing important biblical context", "The interpretation seems inaccurate", "Doesn’t explain how to apply the verse",
    "Too long or repetitive", "Doesn’t answer what the verse actually means", "Other"]);
  const core = require("../api/_lib/feedback-core");
  assert.deepEqual(labels(yes).map((x) => x[0]), core.CATEGORIES.positive);
  assert.deepEqual(labels(no).map((x) => x[0]), core.CATEGORIES.negative);
  for (const f of [yes, no]) {
    assert.ok(f.includes("Anything else you’d like us to know?"));
    assert.ok(f.includes('placeholder="Tell us how we could improve this explanation…"'));
    assert.ok(f.includes('maxlength="500"'));
    assert.ok(!/required/.test(f), "nothing is mandatory");
    assert.ok(f.includes('<button type="submit" class="fb-submit">Send feedback</button>'));
    assert.ok(f.includes('role="status" aria-live="polite"'));
    assert.ok(f.includes('<div class="fb-hp" aria-hidden="true">') && f.includes('tabindex="-1"'));
    // Every control has an accessible name: label wraps each checkbox; textarea has for/id.
    const id = f.match(/<textarea id="([^"]+)"/)[1];
    assert.ok(f.includes(`<label class="fb-label" for="${id}">`));
  }
  assert.ok(yes.includes("<legend>What helped? (optional)</legend>"));
  assert.ok(no.includes("<legend>What could be better? (optional)</legend>"));
  assert.equal(T.THANKS, "Thank you! Your feedback helps us make His Promise Daily better.");

  // Already-submitted cache: done state instead of the form, per verse + version only.
  T.remember("jhn-3-16", "promise-4", "positive");
  assert.equal(FB.wasSubmitted("jhn-3-16", "promise-4"), true);
  assert.equal(FB.wasSubmitted("jhn-3-16", "promise-5"), false);
  assert.equal(FB.wasSubmitted("jhn-3-17", "promise-4"), false);
  const done = FB.html("jhn-3-16", "promise-4");
  assert.ok(done.includes('class="fb-done" role="status"') && done.includes(T.ALREADY));
  assert.ok(!done.includes("fb-choice"));
  assert.ok(FB.html("jhn-3-16", "promise-5").includes("fb-choice"), "a new explanation version can be rated again");
  // Corrupt or blocked storage never breaks rendering.
  ctx.localStorage.setItem("hpd.feedback.v1", "{oops");
  assert.ok(FB.html("jhn-3-16", "promise-4").includes("fb-choice"));
  const blocked = context({ localStorage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } } });
  load(blocked, "js/feedback.js");
  assert.ok(blocked.HPDFeedback.html("jhn-3-16", "promise-4").includes("fb-choice"));
  blocked.HPDFeedback._test.remember("jhn-3-16", "promise-4", "positive");

  // ui-shared: every rendered card's explanation carries the widget with the live EXPLAIN_VERSION.
  const explanations = JSON.parse(fs.readFileSync(path.join(ROOT, "data/explanations.json"), "utf8"));
  const version = fs.readFileSync(path.join(ROOT, "js/ui-shared.js"), "utf8").match(/const EXPLAIN_VERSION = "([^"]+)"/)[1];
  const ui = context({ fetch: async () => ({ ok: true, json: async () => explanations }) });
  load(ui, "js/feedback.js");
  load(ui, "js/ui-shared.js");
  await ui.GodsPromisesUI.loadExplanations();
  const id = Object.keys(explanations)[0];
  const card = ui.GodsPromisesUI.renderPromiseCard({ id, reference: "Ref 1:1", text: "Text", themes: [], feelings: [] });
  const explainBlock = card.slice(card.indexOf('<div class="card-explain"'), card.indexOf("</div>", card.indexOf('<div class="card-explain"')) + 6);
  assert.ok(explainBlock.includes('<p class="card-explain-text">'));
  assert.ok(explainBlock.indexOf("card-explain-text") < explainBlock.indexOf('class="fb"'), "widget sits under the explanation");
  assert.ok(explainBlock.includes(`data-fb-verse="${id}" data-fb-version="${version}" data-fb-source="card"`));
  // Without feedback.js the card renders exactly as before (no widget, nothing broken).
  const plain = context({ fetch: async () => ({ ok: true, json: async () => explanations }) });
  load(plain, "js/ui-shared.js");
  await plain.GodsPromisesUI.loadExplanations();
  const plainCard = plain.GodsPromisesUI.renderPromiseCard({ id, reference: "Ref 1:1", text: "Text", themes: [], feelings: [] });
  assert.ok(!plainCard.includes('class="fb"'));
  assert.ok(plainCard.includes(`<p class="card-explain-text">${explanations[id].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</p>`));

  console.log("feedback-widget: all cases pass");
})().catch((e) => { console.error(e); process.exit(1); });
