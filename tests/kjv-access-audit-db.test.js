/* Unapplied KJV audit migration on a throwaway in-memory Postgres.
 * Does not connect to the live project.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

const ROOT = path.resolve(__dirname, '..');

function sql(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('\\'))
    .join('\n');
}

async function denied(db, statement) {
  try {
    await db.exec(statement);
    return false;
  } catch (err) {
    return true;
  }
}

(async function main() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(sql('tests/sql/local_prelude.sql'));
  await db.exec(sql('supabase/migrations/20261114103000_kjv_access_audit.sql'));

  const flags = await db.query(`
    select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'hpd_admin' and c.relname in ('kjv_access_config', 'kjv_access_audit')
    order by c.relname
  `);
  assert.equal(flags.rows.length, 2);
  for (const row of flags.rows) {
    assert.equal(row.relrowsecurity, true, row.relname + ' rls');
    assert.equal(row.relforcerowsecurity, true, row.relname + ' force');
  }

  const seed = await db.query(`select global_enabled, allowed_countries, changed_by, change_reason from hpd_admin.kjv_access_config`);
  assert.equal(seed.rows.length, 1);
  assert.equal(seed.rows[0].global_enabled, false);
  assert.deepEqual(seed.rows[0].allowed_countries, []);
  const seededAudit = await db.query(`select count(*)::int as n from hpd_admin.kjv_access_audit`);
  assert.equal(seededAudit.rows[0].n, 1);

  for (const role of ['anon', 'authenticated']) {
    await db.exec('set role ' + role);
    assert.equal(await denied(db, 'select * from hpd_admin.kjv_access_config'), true, role + ' read config');
    assert.equal(await denied(db, 'select * from hpd_admin.kjv_access_audit'), true, role + ' read audit');
    assert.equal(await denied(db, `update hpd_admin.kjv_access_config set global_enabled = true, changed_by = 'x', change_reason = 'no' where id = 1`), true, role + ' write');
    await db.exec('reset role');
  }

  await db.exec('set role service_role');
  assert.equal(await denied(db, `insert into hpd_admin.kjv_access_audit (actor_label, session_user_name, current_user_name, reason) values ('x','y','z','direct')`), true, 'direct audit insert');
  assert.equal(await denied(db, `update hpd_admin.kjv_access_audit set reason = 'changed'`), true, 'audit update');
  assert.equal(await denied(db, 'delete from hpd_admin.kjv_access_audit'), true, 'audit delete');
  assert.equal(await denied(db, 'truncate hpd_admin.kjv_access_audit'), true, 'audit truncate');
  assert.equal(await denied(db, `update hpd_admin.kjv_access_config set global_enabled = true, change_reason = null where id = 1`), true, 'missing reason');
  await db.exec(`update hpd_admin.kjv_access_config
    set global_enabled = true, allowed_countries = '{US}', changed_by = 'ada', change_reason = 'written permission for a test country'
    where id = 1`);
  await db.exec('reset role');

  const audit = await db.query(`
    select actor_label, reason, previous_config, new_config, created_at, session_user_name, current_user_name
    from hpd_admin.kjv_access_audit
    order by created_at
  `);
  assert.equal(audit.rows.length, 2);
  const row = audit.rows[1];
  assert.equal(row.actor_label, 'ada');
  assert.equal(row.reason, 'written permission for a test country');
  assert.equal(row.previous_config.global_enabled, false);
  assert.equal(row.new_config.global_enabled, true);
  assert.deepEqual(row.new_config.allowed_countries, ['US']);
  assert.ok(row.created_at);
  assert.ok(row.session_user_name);
  assert.ok(row.current_user_name);
  const config = await db.query('select global_enabled, allowed_countries from hpd_admin.kjv_access_config');
  assert.equal(config.rows[0].global_enabled, true);
  assert.deepEqual(config.rows[0].allowed_countries, ['US']);

  await db.close();
  console.log('kjv-access-audit-db: force RLS; anon and authenticated cannot read or write; service_role cannot change the audit log; a config update records previous, new, identity, reason, and time');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
