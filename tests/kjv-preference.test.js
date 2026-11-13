/* Signed-in Bible choice stays off the shared device key, and sign-out restores it. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function storage(initial) {
  const data = Object.assign({}, initial);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    key(i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; },
    snapshot() { return Object.assign({}, data); },
  };
}

(async function main() {
  const local = storage({ 'gods-promises-version': 'kjv' });
  const synced = [];
  let signedIn = null;
  const sandbox = {
    console,
    URL,
    TextEncoder,
    localStorage: local,
    fetch: undefined,
    GodsPromisesAuth: {
      getCurrentUser() { return signedIn; },
      syncBibleVersion(id) { synced.push(id); },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/bible-versions.js'), 'utf8'), context);
  const versions = context.GodsPromisesVersions;
  assert.equal(versions.getCurrentId(), 'kjv');

  versions.setCurrent('asv');
  assert.equal(local.getItem('gods-promises-version'), 'asv');
  assert.deepEqual(synced, []);

  signedIn = { id: 'account-a' };
  versions.setCurrent('kjv');
  assert.equal(local.getItem('gods-promises-version'), 'asv', 'signed-in choice must not replace the device key');
  assert.deepEqual(synced, ['kjv']);

  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/auth.js'), 'utf8'), context);
  const auth = context.GodsPromisesAuth;
  function decision(value) {
    const result = auth.decideBiblePreference(value);
    return { display: result.display, save: result.save };
  }
  assert.deepEqual(decision('kjv'), { display: 'kjv', save: false });
  assert.deepEqual(decision(null), { display: 'web', save: false });
  assert.deepEqual(decision(''), { display: 'web', save: false });

  await auth.signOut();
  assert.equal(versions.getCurrentId(), 'asv', 'sign-out restores the device value, not the account value');
  assert.equal(local.getItem('gods-promises-version'), 'asv');
  console.log('kjv-preference: device key stays isolated, empty profile is not overwritten, sign-out restores it');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
