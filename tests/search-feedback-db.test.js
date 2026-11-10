/* Search-feedback migration on a throwaway in-memory Postgres.
 * Inserts through the same handler the site uses, then checks the row and
 * that anon/authenticated cannot read or write. Does not touch production.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const core = require('../api/_lib/feedback-core');

const ROOT = path.resolve(__dirname, '..');
function sql(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('\\'))
    .join('\n');
}

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b || ''; },
    json() { return JSON.parse(this.body); },
  };
}

(async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  for (const file of [
    'tests/sql/local_prelude.sql',
    'supabase/migrations/20261109120000_explanation_feedback.sql',
    'supabase/migrations/20261110223000_search_feedback.sql',
  ]) {
    await db.exec(sql(file));
  }

  async function rpc(fn, args) {
    assert.equal(fn, 'hpd_feedback_search_submit');
    const out = await db.query(
      `select public.hpd_feedback_search_submit(
         $1, $2, $3, $4::text[], $5::text[], $6, $7, $8, $9, $10, $11::uuid
       ) as result`,
      [
        args.p_query, args.p_intent, args.p_category, args.p_result_ids, args.p_result_refs,
        args.p_helpful, args.p_reason, args.p_comment, args.p_submitter_key, args.p_ip_key,
        args.p_auth_user_id,
      ]
    );
    return out.rows[0].result;
  }

  const env = {
    SUPABASE_URL: 'https://example-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test_only_not_a_real_key_0000',
    FEEDBACK_HASH_SECRET: 'y'.repeat(40),
  };
  const handler = core.createHandler({ env, rpc, log: () => {}, catalog: core.loadCatalog(ROOT) });
  const body = {
    kind: 'search',
    query: 'I wish I was rich',
    intent: 'wealth/desire',
    category: 'Financial prosperity and stewardship',
    resultIds: ['disc-deu-8-18', 'pro-10-22', '1ch-29-11-12'],
    resultRefs: ['Deuteronomy 8:17–18', 'Proverbs 10:22', '1 Chronicles 29:11–12'],
    helpful: false,
    reason: 'missing_scripture',
    comment: 'wanted a warning first',
    website: '',
  };
  const req = {
    method: 'POST',
    url: '/api/feedback',
    headers: {
      host: 'hispromisedaily.com',
      origin: 'https://hispromisedaily.com',
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.50',
      'sec-fetch-site': 'same-origin',
    },
    body,
  };
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 201, res.body);

  const stored = await db.query('select query_text, intent, category, result_ids, result_refs, helpful, reason, comment, submitter_key, ip_key, auth_user_id, created_at from hpd_feedback.search_feedback');
  assert.equal(stored.rows.length, 1);
  const row = stored.rows[0];
  assert.equal(row.query_text, 'I wish I was rich');
  assert.equal(row.intent, 'wealth/desire');
  assert.equal(row.category, 'Financial prosperity and stewardship');
  assert.deepEqual(row.result_ids, body.resultIds);
  assert.deepEqual(row.result_refs, body.resultRefs);
  assert.equal(row.helpful, false);
  assert.equal(row.reason, 'missing_scripture');
  assert.equal(row.comment, 'wanted a warning first');
  assert.match(row.submitter_key, /^[0-9a-f]{64}$/);
  assert.match(row.ip_key, /^[0-9a-f]{64}$/);
  assert.equal(row.auth_user_id, null);
  assert.ok(row.created_at);

  const rls = await db.query(`select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'hpd_feedback' and c.relname = 'search_feedback'`);
  assert.equal(rls.rows[0].relrowsecurity, true);

  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    let readDenied = false;
    try { await db.query('select * from hpd_feedback.search_feedback'); }
    catch (err) { readDenied = true; }
    assert.equal(readDenied, true, role + ' read');
    let writeDenied = false;
    try {
      await db.query(`insert into hpd_feedback.search_feedback (query_text, intent, category, result_ids, result_refs, helpful, submitter_key, ip_key) values ('x','y','z',array['pro-10-22'],array['Proverbs 10:22'],true, repeat('a',64), repeat('b',64))`);
    } catch (err) { writeDenied = true; }
    assert.equal(writeDenied, true, role + ' write');
    let execDenied = false;
    try {
      await db.query(`select public.hpd_feedback_search_submit('q','wealth/desire','Money',array['pro-10-22'],array['Proverbs 10:22'],true,null,null,repeat('a',64),repeat('b',64),null)`);
    } catch (err) { execDenied = true; }
    assert.equal(execDenied, true, role + ' execute');
    await db.exec('reset role');
  }

  const still = await db.query('select count(*)::int as n from hpd_feedback.search_feedback');
  assert.equal(still.rows[0].n, 1);

  // Same submitter, burst past the 15-in-10-minutes cap. The first row is already stored.
  const key = row.submitter_key;
  const ip = row.ip_key;
  for (let i = 0; i < 14; i++) {
    const extra = await db.query(
      `select public.hpd_feedback_search_submit($1,'wealth/desire','Money',array['pro-10-22'],array['Proverbs 10:22'],true,null,null,$2,$3,null) as result`,
      ['rate ' + i, key, ip]
    );
    assert.equal(extra.rows[0].result.status, 'created', 'fill ' + i);
  }
  const limited = await db.query(
    `select public.hpd_feedback_search_submit('too many','wealth/desire','Money',array['pro-10-22'],array['Proverbs 10:22'],true,null,null,$1,$2,null) as result`,
    [key, ip]
  );
  assert.equal(limited.rows[0].result.status, 'rate_limited');

  await db.close();
  console.log('search-feedback-db: row stored in order; anon and authenticated cannot read, write, or call the function; rate limit holds');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
