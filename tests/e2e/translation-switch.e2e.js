/* Headless check: search results change translation with the version selector.
 *   NODE_PATH=/tmp/pw/node_modules node tests/e2e/translation-switch.e2e.js
 * Uses the system Chrome. bible-api.com is stubbed. No production deploy.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8766);
const OUT = process.env.SHOT_DIR || '/tmp/translation-switch-e2e';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') pathname = '/index.html';
      const file = path.normalize(path.join(ROOT, pathname));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function okBody(url) {
  const parsed = new URL(String(url));
  const parts = parsed.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  if (parts[0] === 'data') {
    const translation = parts[1];
    const chapter = Number(parts[3]);
    const verses = [];
    for (let n = 1; n <= 176; n++) verses.push({ chapter, verse: n, text: translation.toUpperCase() + ' v' + n });
    return { translation_id: translation, translation: { identifier: translation }, verses };
  }
  const translation = parsed.searchParams.get('translation') || '';
  const reference = decodeURIComponent(parsed.pathname.replace(/^\//, '')).replace(/\+/g, ' ');
  return { text: translation.toUpperCase() + ' [[' + reference + ']]', translation_id: translation, reference };
}

function readState() {
  const label = document.querySelector('#version-meta-label');
  const cards = [...document.querySelectorAll('#results .card')].map(card => ({
    id: card.getAttribute('data-id'),
    ref: (card.querySelector('.card-ref') || {}).textContent || '',
    text: (card.querySelector('.card-text') || {}).textContent || '',
    explain: (card.querySelector('.card-explain-text') || {}).textContent || '',
    why: (card.closest('.discovery-item') || { querySelector: () => null }).querySelector
      ? ((card.parentElement && card.parentElement.querySelector('.discovery-why')) || {}).textContent || ''
      : '',
    busy: (card.querySelector('.card-text') || {}).getAttribute
      ? card.querySelector('.card-text').getAttribute('aria-busy')
      : null,
  }));
  const feedback = document.querySelector('#results .search-feedback');
  return {
    label: label ? label.textContent : '',
    discovery: !!document.querySelector('#results [data-discovery]'),
    feedback: feedback ? feedback.getAttribute('data-results') : '',
    feedbackButtons: feedback ? feedback.querySelectorAll('button').length : 0,
    cards,
  };
}

function pendingText(code) {
  return text => text === 'Loading ' + code + '…' || text === code + ' will load when this passage is on screen.';
}
async function settleTranslation(page, version) {
  const ids = await page.$$eval('#results .card', nodes => nodes.map(node => node.getAttribute('data-id')));
  for (const id of ids) {
    await page.evaluate(cardId => {
      const card = document.querySelector('#results .card[data-id="' + cardId + '"]');
      if (card) card.scrollIntoView({ block: 'center' });
    }, id);
    try {
      await page.waitForFunction((cardId, versionId) => {
        const node = document.querySelector('#results .card[data-id="' + cardId + '"] .card-text');
        if (!node) return false;
        const text = node.textContent;
        if (versionId === 'dra' && cardId === 'psa-23-1-4') return text.indexOf('numbers the Psalms differently') !== -1;
        const marker = (versionId === 'darby' ? 'DARBY' : versionId.toUpperCase()) + ' [[';
        return text.indexOf(marker) === 0;
      }, { timeout: 4000 }, id, version);
    } catch (error) {
      const snapshot = await page.evaluate(readState);
      console.log('stuck', id, version, JSON.stringify(snapshot.cards.map(card => ({ id: card.id, text: card.text })), null, 2));
      throw error;
    }
  }
}

async function runViewport(browser, name, viewport, mode) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(() => {
    window.GODS_PROMISES_REQUEST_LIMIT = 100;
  });
  const calls = [];
  const waiters = [];
  let gate = false;
  let fail = false;
  await page.setRequestInterception(true);
  page.on('request', async req => {
    const url = req.url();
    try {
      if (url.includes('bible-api.com')) {
        calls.push(url);
        if (gate) await new Promise(resolve => waiters.push(resolve));
        const headers = {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        };
        if (fail) {
          await req.respond({
            status: 200,
            headers,
            contentType: 'application/json',
            body: JSON.stringify({ text: 'WEB LEAK', translation_id: 'web', reference: 'John 1:1' }),
          });
          return;
        }
        await req.respond({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify(okBody(url)),
        });
        return;
      }
      if (/sw\.js|fonts\.googleapis|fonts\.gstatic|vercel|google-analytics/.test(url)) {
        await req.abort();
        return;
      }
      await req.continue();
    } catch (error) {
      // The page may already have moved on.
      try { await req.abort(); } catch (ignore) { /* closed */ }
    }
  });

  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#search');
  await page.click('#filters-toggle');
  const options = await page.$$eval('#version-filter option', nodes => nodes.map(node => node.value));
  assert.deepEqual(options, ['web', 'asv', 'darby', 'dra'], name + ' versions');
  await page.type('#search', 'I feel anxious');
  await page.click('#search-submit');
  await page.waitForSelector('#results [data-discovery] .card-text');
  await page.waitForFunction(() => {
    const node = document.querySelector('#results .card-explain-text');
    return node && node.textContent.length > 20;
  });
  const before = await page.evaluate(readState);
  assert.equal(before.discovery, true, name);
  assert.equal(before.cards.length, 6, name);
  assert.match(before.label, /WEB/);
  assert.ok(before.cards.some(card => card.id === 'psa-23-1-4'), name);
  assert.ok(before.feedbackButtons >= 2, name);
  const explains = before.cards.map(card => card.explain);
  assert.ok(explains.every(text => text.length > 20), name + ' explanations');
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name + '-web.png') });

  if (mode === 'fail') {
    gate = true;
    fail = true;
    await page.select('#version-filter', 'asv');
    const broken = await page.evaluate(readState);
    assert.match(broken.label, /ASV/);
    broken.cards.forEach(card => {
      assert.equal(pendingText('ASV')(card.text), true, name + ' ' + card.id + ' ' + card.text);
      assert.equal(card.text === before.cards.find(row => row.id === card.id).text, false);
    });
    gate = false;
    waiters.splice(0).forEach(release => release());
    const failedIds = await page.$$eval('#results .card', nodes => nodes.map(node => node.getAttribute('data-id')));
    for (const id of failedIds) {
      await page.evaluate(cardId => {
        const card = document.querySelector('#results .card[data-id="' + cardId + '"]');
        if (card) card.scrollIntoView({ block: 'center' });
      }, id);
      await page.waitForFunction(cardId => {
        const node = document.querySelector('#results .card[data-id="' + cardId + '"] .card-text');
        return node && /couldn't load/.test(node.textContent);
      }, { timeout: 4000 }, id);
    }
    const afterFail = await page.evaluate(readState);
    afterFail.cards.forEach(card => {
      assert.match(card.text, /ASV text couldn't load right now/);
      assert.equal(card.text.includes('WEB LEAK'), false);
      assert.equal(card.explain, explains[before.cards.findIndex(row => row.id === card.id)]);
    });
    assert.match(afterFail.label, /ASV/);
    assert.equal(afterFail.feedback, before.feedback);
    await page.screenshot({ path: path.join(OUT, name + '-mismatch.png') });
    fail = false;
    await page.select('#version-filter', 'web');
    const restored = await page.evaluate(readState);
    restored.cards.forEach(card => {
      const original = before.cards.find(row => row.id === card.id);
      assert.equal(card.text, original.text, name + ' restored ' + card.id);
    });
    assert.match(restored.label, /WEB/);
    await page.close();
    return;
  }

  gate = true;
  await page.select('#version-filter', 'asv');
  const loading = await page.evaluate(readState);
  assert.match(loading.label, /ASV/);
  loading.cards.forEach(card => {
    assert.equal(pendingText('ASV')(card.text), true, name + ' loading ' + card.id + ' ' + card.text);
    assert.equal(card.explain, explains[before.cards.findIndex(row => row.id === card.id)]);
  });
  assert.equal(loading.feedback, before.feedback);
  assert.deepEqual(loading.cards.map(card => card.id), before.cards.map(card => card.id));
  await page.screenshot({ path: path.join(OUT, name + '-loading-asv.png') });
  gate = false;
  waiters.splice(0).forEach(release => release());
  await settleTranslation(page, 'asv');
  const asv = await page.evaluate(readState);
  asv.cards.forEach(card => {
    assert.match(card.text, /^ASV \[\[/, card.id);
    assert.equal(card.explain, explains[before.cards.findIndex(row => row.id === card.id)]);
  });
  assert.match(asv.label, /ASV/);
  await page.screenshot({ path: path.join(OUT, name + '-asv.png') });

  await page.select('#version-filter', 'darby');
  await settleTranslation(page, 'darby');
  const darby = await page.evaluate(readState);
  darby.cards.forEach(card => assert.match(card.text, /^DARBY \[\[/, name + ' ' + card.id));
  assert.match(darby.label, /DBY/);
  await page.screenshot({ path: path.join(OUT, name + '-darby.png') });

  const callsBeforeDra = calls.length;
  await page.select('#version-filter', 'dra');
  await settleTranslation(page, 'dra');
  const dra = await page.evaluate(readState);
  dra.cards.forEach(card => {
    if (card.id === 'psa-23-1-4') assert.match(card.text, /numbers the Psalms differently/);
    else assert.match(card.text, /^DRA \[\[/, card.id);
    assert.equal(card.explain, explains[before.cards.findIndex(row => row.id === card.id)]);
  });
  assert.match(dra.label, /DRA/);
  assert.equal(dra.feedback, before.feedback);
  assert.equal(calls.slice(callsBeforeDra).some(url => /psalm|\/PSA\//i.test(url)), false, name);
  await page.screenshot({ path: path.join(OUT, name + '-dra.png') });

  await page.select('#version-filter', 'web');
  const web = await page.evaluate(readState);
  web.cards.forEach(card => {
    const original = before.cards.find(row => row.id === card.id);
    assert.equal(card.text, original.text, name + ' back to WEB ' + card.id);
    assert.equal(card.explain, original.explain);
  });
  assert.match(web.label, /WEB/);
  assert.deepEqual(web.cards.map(card => card.id), before.cards.map(card => card.id));
  assert.equal(calls.some(url => /kjv|ylt/i.test(url)), false, name);
  await page.screenshot({ path: path.join(OUT, name + '-back-web.png') });
  await page.close();
}

(async () => {
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    await runViewport(browser, 'desktop', { width: 1280, height: 900, deviceScaleFactor: 1 }, 'ok');
    await runViewport(browser, 'mobile', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'ok');
    await runViewport(browser, 'desktop-mismatch', { width: 1280, height: 900, deviceScaleFactor: 1 }, 'fail');
    console.log('translation-switch e2e: desktop and mobile keep the label and the verse together, including loading, Douay-Rheims Psalms, and a mismatched response');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
