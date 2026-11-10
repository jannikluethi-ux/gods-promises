/* Account deletion API. No network. The browser cannot name the user id. */
'use strict';
const assert = require('node:assert/strict');
const { createHandler } = require('../api/_lib/account-core');

const ENV = {
  SUPABASE_URL: 'https://ixxeidpdgktzvcbucosq.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_only_not_a_real_key_0000',
};
const USER = '123e4567-e89b-42d3-a456-426614174000';
const HOST = 'hispromisedaily.com';

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b || ''; },
    json() { return JSON.parse(this.body); },
  };
}
function req(body, opts = {}) {
  const headers = Object.assign({
    host: HOST, origin: 'https://' + HOST, 'content-type': 'application/json',
    'x-forwarded-for': opts.ip || '203.0.113.8', 'sec-fetch-site': 'same-origin',
  }, opts.headers || {});
  if (opts.authorization) headers.authorization = opts.authorization;
  return { method: opts.method || 'POST', url: '/api/account', headers, body };
}
async function call(handler, request) {
  const res = mockRes();
  await handler(request, res);
  return res;
}

(async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith('/auth/v1/user')) {
      const jwt = (init.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (jwt === 'good-token-value-0123456789') return { ok: true, status: 200, json: async () => ({ id: USER, email: 'reader@example.invalid' }) };
      return { ok: false, status: 401, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const handler = createHandler({ env: ENV, fetch, log: () => {} });

  let res = await call(handler, req({ action: 'delete', confirmation: 'DELETE' }));
  assert.equal(res.statusCode, 401);

  res = await call(handler, req({ action: 'delete', confirmation: 'delete', userId: USER }, { authorization: 'Bearer good-token-value-0123456789' }));
  assert.equal(res.statusCode, 400, res.body);
  assert.equal(calls.length, 0, 'A bad confirmation must not call Auth');

  res = await call(handler, req({ action: 'delete', confirmation: 'DELETE', id: USER }, { authorization: 'Bearer good-token-value-0123456789' }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().field, 'id');

  res = await call(handler, req({ action: 'delete', confirmation: 'DELETE' }, { authorization: 'Bearer good-token-value-0123456789' }));
  assert.equal(res.statusCode, 200, res.body);
  assert.deepEqual(res.json(), { ok: true });
  assert.equal(calls[0].url, ENV.SUPABASE_URL + '/auth/v1/user');
  assert.equal(calls[0].init.headers.authorization, 'Bearer good-token-value-0123456789');
  assert.equal(calls[1].url, ENV.SUPABASE_URL + '/auth/v1/admin/users/' + USER);
  assert.equal(calls[1].init.method, 'DELETE');
  assert.equal(calls[1].init.headers.authorization, 'Bearer ' + ENV.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(calls[1].init.headers.apikey, ENV.SUPABASE_SERVICE_ROLE_KEY);
  assert.ok(!res.body.includes(ENV.SUPABASE_SERVICE_ROLE_KEY));
  assert.ok(!res.body.includes('reader@example.invalid'));

  res = await call(handler, req({ action: 'delete', confirmation: 'DELETE' }, {
    authorization: 'Bearer wrong-token-value-0123456789', ip: '203.0.113.9',
  }));
  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 3, 'A rejected token must not delete anyone');

  res = await call(handler, req({ action: 'delete', confirmation: 'DELETE' }, {
    headers: { origin: 'https://evil.example' }, authorization: 'Bearer good-token-value-0123456789', ip: '203.0.113.10',
  }));
  assert.equal(res.statusCode, 403);

  const closed = createHandler({ env: {}, fetch, log: () => {} });
  res = await call(closed, req({ action: 'delete', confirmation: 'DELETE' }, { authorization: 'Bearer good-token-value-0123456789' }));
  assert.equal(res.statusCode, 503);

  console.log('account-api: deletion requires a verified token, confirmation, and same origin');
})().catch(error => { console.error(error); process.exitCode = 1; });
