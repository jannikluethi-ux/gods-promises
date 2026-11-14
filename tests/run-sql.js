/**
 * Apply the Supabase migrations and the SQL policy checks to a disposable
 * in-memory Postgres (PGlite). This does not connect to the live project.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

const ROOT = path.resolve(__dirname, '..');

function sql(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8')
    .split(/\r?\n/)
    .filter(line => !line.startsWith('\\'))
    .join('\n');
}

(async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  const files = [
    'tests/sql/local_prelude.sql',
    'supabase/migrations/20261109120000_explanation_feedback.sql',
    'supabase/migrations/20261110153000_profiles_favorites_auth.sql',
    'supabase/migrations/20261110210000_daily_verse_email.sql',
    'supabase/migrations/20261110223000_search_feedback.sql',
    'supabase/migrations/20261114103000_kjv_access_audit.sql',
    'tests/sql/explanation_feedback_checks.sql',
    'tests/sql/profiles_favorites_rls.sql',
  ];
  for (const file of files) {
    const result = await db.exec(sql(file));
    const notices = Array.isArray(result) ? result : [result];
    const rows = notices.flatMap(item => item.rows || []);
    const passed = rows.map(row => Object.values(row)[0]).filter(value => typeof value === 'string' && /passed/i.test(value));
    console.log(file + (passed.length ? ': ' + passed.join('; ') : ': ok'));
  }
  await db.close();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
