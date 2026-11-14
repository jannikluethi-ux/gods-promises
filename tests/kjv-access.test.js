/* Two-condition gate: global off and an empty allowlist deny everyone. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('os');
const path = require('path');
const { kjvDecision, authorizeKjv, RESTRICTED, UNAVAILABLE } = require('../api/_lib/kjv-access');

const SNIPPET = 'Be careful for nothing; gate test.';
const spansPath = path.join(os.tmpdir(), 'hpd-kjv-gate-spans.json');
fs.writeFileSync(spansPath, JSON.stringify({ passages: { 'php-4-6-7': SNIPPET } }));
process.env.KJV_SPANS_PATH = spansPath;
delete process.env.KJV_GLOBAL_ENABLED;
delete process.env.KJV_ALLOWED_COUNTRIES;
delete process.env.KJV_ENABLE_RESTRICTED;
delete process.env.KJV_RESTRICTED_COUNTRIES;
delete require.cache[require.resolve('../api/kjv')];
const kjv = require('../api/kjv');

const ON = { KJV_GLOBAL_ENABLED: 'true', KJV_ALLOWED_COUNTRIES: 'US' };

function call(headers, ids, rawUrl) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 0,
      headers: {},
      body: '',
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      end(payload) { this.body = payload; resolve(this); },
    };
    const url = rawUrl || ('/api/kjv' + (ids ? '?ids=' + encodeURIComponent(ids) : ''));
    kjv({ headers: headers || {}, url: url }, res);
  });
}

function assertDenied(body, label) {
  const parsed = JSON.parse(body);
  assert.equal(parsed.allowed, false, label);
  assert.equal(parsed.offline, false, label);
  assert.equal(parsed.message, UNAVAILABLE, label);
  assert.equal(parsed.passages, undefined, label);
  assert.equal(body.includes(SNIPPET), false, label);
  assert.equal(body.includes('KJV_GLOBAL'), false, label);
  assert.equal(body.includes('allowlist'), false, label);
  assert.deepEqual(Object.keys(parsed).sort(), ['allowed', 'message', 'offline'], label);
}

function assertPrivate(res) {
  assert.equal(res.headers['cache-control'], 'private, no-store');
  assert.equal(res.headers['cdn-cache-control'], 'no-store');
  assert.equal(res.headers['vercel-cdn-cache-control'], 'no-store');
  assert.equal(res.headers.vary, 'x-vercel-ip-country');
  assert.equal(res.headers.pragma, 'no-cache');
}

(async function main() {
  assert.deepEqual(RESTRICTED, ['GB', 'GG', 'JE', 'IM']);

  for (const code of ['US', 'CA', 'AU', 'DE', 'FR', 'GB', 'UK', 'ENG']) {
    const decision = kjvDecision(code, {});
    assert.equal(decision.allowed, false, 'global off ' + code);
    assert.equal(decision.reason, 'global_off', code);
  }

  const openUs = kjvDecision('us', ON);
  assert.equal(openUs.allowed, true);
  assert.equal(openUs.offline, false);

  for (const code of ['GB', 'gb', 'UK', 'uk', 'ENG', 'SCT', 'WLS', 'NIR', 'GG', 'JE', 'IM']) {
    const decision = kjvDecision(code, Object.assign({}, ON, { KJV_ALLOWED_COUNTRIES: 'US,GB,GG,JE,IM,UK' }));
    assert.equal(decision.allowed, false, code);
    assert.equal(decision.reason, 'restricted', code);
  }

  const cambridgeOff = kjvDecision('GB', {
    KJV_GLOBAL_ENABLED: 'false',
    KJV_ENABLE_RESTRICTED: 'true',
    KJV_ALLOWED_COUNTRIES: 'GB',
  });
  assert.equal(cambridgeOff.allowed, false);
  assert.equal(cambridgeOff.reason, 'global_off');

  const cambridgeOn = kjvDecision('GB', {
    KJV_GLOBAL_ENABLED: 'true',
    KJV_ENABLE_RESTRICTED: 'true',
    KJV_ALLOWED_COUNTRIES: 'GB',
  });
  assert.equal(cambridgeOn.allowed, true, 'written-permission path still needs global on and the allowlist');

  const restrictedNotListed = kjvDecision('GB', {
    KJV_GLOBAL_ENABLED: 'true',
    KJV_ENABLE_RESTRICTED: 'true',
    KJV_ALLOWED_COUNTRIES: 'US',
  });
  assert.equal(restrictedNotListed.allowed, false);

  for (const bad of ['', '   ', null, undefined, 'XX', 'xx', 'T1', 'UNKNOWN', 'GBR', 'G B', '??']) {
    const decision = kjvDecision(bad, ON);
    assert.equal(decision.allowed, false, String(bad));
    assert.notEqual(decision.reason, 'allowlisted');
  }
  assert.equal(kjvDecision({ toString() { throw new Error('lookup'); } }, ON).reason, 'lookup_error');

  const forged = authorizeKjv({
    headers: { 'x-country': 'US', 'cf-ipcountry': 'US' },
    url: '/api/kjv?country=US&ids=php-4-6-7',
  }, ON);
  assert.equal(forged.allowed, false, 'client headers are not a country');
  const vercelWins = authorizeKjv({
    headers: { 'x-vercel-ip-country': 'GB', 'x-country': 'US', 'cf-ipcountry': 'US' },
    url: '/api/kjv?country=US',
  }, Object.assign({}, ON, { KJV_ALLOWED_COUNTRIES: 'US,GB' }));
  assert.equal(vercelWins.allowed, false);
  assert.equal(vercelWins.reason, 'restricted');

  delete process.env.KJV_GLOBAL_ENABLED;
  delete process.env.KJV_ALLOWED_COUNTRIES;
  for (const code of ['US', 'GB', 'XX']) {
    const res = await call({ 'x-vercel-ip-country': code }, 'php-4-6-7');
    assertPrivate(res);
    assertDenied(res.body, 'default ' + code);
  }
  const forgedHttp = await call({ 'x-country': 'US', 'cf-ipcountry': 'US' }, 'php-4-6-7');
  assertDenied(forgedHttp.body, 'forged');

  process.env.KJV_GLOBAL_ENABLED = 'true';
  process.env.KJV_ALLOWED_COUNTRIES = 'US';
  const allowed = await call({ 'x-vercel-ip-country': 'US' }, 'php-4-6-7');
  assertPrivate(allowed);
  const allowedBody = JSON.parse(allowed.body);
  assert.equal(allowedBody.allowed, true);
  assert.equal(allowedBody.offline, false);
  assert.equal(allowedBody.passages['php-4-6-7'], SNIPPET);
  const status = await call({ 'x-vercel-ip-country': 'US' });
  assert.equal(JSON.parse(status.body).passages, undefined);
  assert.equal(JSON.parse(status.body).allowed, true);

  for (const code of ['GB', 'JE', 'GG', 'IM', 'UK', 'ENG']) {
    const res = await call({ 'x-vercel-ip-country': code }, 'php-4-6-7');
    assertPrivate(res);
    assertDenied(res.body, 'on but restricted ' + code);
  }
  const missing = await call({}, 'php-4-6-7');
  assertDenied(missing.body, 'missing header');
  const malformed = await call({ 'x-vercel-ip-country': 'GBR' }, 'php-4-6-7');
  assertDenied(malformed.body, 'malformed');

  process.env.KJV_GLOBAL_ENABLED = 'false';
  const switchedOff = await call({ 'x-vercel-ip-country': 'US' }, 'php-4-6-7');
  assertDenied(switchedOff.body, 'global off after an allow');

  process.env.KJV_GLOBAL_ENABLED = 'true';
  process.env.KJV_SPANS_PATH = path.join(os.tmpdir(), 'missing-kjv-spans.json');
  const broken = await call({ 'x-vercel-ip-country': 'US' }, 'php-4-6-7');
  assert.equal(broken.statusCode, 503);
  assertDenied(broken.body, 'missing file');

  process.env.KJV_SPANS_PATH = spansPath;
  for (const bad of ['TRUE', ' true ', 'True', '1', 'yes', 'true\u200b']) {
    const decision = kjvDecision('US', { KJV_GLOBAL_ENABLED: bad, KJV_ALLOWED_COUNTRIES: 'US' });
    assert.equal(decision.allowed, false, bad);
    assert.equal(decision.reason, 'config_invalid', bad);
  }
  const restrictedFlag = kjvDecision('GB', {
    KJV_GLOBAL_ENABLED: 'true',
    KJV_ENABLE_RESTRICTED: 'TRUE',
    KJV_ALLOWED_COUNTRIES: 'GB',
  });
  assert.equal(restrictedFlag.reason, 'config_invalid');
  const spaced = kjvDecision('ca', { KJV_GLOBAL_ENABLED: 'true', KJV_ALLOWED_COUNTRIES: ' us , ca ' });
  assert.equal(spaced.allowed, true, 'spaces and lowercase codes are accepted');
  const badList = kjvDecision('US', { KJV_GLOBAL_ENABLED: 'true', KJV_ALLOWED_COUNTRIES: 'US,CAN' });
  assert.equal(badList.reason, 'config_invalid');
  const emptyToken = kjvDecision('US', { KJV_GLOBAL_ENABLED: 'true', KJV_ALLOWED_COUNTRIES: 'US,,CA' });
  assert.equal(emptyToken.reason, 'config_invalid');
  const stillUnknown = kjvDecision('XX', { KJV_GLOBAL_ENABLED: 'TRUE', KJV_ALLOWED_COUNTRIES: 'US' });
  assert.equal(stillUnknown.reason, 'unknown_country');

  process.env.KJV_GLOBAL_ENABLED = 'TRUE';
  process.env.KJV_ALLOWED_COUNTRIES = 'US';
  const publicInvalid = await call({ 'x-vercel-ip-country': 'US' }, 'php-4-6-7');
  assertPrivate(publicInvalid);
  assertDenied(publicInvalid.body, 'malformed flag stays private');
  assert.equal(publicInvalid.body.includes('config_invalid'), false);

  process.env.KJV_GLOBAL_ENABLED = 'true';
  const tooMany = Array.from({ length: 25 }, function (_, i) { return 'php-4-6-' + (i + 1); }).join(',');
  const oversized = await call({ 'x-vercel-ip-country': 'US' }, null, '/api/kjv?ids=' + tooMany);
  assert.equal(oversized.statusCode, 400);
  assertPrivate(oversized);
  assertDenied(oversized.body, '25 ids');
  const tooLong = await call({ 'x-vercel-ip-country': 'US' }, null, '/api/kjv?ids=' + 'a'.repeat(1100));
  assert.equal(tooLong.statusCode, 400);
  assertDenied(tooLong.body, 'long ids');
  const badId = await call({ 'x-vercel-ip-country': 'US' }, null, '/api/kjv?ids=php-4-6-7,NOT');
  assert.equal(badId.statusCode, 400);
  assertDenied(badId.body, 'bad id');
  const twentyFour = Array.from({ length: 24 }, function () { return 'php-4-6-7'; }).join(',');
  const capped = await call({ 'x-vercel-ip-country': 'US' }, null, '/api/kjv?ids=' + twentyFour);
  assert.equal(capped.statusCode, 200);
  assert.equal(JSON.parse(capped.body).passages['php-4-6-7'], SNIPPET);
  const brokenUrl = await call({}, null, 'http://[');
  assert.equal(brokenUrl.statusCode, 400);
  assertPrivate(brokenUrl);
  assertDenied(brokenUrl.body, 'malformed url');

  delete process.env.KJV_GLOBAL_ENABLED;
  delete process.env.KJV_ALLOWED_COUNTRIES;
  delete process.env.KJV_ENABLE_RESTRICTED;
  console.log('kjv-access: global off denies everyone; restricted territories stay blocked; forged headers are ignored');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
