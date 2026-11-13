/* UK gate: self-hosted KJV stays off for GB and the Crown dependencies. */
'use strict';
const assert = require('node:assert/strict');
const { kjvAllowedForCountry, KJV_UK_ENABLED } = require('../api/_lib/kjv-access');
const bibleRegion = require('../api/bible-region');

function run(country) {
  return new Promise((resolve) => {
    const headers = {};
    if (country != null) headers['x-vercel-ip-country'] = country;
    const res = {
      statusCode: 0,
      headers: {},
      body: '',
      setHeader(name, value) { this.headers[name] = value; },
      end(payload) {
        this.body = payload;
        resolve(this);
      },
    };
    bibleRegion({ headers }, res);
  });
}

(async function main() {
  assert.equal(KJV_UK_ENABLED, false);
  for (const code of ['GB', 'gb', 'GG', 'JE', 'IM']) {
    assert.equal(kjvAllowedForCountry(code), false, code);
  }
  assert.equal(kjvAllowedForCountry('US'), true);
  assert.equal(kjvAllowedForCountry(''), true);
  assert.equal(kjvAllowedForCountry(null), true);
  assert.equal(kjvAllowedForCountry('GB', true), true, 'the single switch can enable the UK');

  const uk = await run('GB');
  assert.equal(uk.statusCode, 200);
  assert.equal(JSON.parse(uk.body).kjv, false);
  assert.equal(uk.headers['cache-control'], 'private, no-store');
  for (const code of ['GG', 'JE', 'IM']) {
    const blocked = await run(code);
    assert.equal(JSON.parse(blocked.body).kjv, false, code);
  }
  const us = await run('US');
  assert.equal(JSON.parse(us.body).kjv, true);
  const local = await run(null);
  assert.equal(JSON.parse(local.body).kjv, true);
  console.log('kjv-access: UK gate default off for GB, GG, JE, IM; other countries allowed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
