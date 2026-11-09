/* Browser check + screenshots for the explanation feedback widget (not run in CI).
 *
 *   python3 scripts/build_site.py --target production
 *   node scripts/dev_feedback_server.js 18790 &                      # working storage
 *   FEEDBACK_DEV_FAIL=1 node scripts/dev_feedback_server.js 18791 &  # failing storage
 *   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core \
 *     BASE=http://localhost:18790 FAIL_BASE=http://localhost:18791 OUT=/tmp/shots \
 *     node tests/e2e/feedback-widget.e2e.js
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");

const BASE = process.env.BASE || "http://localhost:18790";
const FAIL_BASE = process.env.FAIL_BASE || "http://localhost:18791";
const OUT = process.env.OUT || "/tmp/hpd-feedback-shots";
const VERSE = process.env.VERSE || "jhn-14-27";
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
};

async function shot(page, locator, name) {
  const file = path.join(OUT, name + ".png");
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  // Unstick the header so tall element captures are not overlapped by it.
  await locator.screenshot({ path: file, animations: "disabled", style: ".site-header{position:static!important}" });
  return file;
}

async function verseFlow(browser, kind, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/verses/${VERSE}.html`);
  const box = page.locator(".fb");
  const article = page.locator(".catalog-verse");
  await box.locator(".fb-choice").first().waitFor();
  assert.equal(await box.locator(".fb-question").textContent(), "Was this explanation helpful?");
  assert.equal(await box.locator(".fb-form").count(), 0);
  // The widget sits directly under the explanation text.
  const below = await page.evaluate(() => {
    const t = document.querySelector(".card-explain-text").getBoundingClientRect();
    const f = document.querySelector(".fb").getBoundingClientRect();
    return f.top >= t.bottom && f.top - t.bottom < 40;
  });
  assert.ok(below, "widget directly under explanation");
  await shot(page, article, `${kind}-verse-1-collapsed`);

  await box.getByRole("button", { name: "Yes, helpful" }).click();
  assert.equal(await box.locator('input[name="fb-cat"]').count(), 5);
  assert.equal(await box.getByRole("button", { name: "Yes, helpful" }).getAttribute("aria-pressed"), "true");
  await box.getByText("Clear and easy to understand").click();
  await box.getByText("Encouraged or inspired me").click();
  assert.equal(await box.locator('input[name="fb-cat"]:checked').count(), 2, "multi-select");
  await shot(page, article, `${kind}-verse-2-yes-expanded`);

  await box.getByRole("button", { name: "Not really" }).click();
  assert.equal(await box.locator('input[name="fb-cat"]').count(), 8);
  assert.equal(await box.locator('input[name="fb-cat"]:checked').count(), 0, "switching clears the other set");
  await box.getByText("Missing important biblical context").click();
  await box.getByText("Too general or superficial").click();
  const comment = box.getByLabel("Anything else you’d like us to know? (optional)");
  assert.equal(await comment.getAttribute("placeholder"), "Tell us how we could improve this explanation…");
  await comment.fill("Some background on the Upper Room setting would help.");
  assert.match(await box.locator(".fb-count").textContent(), /^5\d \/ 500$/);
  await comment.fill("x".repeat(600));
  assert.equal((await comment.inputValue()).length, 500, "maxlength 500");
  await comment.fill("Some background on the Upper Room setting would help.");
  await shot(page, article, `${kind}-verse-3-no-expanded`);

  await box.getByRole("button", { name: "Send feedback" }).click();
  await box.locator(".fb-done").waitFor();
  assert.equal((await box.locator(".fb-done").textContent()).trim(), "Thank you! Your feedback helps us make His Promise Daily better.");
  assert.equal(await box.locator(".fb-form").count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.className), "fb-done", "focus moves to the confirmation");
  await shot(page, article, `${kind}-verse-4-thank-you`);
  const cookies = await ctx.cookies();
  const c = cookies.find((x) => x.name === "hpd_fb");
  assert.ok(c && c.httpOnly && c.sameSite === "Strict" && c.path === "/api/feedback");
  assert.equal(await page.evaluate(() => document.cookie), "", "cookie not readable from JS");

  // Returning visitor: cached state, no form.
  await page.reload();
  await box.locator(".fb-done").waitFor();
  assert.match(await box.locator(".fb-done").textContent(), /already shared feedback/);
  await shot(page, article, `${kind}-verse-5-already-submitted`);
  // Cache cleared: the server (cookie) still knows; opening the form flips to "already".
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await box.getByRole("button", { name: "Yes, helpful" }).click();
  await box.locator(".fb-done").waitFor();
  assert.match(await box.locator(".fb-done").textContent(), /already shared feedback/);
  // And a direct duplicate POST is refused server-side.
  const dup = await page.evaluate(async (v) => {
    const r = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ verseId: v, explanationVersion: "promise-4", rating: "positive", categories: [] }) });
    return [r.status, await r.json()];
  }, VERSE);
  assert.deepEqual(dup, [409, { error: "already_submitted" }]);
  assert.deepEqual(errors, []);
  await ctx.close();
}

async function errorFlow(browser, kind, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(`${FAIL_BASE}/verses/${VERSE}.html`);
  const box = page.locator(".fb");
  await box.getByRole("button", { name: "Not really" }).click();
  await box.getByText("The explanation is confusing").click();
  await box.getByRole("button", { name: "Send feedback" }).click();
  await box.locator(".fb-status.is-error").waitFor();
  assert.match(await box.locator(".fb-status").textContent(), /couldn’t be sent/);
  assert.equal(await box.getByRole("button", { name: "Send feedback" }).isEnabled(), true, "can retry");
  assert.equal(await box.locator('input[name="fb-cat"]:checked').count(), 1, "selections kept");
  await shot(page, page.locator(".catalog-verse"), `${kind}-verse-6-error`);
  await ctx.close();
}

async function cardFlow(browser, kind, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  const card = page.locator(".deck-card").first();
  await card.locator(".card-explain:not(.is-loading) .fb-choice").first().waitFor({ timeout: 15000 });
  const id = await card.getAttribute("data-id");
  const pos = await page.locator(".reading-position").textContent();
  await shot(page, card, `${kind}-card-1-collapsed`);
  await card.getByRole("button", { name: "Not really" }).click();
  assert.equal(await card.locator('input[name="fb-cat"]').count(), 8);
  await card.getByText("Doesn’t explain how to apply the verse").click();
  await card.getByText("Too long or repetitive").click();
  // Typing arrows in the comment must not flip cards; taps in the widget must not swipe.
  const ta = card.locator(".fb-comment");
  await ta.click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator(".reading-position").textContent(), pos);
  await shot(page, card, `${kind}-card-2-no-expanded`);
  await card.getByRole("button", { name: "Yes, helpful" }).click();
  assert.equal(await card.locator('input[name="fb-cat"]').count(), 5);
  await shot(page, card, `${kind}-card-3-yes-expanded`);
  // Submit with no categories and no comment.
  await card.getByRole("button", { name: "Send feedback" }).click();
  await card.locator(".fb-done").waitFor();
  assert.equal(await page.locator(".reading-position").textContent(), pos, "still on the same card");
  await shot(page, card, `${kind}-card-4-thank-you`);
  // Another card has a fresh widget; coming back shows "already shared" (re-rendered card).
  const fwd = (await page.locator(".reading-nav--next").isEnabled()) ? ".reading-nav--next" : ".reading-nav--prev";
  const rev = fwd === ".reading-nav--next" ? ".reading-nav--prev" : ".reading-nav--next";
  await page.locator(fwd).click();
  await page.waitForTimeout(600);
  const next = page.locator(".deck-card:not(.is-leaving)").first();
  assert.notEqual(await next.getAttribute("data-id"), id);
  assert.equal(await next.locator(".fb-choice").count(), 2);
  await page.locator(rev).click();
  await page.waitForTimeout(600);
  const back = page.locator(".deck-card:not(.is-leaving)").first();
  assert.equal(await back.getAttribute("data-id"), id);
  assert.match(await back.locator(".fb-done").textContent(), /already shared feedback/);
  // Existing card features still work: favorite button and explanation text present.
  assert.ok((await back.locator(".card-explain-text").textContent()).length > 20);
  assert.equal(await back.locator(".favorite-btn").count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
}

async function signedInFlow(browser) {
  const ctx = await browser.newContext(VIEWPORTS.desktop);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.evaluate(() => window.GodsPromisesAuth.signUp({ email: "fb-e2e@example.invalid", password: "correct horse 1", displayName: "E2E" }));
  await page.reload();
  const userId = await page.evaluate(() => window.GodsPromisesAuth.getCurrentUser().id);
  const card = page.locator(".deck-card").first();
  await card.locator(".card-explain:not(.is-loading) .fb-choice").first().waitFor({ timeout: 15000 });
  const posted = page.waitForRequest((r) => r.url().endsWith("/api/feedback") && r.method() === "POST");
  await card.getByRole("button", { name: "Yes, helpful" }).click();
  await card.getByText("Practical and applicable to my daily life").click();
  await card.getByRole("button", { name: "Send feedback" }).click();
  const body = JSON.parse((await posted).postData());
  assert.equal(body.localUserId, userId, "signed-in local profile id is attached (unverified)");
  assert.deepEqual(body.categories, ["practical"]);
  await card.locator(".fb-done").waitFor();
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [kind, opts] of Object.entries(VIEWPORTS)) {
      await verseFlow(browser, kind, opts);
      await errorFlow(browser, kind, opts);
      await cardFlow(browser, kind, opts);
      // Each viewport run is a new browser context = new anonymous submitter.
    }
    await signedInFlow(browser);
  } finally {
    await browser.close();
  }
  console.log("feedback e2e: all states pass; screenshots in " + OUT);
})().catch((e) => { console.error(e); process.exit(1); });
