/* Server gate: allowlist only, fail closed, and no verse text when KJV is refused. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('os');
const path = require('path');
const { kjvDecision, DEFAULT_ALLOWED, RESTRICTED, UNAVAILABLE } = require('../api/_lib/kjv-access');

const SNIPPET = 'Be careful for nothing; gate test.';
const spansPath = path.join(os.tmpdir(), 'hpd-kjv-gate-spans.json');
fs.writeFileSync(spansPath, JSON.stringify({ passages: { 'php-4-6-7': SNIPPET } }));
process.env.KJV_SPANS_PATH = spansPath;
delete require.cache[require.resolve('../api/kjv')];
const kjv = require('../api/kjv');

function call(country, ids) {
  return new Promise((resolve) => {
    const headers = {};
    if (country !== undefined) headers['x-vercel-ip-country'] = country;
    const res = {
      statusCode: 0,
      headers: {},
      body: '',
      setHeader(name, value) { this.headers[name] = value; },
      end(payload) { this.body = payload; resolve(this); },
    };
    const url = '/api/kjv' + (ids ? '?ids=' + ids : '');
    kjv({ headers, url }, res);
  });
}

(async function main() {
  assert.deepEqual(DEFAULT_ALLOWED, ['US', 'CA', 'AU', 'DE']);
  assert.deepEqual(RESTRICTED, ['GB', 'GG', 'JE', 'IM']);
  for (const code of ['US', 'CA', 'AU', 'DE']) {
    const decision = kjvDecision(code, {});
    assert.equal(decision.allowed, true, code);
    assert.equal(decision.offline, true, code);
  }
  for (const code of ['GB', 'gb', 'GG', 'JE', 'IM', '', 'XX', 'unknown', 'FR', null]) {
    const decision = kjvDecision(code, {});
    assert.equal(decision.allowed, false, String(code));
    assert.equal(decision.offline, false, String(code));
  }
  const unlocked = kjvDecision('GB', { KJV_ENABLE_RESTRICTED: 'true', KJV_ALLOWED_COUNTRIES: 'GB' });
  assert.equal(unlocked.allowed, true);
  const stillBlocked = kjvDecision('GB', { KJV_ENABLE_RESTRICTED: 'true' });
  assert.equal(stillBlocked.allowed, false, 'restricted stays off unless it is also allowlisted');

  for (const code of ['US', 'CA', 'AU', 'DE']) {
    const res = await call(code, 'php-4-6-7');
    const body = JSON.parse(res.body);
    assert.equal(res.headers['cache-control'], 'private, no-store');
    assert.equal(body.allowed, true, code);
    assert.equal(body.offline, true, code);
    assert.equal(body.passages['php-4-6-7'], SNIPPET);
  }
  for (const code of ['GB', 'GG', 'JE', 'IM', 'XX', 'unknown', 'FR']) {
    const res = await call(code, 'php-4-6-7');
    assert.equal(res.body.includes(SNIPPET), false, code);
    assert.equal(res.body.includes('passages'), false, code);
    assert.equal(JSON.parse(res.body).offline, false, code);
    assert.equal(JSON.parse(res.body).message, UNAVAILABLE);
  }
  for (const missing of [undefined, '', '   ']) {
    const res = await call(missing, 'php-4-6-7');
    assert.equal(res.body.includes(SNIPPET), false, 'missing header');
    assert.equal(JSON.parse(res.body).allowed, false);
  }
  const lookup = await call({ toString() { throw new Error('lookup'); } }, 'php-4-6-7');
  assert.equal(lookup.body.includes(SNIPPET), false, 'lookup failure');
  assert.equal(JSON.parse(lookup.body).allowed, false);
  const status = await call('US');
  assert.equal(JSON.parse(status.body).passages, undefined);
  process.env.KJV_SPANS_PATH = path.join(os.tmpdir(), 'missing-kjv-spans.json');
  const broken = await call('US', 'php-4-6-7');
  assert.equal(broken.statusCode, 503);
  assert.equal(broken.body.includes(SNIPPET), false);
  assert.equal(JSON.parse(broken.body).allowed, false);
  console.log('kjv-access: allowlist US/CA/AU/DE; GB/GG/JE/IM, unknown, XX, and a missing file return no KJV text');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
