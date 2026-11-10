/**
 * In-memory stand-in for the browser Supabase client.
 * Sessions live in the provided localStorage. Passwords stay in the `world`
 * object only, which is not browser storage. RLS is mirrored: a session can
 * read and write only its own profile and favorites, and cannot change
 * subscription or account-status columns.
 */
"use strict";

const SESSION_KEY = "sb-hpd-test-auth-token";
const PROTECTED = new Set([
  "id", "email", "account_status", "subscription_status", "subscription_expires_at",
  "subscription_canceled_at", "subscription_updated_at", "created_at",
]);

function createWorld(options = {}) {
  const world = {
    confirmEmailRequired: options.confirmEmail !== false,
    seq: 0,
    clock: 0,
    users: new Map(),
    profiles: new Map(),
    favorites: [],
    resets: [],
  };
  world.confirmEmail = function confirmEmail(email) {
    const record = world.users.get(String(email || "").trim().toLowerCase());
    if (!record) throw new Error("No such test user");
    record.user.email_confirmed_at = new Date().toISOString();
  };
  world.serverSetSubscription = function serverSetSubscription(id, status, expiresAt) {
    const profile = world.profiles.get(id);
    if (!profile) throw new Error("No such profile");
    profile.subscription_status = status;
    profile.subscription_expires_at = expiresAt || null;
    profile.subscription_updated_at = new Date().toISOString();
  };
  return world;
}

function readSession(storage) {
  try {
    const raw = storage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function writeSession(storage, session) {
  if (!session) storage.removeItem(SESSION_KEY);
  else storage.setItem(SESSION_KEY, JSON.stringify(session));
}

function nextId(world) {
  world.seq += 1;
  return `00000000-0000-4000-8000-${String(world.seq).padStart(12, "0")}`;
}

function publicSession(user) {
  return {
    access_token: "test-access-" + user.id,
    refresh_token: "test-refresh-" + user.id,
    token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at,
      user_metadata: { display_name: user.user_metadata.display_name || "" },
    },
  };
}

function install(context, world) {
  const storage = context.localStorage;
  context.supabase = {
    createClient(url, key) {
      if (!url || !key) throw new Error("missing supabase config");
      if (/service_role|sb_secret_/i.test(String(key))) throw new Error("secret key refused");
      const listeners = new Set();
      function emit(event, session) {
        Promise.resolve().then(() => {
          for (const cb of listeners) cb(event, session);
        });
      }
      const auth = {
        async signUp({ email, password, options }) {
          const normalized = String(email || "").trim().toLowerCase();
          if (world.users.has(normalized)) {
            return { data: { user: null, session: null }, error: { code: "user_already_exists", message: "User already registered" } };
          }
          const user = {
            id: nextId(world),
            email: normalized,
            created_at: new Date().toISOString(),
            email_confirmed_at: world.confirmEmailRequired ? null : new Date().toISOString(),
            user_metadata: { display_name: options && options.data && options.data.display_name || "" },
          };
          world.users.set(normalized, { password: String(password), user });
          world.profiles.set(user.id, {
            id: user.id,
            email: normalized,
            display_name: String(user.user_metadata.display_name || normalized.split("@")[0]).trim(),
            account_status: "active",
            preferred_bible_version: null,
            reading_prefs: {},
            subscription_status: "none",
            subscription_expires_at: null,
            subscription_canceled_at: null,
            created_at: user.created_at,
            updated_at: user.created_at,
          });
          if (world.confirmEmailRequired) return { data: { user, session: null }, error: null };
          const session = publicSession(user);
          writeSession(storage, session);
          return { data: { user, session }, error: null };
        },
        async signInWithPassword({ email, password }) {
          const record = world.users.get(String(email || "").trim().toLowerCase());
          if (!record || record.password !== String(password)) {
            return { data: { user: null, session: null }, error: { code: "invalid_credentials", message: "Invalid login credentials" } };
          }
          if (!record.user.email_confirmed_at) {
            return { data: { user: null, session: null }, error: { code: "email_not_confirmed", message: "Email not confirmed" } };
          }
          const session = publicSession(record.user);
          writeSession(storage, session);
          return { data: { user: record.user, session }, error: null };
        },
        async signOut() {
          writeSession(storage, null);
          return { error: null };
        },
        async resetPasswordForEmail(email) {
          world.resets.push(String(email || "").trim().toLowerCase());
          return { data: {}, error: null };
        },
        async updateUser(patch) {
          const session = readSession(storage);
          if (!session) return { data: { user: null }, error: { code: "session_not_found", message: "Auth session missing" } };
          const record = [...world.users.values()].find(item => item.user.id === session.user.id);
          if (!record) return { data: { user: null }, error: { message: "User not found" } };
          if (patch && patch.password) record.password = String(patch.password);
          return { data: { user: publicSession(record.user).user }, error: null };
        },
        async getSession() {
          return { data: { session: readSession(storage) }, error: null };
        },
        onAuthStateChange(callback) {
          listeners.add(callback);
          emit("INITIAL_SESSION", readSession(storage));
          return { data: { subscription: { unsubscribe() { listeners.delete(callback); } } } };
        },
      };

      function sessionUserId() {
        const session = readSession(storage);
        return session && session.user ? session.user.id : null;
      }

      function from(table) {
        const state = { table, op: "select", filters: [], payload: null, single: false };
        const builder = {
          select() { return builder; },
          eq(column, value) { state.filters.push([column, value]); return builder; },
          order() { return builder; },
          insert(row) { state.op = "insert"; state.payload = row; return builder; },
          update(row) { state.op = "update"; state.payload = row; return builder; },
          delete() { state.op = "delete"; return builder; },
          maybeSingle() { state.single = true; return builder; },
          then(resolve, reject) { return Promise.resolve().then(() => run(state)).then(resolve, reject); },
        };
        return builder;
      }

      function matches(row) {
        return stateFilters(row);
      }
      function stateFilters(row, filters) {
        return filters.every(([column, value]) => row[column] === value);
      }

      function run(state) {
        const uid = sessionUserId();
        if (state.table === "profiles") {
          if (!uid) return { data: state.single ? null : [], error: null };
          if (state.op === "select") {
            const row = world.profiles.get(uid);
            const wanted = state.filters.every(([column, value]) => !row || row[column] === value);
            const data = row && wanted ? Object.assign({}, row) : null;
            return { data: state.single ? data : (data ? [data] : []), error: null };
          }
          if (state.op === "update") {
            if (Object.keys(state.payload).some(key => PROTECTED.has(key))) {
              return { data: null, error: { code: "42501", message: "cannot change protected profile fields" } };
            }
            const idFilter = state.filters.find(([column]) => column === "id");
            if (!idFilter || idFilter[1] !== uid) return { data: null, error: null };
            const row = world.profiles.get(uid);
            if (!row) return { data: null, error: null };
            Object.assign(row, state.payload, { updated_at: new Date().toISOString() });
            return { data: Object.assign({}, row), error: null };
          }
        }
        if (state.table === "favorites") {
          if (!uid) return { data: state.op === "select" ? [] : null, error: state.op === "select" ? null : { code: "42501", message: "forbidden" } };
          if (state.op === "select") {
            const rows = world.favorites
              .filter(row => row.user_id === uid && stateFilters(row, state.filters))
              .slice()
              .sort((a, b) => a.created_at < b.created_at ? -1 : 1)
              .map(row => ({ promise_id: row.promise_id, created_at: row.created_at }));
            return { data: rows, error: null };
          }
          if (state.op === "insert") {
            const row = state.payload || {};
            if (row.user_id !== uid) return { data: null, error: { code: "42501", message: "forbidden" } };
            if (world.favorites.some(item => item.user_id === uid && item.promise_id === row.promise_id)) {
              return { data: null, error: { code: "23505", message: "duplicate" } };
            }
            world.clock += 1;
            world.favorites.push({
              user_id: uid,
              promise_id: row.promise_id,
              created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, world.clock)).toISOString(),
            });
            return { data: null, error: null };
          }
          if (state.op === "delete") {
            world.favorites = world.favorites.filter(row => !(row.user_id === uid && stateFilters(row, state.filters)));
            return { data: null, error: null };
          }
        }
        return { data: null, error: { message: "unknown table " + state.table } };
      }

      return { auth, from };
    },
  };
}

module.exports = { createWorld, install, SESSION_KEY };
