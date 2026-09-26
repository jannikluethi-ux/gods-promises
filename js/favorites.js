/**
 * Per-user favorite promise IDs (Set), persisted in localStorage keyed by user id.
 * Ready to swap to a remote table later — keep the same public API.
 *
 *   toggle(promiseId) -> Promise<{ favorited: boolean }>
 *   list() -> string[]
 *   isFavorite(promiseId) -> boolean
 */
(function (global) {
  "use strict";

  const PREFIX = "gp_favorites_v1_";

  function storageKey(userId) {
    return PREFIX + userId;
  }

  function requireUser() {
    const auth = global.GodsPromisesAuth;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) {
      const err = new Error("Sign in required to save favorites.");
      err.code = "AUTH_REQUIRED";
      throw err;
    }
    const sub = global.GodsPromisesSubscription;
    if (sub && !sub.canAccessFavorites(user)) {
      const err = new Error("An active subscription is required to use favorites.");
      err.code = "SUBSCRIPTION_REQUIRED";
      throw err;
    }
    return user;
  }

  function readSet(userId) {
    try {
      const raw = localStorage.getItem(storageKey(userId));
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.map(String));
    } catch (_) {
      return new Set();
    }
  }

  function writeSet(userId, set) {
    localStorage.setItem(storageKey(userId), JSON.stringify([...set]));
  }

  function isFavorite(promiseId) {
    const auth = global.GodsPromisesAuth;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return false;
    return readSet(user.id).has(String(promiseId));
  }

  function list() {
    const auth = global.GodsPromisesAuth;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    if (!user) return [];
    return [...readSet(user.id)];
  }

  /**
   * @param {string} promiseId
   * @returns {Promise<{ favorited: boolean }>}
   */
  async function toggle(promiseId) {
    const user = requireUser();
    const id = String(promiseId);
    const set = readSet(user.id);
    let favorited;
    if (set.has(id)) {
      set.delete(id);
      favorited = false;
    } else {
      set.add(id);
      favorited = true;
    }
    writeSet(user.id, set);
    return { favorited };
  }

  global.GodsPromisesFavorites = {
    toggle,
    list,
    isFavorite,
  };
})(typeof window !== "undefined" ? window : globalThis);
