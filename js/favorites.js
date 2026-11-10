/**
 * Favorite promise ids stored in Supabase (public.favorites).
 *
 *   whenReady() -> Promise<string[]>
 *   toggle(promiseId) -> Promise<{ favorited: boolean }>
 *   list() -> Promise<string[]>
 *   isFavorite(promiseId) -> Promise<boolean>
 *   isFavoriteNow(promiseId) -> boolean   // last loaded set, for synchronous card render
 *
 * The public catalog is not stored here. Nothing is written to localStorage.
 */
(function (global) {
  "use strict";

  var PROMISE_RE = /^[a-z0-9]+(?:-[0-9]+){2,3}$/;
  var cache = new Set();
  var order = [];
  var loadedFor = null;
  var loadPromise = null;
  var lastError = null;

  function authApi() {
    return global.GodsPromisesAuth;
  }

  function fail(message, code) {
    var err = new Error(message);
    err.code = code;
    return err;
  }

  function requireUser() {
    var auth = authApi();
    var user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) throw fail("Sign in required to save favorites.", "AUTH_REQUIRED");
    if (user.accountStatus === "disabled") {
      throw fail("This account is disabled.", "ACCOUNT_DISABLED");
    }
    var sub = global.GodsPromisesSubscription;
    if (sub && !sub.canAccessFavorites(user)) {
      throw fail("An active subscription is required to use favorites.", "SUBSCRIPTION_REQUIRED");
    }
    return user;
  }

  function client() {
    var auth = authApi();
    var c = auth && auth.getClient ? auth.getClient() : null;
    if (!c) throw fail("Sign-in is not configured on this copy of the site.", "AUTH_UNCONFIGURED");
    return c;
  }

  function replaceCache(rows) {
    order = [];
    cache = new Set();
    (rows || []).forEach(function (row) {
      var id = row && row.promise_id != null ? String(row.promise_id) : "";
      if (!id || cache.has(id)) return;
      cache.add(id);
      order.push(id);
    });
  }

  async function refresh() {
    var auth = authApi();
    var user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) {
      loadedFor = null;
      lastError = null;
      replaceCache([]);
      return order.slice();
    }
    var result = await client()
      .from("favorites")
      .select("promise_id, created_at")
      .order("created_at", { ascending: true });
    if (result.error) {
      lastError = result.error;
      throw fail("Could not load your favorites.", "FAVORITES_LOAD_FAILED");
    }
    lastError = null;
    loadedFor = user.id;
    replaceCache(result.data);
    return order.slice();
  }

  function whenReady() {
    var auth = authApi();
    var ready = auth && auth.whenReady ? auth.whenReady() : Promise.resolve(null);
    return ready.then(function () {
      var user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
      if (!user) {
        loadedFor = null;
        loadPromise = null;
        lastError = null;
        replaceCache([]);
        return [];
      }
      if (loadPromise && loadedFor === user.id) return loadPromise;
      loadPromise = refresh().catch(function (err) {
        loadPromise = null;
        throw err;
      });
      return loadPromise;
    });
  }

  async function list() {
    await whenReady();
    return order.slice();
  }

  async function isFavorite(promiseId) {
    await whenReady();
    return cache.has(String(promiseId));
  }

  function isFavoriteNow(promiseId) {
    return cache.has(String(promiseId));
  }

  function getError() {
    return lastError;
  }

  async function toggle(promiseId) {
    var user = requireUser();
    var id = String(promiseId || "");
    if (!PROMISE_RE.test(id) || id.length > 40) throw fail("That promise could not be saved.", "INVALID_PROMISE");
    await whenReady();
    var db = client();
    if (cache.has(id)) {
      var removed = await db.from("favorites").delete().eq("user_id", user.id).eq("promise_id", id);
      if (removed.error) throw fail("Could not update your favorites.", "FAVORITES_WRITE_FAILED");
      cache.delete(id);
      order = order.filter(function (item) { return item !== id; });
      return { favorited: false };
    }
    var inserted = await db.from("favorites").insert({ user_id: user.id, promise_id: id });
    if (inserted.error && inserted.error.code !== "23505") {
      throw fail("Could not update your favorites.", "FAVORITES_WRITE_FAILED");
    }
    if (!cache.has(id)) {
      cache.add(id);
      order.push(id);
    }
    return { favorited: true };
  }

  var auth = authApi();
  if (auth && auth.onAuthChange) {
    auth.onAuthChange(function (user) {
      if (!user || user.id !== loadedFor) {
        loadedFor = null;
        loadPromise = null;
        lastError = null;
        replaceCache([]);
      }
    });
  }

  global.GodsPromisesFavorites = {
    whenReady: whenReady,
    toggle: toggle,
    list: list,
    isFavorite: isFavorite,
    isFavoriteNow: isFavoriteNow,
    getError: getError,
  };
})(typeof window !== "undefined" ? window : globalThis);
