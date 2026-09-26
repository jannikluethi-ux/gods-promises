/**
 * Email + password auth with local persistence (localStorage).
 * Passwords are never stored in plaintext — salted PBKDF2 (Web Crypto).
 *
 * Public API (stable for later Supabase Auth swap):
 *   signUp({ email, password, displayName? }) -> Promise<user>
 *   signIn({ email, password }) -> Promise<user>
 *   signOut() -> Promise<void>
 *   getCurrentUser() -> user | null
 *   onAuthChange(callback) -> unsubscribe()
 *
 * User shape: { id, email, displayName, subscriptionStatus, createdAt }
 * subscriptionStatus is ready for Stripe later ("active" | "inactive" | "none").
 */
(function (global) {
  "use strict";

  const USERS_KEY = "gp_auth_users_v1";
  const SESSION_KEY = "gp_auth_session_v1";
  const PBKDF2_ITERATIONS = 100000;
  const SALT_BYTES = 16;
  const HASH_BITS = 256;

  /** @type {Set<function>} */
  const listeners = new Set();

  function loadUsers() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function saveSession(session) {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function normalizeEmail(email) {
    return String(email || "")
      .trim()
      .toLowerCase();
  }

  function publicUser(record) {
    if (!record) return null;
    return {
      id: record.id,
      email: record.email,
      displayName: record.displayName || "",
      subscriptionStatus: record.subscriptionStatus || "none",
      createdAt: record.createdAt,
    };
  }

  function notify() {
    const user = getCurrentUser();
    listeners.forEach((cb) => {
      try {
        cb(user);
      } catch (_) {
        /* ignore listener errors */
      }
    });
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  async function deriveHash(password, saltBytes) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      HASH_BITS
    );
    return new Uint8Array(bits);
  }

  function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const hex = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  /**
   * @returns {object|null}
   */
  function getCurrentUser() {
    const session = loadSession();
    if (!session || !session.userId) return null;
    const users = loadUsers();
    const record = users[session.userId];
    if (!record) {
      saveSession(null);
      return null;
    }
    return publicUser(record);
  }

  /**
   * @param {{ email: string, password: string, displayName?: string }} opts
   */
  async function signUp(opts) {
    const email = normalizeEmail(opts && opts.email);
    const password = opts && opts.password != null ? String(opts.password) : "";
    const displayName = String((opts && opts.displayName) || "").trim();

    if (!email || !email.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    if (!global.crypto || !global.crypto.subtle) {
      throw new Error("Secure crypto is not available in this browser.");
    }

    const users = loadUsers();
    for (const id of Object.keys(users)) {
      if (users[id].email === email) {
        throw new Error("An account with this email already exists. Sign in instead.");
      }
    }

    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const hash = await deriveHash(password, salt);
    const id = uuid();
    const record = {
      id,
      email,
      displayName: displayName || email.split("@")[0],
      passwordHash: bytesToBase64(hash),
      salt: bytesToBase64(salt),
      subscriptionStatus: "none",
      createdAt: new Date().toISOString(),
    };
    users[id] = record;
    saveUsers(users);
    saveSession({ userId: id });
    notify();
    return publicUser(record);
  }

  /**
   * @param {{ email: string, password: string }} opts
   */
  async function signIn(opts) {
    const email = normalizeEmail(opts && opts.email);
    const password = opts && opts.password != null ? String(opts.password) : "";

    if (!email || !password) {
      throw new Error("Email and password are required.");
    }
    if (!global.crypto || !global.crypto.subtle) {
      throw new Error("Secure crypto is not available in this browser.");
    }

    const users = loadUsers();
    let record = null;
    for (const id of Object.keys(users)) {
      if (users[id].email === email) {
        record = users[id];
        break;
      }
    }
    if (!record) {
      throw new Error("Incorrect email or password.");
    }

    const salt = base64ToBytes(record.salt);
    const expected = base64ToBytes(record.passwordHash);
    const actual = await deriveHash(password, salt);
    if (!timingSafeEqual(expected, actual)) {
      throw new Error("Incorrect email or password.");
    }

    saveSession({ userId: record.id });
    notify();
    return publicUser(record);
  }

  async function signOut() {
    saveSession(null);
    notify();
  }

  /**
   * @param {function} callback
   * @returns {function} unsubscribe
   */
  function onAuthChange(callback) {
    if (typeof callback !== "function") return function () {};
    listeners.add(callback);
    return function unsubscribe() {
      listeners.delete(callback);
    };
  }

  global.GodsPromisesAuth = {
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    onAuthChange,
  };
})(typeof window !== "undefined" ? window : globalThis);
