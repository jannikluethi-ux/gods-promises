/**
 * Supabase Auth for His Promise Daily.
 *
 * Public API:
 *   whenReady() -> Promise<user|null>   // resolves after the session is restored
 *   signUp({ email, password, displayName? }) -> Promise<user>
 *   signIn({ email, password }) -> Promise<user>
 *   signOut() -> Promise<void>
 *   getCurrentUser() -> user | null     // null until whenReady, and when signed out
 *   onAuthChange(callback) -> unsubscribe
 *   requestPasswordReset({ email }) -> Promise<void>
 *   updatePassword({ password }) -> Promise<void>
 *   updateProfile({ displayName?, preferredBibleVersion?, readingPrefs?, dailyVerseEmail? }) -> Promise<user>
 *   deleteAccount({ confirmation }) -> Promise<void>
 *   getAccessToken() -> string | null
 *
 * The Supabase client stores the session. This file does not store passwords,
 * password hashes, or a hand-built session. Identity is auth.users.id.
 * Subscription status is read from public.profiles and is never taken from
 * user_metadata.
 */
(function (global) {
  "use strict";

  var LEGACY_EXACT = ["gp_auth_users_v1", "gp_auth_session_v1"];
  var LEGACY_PREFIX = "gp_favorites_v1_";
  var PROFILE_COLUMNS =
    "id, email, display_name, account_status, preferred_bible_version, reading_prefs, daily_verse_email, " +
    "subscription_status, subscription_expires_at, subscription_canceled_at, created_at, updated_at";
  var VERSIONS = { web: 1, kjv: 1, asv: 1, ylt: 1, darby: 1, dra: 1 };

  /** @type {Set<function>} */
  var listeners = new Set();
  var client = null;
  var session = null;
  var current = null;
  var profileError = null;
  var ready = false;
  var recovery = false;
  var applyingRemote = false;
  var versionTimer = null;
  var readyResolve;
  var readyPromise = new Promise(function (resolve) {
    readyResolve = resolve;
  });

  function fail(message, code) {
    var err = new Error(message);
    err.code = code || "AUTH_ERROR";
    return err;
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function cleanName(value) {
    return String(value || "")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
      .slice(0, 80);
  }

  function clearLegacyStorage() {
    var storage = global.localStorage;
    if (!storage) return;
    try {
      var i;
      for (i = 0; i < LEGACY_EXACT.length; i++) storage.removeItem(LEGACY_EXACT[i]);
      var drop = [];
      for (i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        if (key && key.indexOf(LEGACY_PREFIX) === 0) drop.push(key);
      }
      for (i = 0; i < drop.length; i++) storage.removeItem(drop[i]);
    } catch (_) {
      /* storage blocked: nothing local is authoritative */
    }
  }

  function finishReady() {
    if (ready) return;
    ready = true;
    readyResolve(current);
  }

  function notify(meta) {
    var user = current;
    listeners.forEach(function (cb) {
      try {
        cb(user, meta || {});
      } catch (_) {
        /* ignore listener errors */
      }
    });
  }

  function toPublicUser(profile, authUser) {
    var meta = (authUser && authUser.user_metadata) || {};
    var name = profile && profile.display_name;
    if (!name) name = cleanName(meta.display_name);
    return {
      id: authUser.id,
      email: (profile && profile.email) || authUser.email || "",
      displayName: name || "",
      subscriptionStatus: profile && profile.subscription_status ? profile.subscription_status : "none",
      subscriptionExpiresAt: profile ? profile.subscription_expires_at || null : null,
      subscriptionCanceledAt: profile ? profile.subscription_canceled_at || null : null,
      accountStatus: profile && profile.account_status ? profile.account_status : "active",
      preferredBibleVersion: profile ? profile.preferred_bible_version || null : null,
      readingPrefs: profile && profile.reading_prefs && typeof profile.reading_prefs === "object"
        ? profile.reading_prefs
        : {},
      dailyVerseEmail: !!(profile && profile.daily_verse_email),
      createdAt: (profile && profile.created_at) || authUser.created_at || null,
      emailVerified: !!(authUser.email_confirmed_at || authUser.confirmed_at),
    };
  }

  function mapAuthError(error) {
    var code = error && (error.code || error.error_code || "");
    var msg = (error && error.message) || "";
    if (code === "email_not_confirmed" || /not confirmed/i.test(msg)) {
      return fail(
        "Confirm your email before signing in. Check your inbox for the verification link.",
        "EMAIL_NOT_CONFIRMED"
      );
    }
    if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
      return fail("Incorrect email or password.", "INVALID_CREDENTIALS");
    }
    if (code === "user_already_exists" || /already registered/i.test(msg)) {
      return fail("An account with this email already exists. Sign in instead.", "EMAIL_TAKEN");
    }
    if (code === "over_request_rate_limit" || /rate limit/i.test(msg)) {
      return fail("Too many attempts. Please wait a moment and try again.", "RATE_LIMITED");
    }
    if (code === "weak_password" || /password/i.test(msg) && /at least|weak/i.test(msg)) {
      return fail("Password must be at least 8 characters.", "WEAK_PASSWORD");
    }
    return fail("Something went wrong. Please try again.", "AUTH_ERROR");
  }

  function authRedirectUrl() {
    var origin = "https://hispromisedaily.com";
    try {
      var host = String(global.location && global.location.hostname || "");
      if (host === "hispromisedaily.com" || host === "www.hispromisedaily.com") {
        origin = "https://" + host;
      } else if (host === "localhost" || host === "127.0.0.1") {
        origin = global.location.origin;
      } else if (/\.vercel\.app$/i.test(host) && global.location.origin) {
        origin = global.location.origin;
      }
    } catch (_) {
      /* keep the production origin */
    }
    return origin.replace(/\/+$/, "") + "/login.html";
  }

  function requireConfigured() {
    if (!client) {
      var err = profileError || fail("Sign-in is not configured on this copy of the site.", "AUTH_UNCONFIGURED");
      throw err;
    }
  }

  async function loadProfile(userId) {
    var result = await client.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }

  function readDeviceVersion() {
    try {
      var stored = global.localStorage && global.localStorage.getItem("gods-promises-version");
      if (stored && VERSIONS[stored]) return stored;
    } catch (_) {
      /* ignore */
    }
    return "web";
  }

  /**
   * A profile value wins. An empty profile stays empty and displays WEB for
   * this session. The device value is never written onto the account.
   */
  function decideBiblePreference(profileVersion) {
    if (profileVersion && VERSIONS[profileVersion]) {
      return { display: profileVersion, save: false };
    }
    return { display: "web", save: false };
  }

  var deviceVersionAtLogin = null;

  function applyBiblePreference(user) {
    var Versions = global.GodsPromisesVersions;
    if (!Versions || !user) return;
    if (deviceVersionAtLogin == null) deviceVersionAtLogin = readDeviceVersion();
    var decision = decideBiblePreference(user.preferredBibleVersion);
    if (!Versions.setCurrent || (Versions.getCurrentId && Versions.getCurrentId() === decision.display)) return;
    applyingRemote = true;
    try {
      Versions.setCurrent(decision.display);
    } finally {
      applyingRemote = false;
    }
  }

  async function applySession(nextSession, meta) {
    session = nextSession || null;
    profileError = null;
    if (!session || !session.user) {
      current = null;
      finishReady();
      notify(meta);
      return current;
    }
    var profile = null;
    try {
      profile = await loadProfile(session.user.id);
    } catch (err) {
      profileError = err;
    }
    current = toPublicUser(profile, session.user);
    finishReady();
    notify(meta);
    applyBiblePreference(current);
    return current;
  }

  function handleAuthEvent(event, nextSession) {
    if (event === "TOKEN_REFRESHED") {
      session = nextSession || session;
      return Promise.resolve(current);
    }
    if (event === "PASSWORD_RECOVERY") recovery = true;
    if (event === "SIGNED_OUT") recovery = false;
    return applySession(nextSession, { event: event, recovery: recovery });
  }

  function createBrowserClient() {
    var cfg = global.GodsPromisesConfig || {};
    var factory = global.supabase && global.supabase.createClient;
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      throw fail("Sign-in is not configured on this copy of the site.", "AUTH_UNCONFIGURED");
    }
    if (typeof factory !== "function") {
      throw fail("The sign-in library did not load. Refresh the page and try again.", "AUTH_UNCONFIGURED");
    }
    if (/service_role|sb_secret_/i.test(String(cfg.supabaseAnonKey))) {
      throw fail("Sign-in is misconfigured.", "AUTH_UNCONFIGURED");
    }
    return factory(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });
  }

  function start() {
    clearLegacyStorage();
    try {
      client = createBrowserClient();
    } catch (err) {
      profileError = err;
      finishReady();
      return;
    }
    var chain = Promise.resolve();
    client.auth.onAuthStateChange(function (event, nextSession) {
      chain = chain.then(function () {
        return handleAuthEvent(event, nextSession);
      }).catch(function () {
        finishReady();
      });
    });
  }

  function getCurrentUser() {
    return current;
  }

  function whenReady() {
    return readyPromise.then(function () {
      return current;
    });
  }

  function getAccessToken() {
    return session && session.access_token ? session.access_token : null;
  }

  function getProfileError() {
    return profileError;
  }

  function isPasswordRecovery() {
    return recovery;
  }

  async function signUp(opts) {
    requireConfigured();
    var email = normalizeEmail(opts && opts.email);
    var password = opts && opts.password != null ? String(opts.password) : "";
    var displayName = cleanName(opts && opts.displayName);
    if (!email || email.indexOf("@") < 1 || email.indexOf("@") !== email.lastIndexOf("@")) {
      throw fail("Please enter a valid email address.", "INVALID_EMAIL");
    }
    if (password.length < 8) {
      throw fail("Password must be at least 8 characters.", "WEAK_PASSWORD");
    }
    var result = await client.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: authRedirectUrl(),
      },
    });
    if (result.error) throw mapAuthError(result.error);
    var authUser = result.data && result.data.user;
    if (!authUser) throw fail("Could not create the account.", "AUTH_ERROR");
    if (result.data.session) {
      await applySession(result.data.session, { event: "SIGNED_IN", recovery: false });
    }
    var user = Object.assign({}, current || toPublicUser(null, authUser));
    user.displayName = user.displayName || displayName || email.split("@")[0];
    user.needsVerification = !result.data.session;
    return user;
  }

  async function signIn(opts) {
    requireConfigured();
    var email = normalizeEmail(opts && opts.email);
    var password = opts && opts.password != null ? String(opts.password) : "";
    if (!email || !password) throw fail("Email and password are required.", "INVALID_CREDENTIALS");
    var result = await client.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw mapAuthError(result.error);
    if (!result.data || !result.data.session || !result.data.user) {
      throw fail("Incorrect email or password.", "INVALID_CREDENTIALS");
    }
    recovery = false;
    await applySession(result.data.session, { event: "SIGNED_IN", recovery: false });
    return current;
  }

  async function signOut() {
    var restore = deviceVersionAtLogin || readDeviceVersion();
    deviceVersionAtLogin = null;
    if (client) {
      try {
        await client.auth.signOut();
      } catch (_) {
        /* still drop the in-memory session */
      }
    }
    recovery = false;
    await applySession(null, { event: "SIGNED_OUT", recovery: false });
    var Versions = global.GodsPromisesVersions;
    if (Versions && typeof Versions.restoreAnonymous === "function") {
      Versions.restoreAnonymous(restore);
    }
  }

  async function requestPasswordReset(opts) {
    requireConfigured();
    var email = normalizeEmail(opts && opts.email);
    if (!email || email.indexOf("@") < 1) throw fail("Please enter a valid email address.", "INVALID_EMAIL");
    var result = await client.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
    if (result.error) throw mapAuthError(result.error);
  }

  async function updatePassword(opts) {
    requireConfigured();
    if (!session) throw fail("Open the reset link from your email, then choose a new password.", "AUTH_REQUIRED");
    var password = opts && opts.password != null ? String(opts.password) : "";
    if (password.length < 8) throw fail("Password must be at least 8 characters.", "WEAK_PASSWORD");
    var result = await client.auth.updateUser({ password: password });
    if (result.error) throw mapAuthError(result.error);
    recovery = false;
    notify({ event: "USER_UPDATED", recovery: false });
    return current;
  }

  async function updateProfile(patch) {
    requireConfigured();
    if (!current || !session) throw fail("Sign in required.", "AUTH_REQUIRED");
    if (patch && ("subscriptionStatus" in patch || "accountStatus" in patch || "email" in patch || "id" in patch)) {
      throw fail("That setting can’t be changed here.", "FORBIDDEN");
    }
    var row = {};
    if (patch && patch.displayName != null) {
      var name = cleanName(patch.displayName);
      if (!name) throw fail("Please enter a display name.", "INVALID_NAME");
      row.display_name = name;
    }
    if (patch && patch.preferredBibleVersion != null) {
      var version = String(patch.preferredBibleVersion);
      if (!VERSIONS[version]) throw fail("Choose one of the available Bible versions.", "INVALID_VERSION");
      row.preferred_bible_version = version;
    }
    if (patch && patch.readingPrefs != null) {
      if (!patch.readingPrefs || typeof patch.readingPrefs !== "object" || Array.isArray(patch.readingPrefs)) {
        throw fail("Reading preferences must be a set of named options.", "INVALID_PREFS");
      }
      row.reading_prefs = patch.readingPrefs;
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, "dailyVerseEmail")) {
      if (typeof patch.dailyVerseEmail !== "boolean") {
        throw fail("Choose whether to receive the morning email.", "INVALID_PREFS");
      }
      row.daily_verse_email = patch.dailyVerseEmail;
    }
    if (!Object.keys(row).length) return current;
    var result = await client
      .from("profiles")
      .update(row)
      .eq("id", current.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (result.error) throw fail("Could not save your settings.", "PROFILE_WRITE_FAILED");
    current = toPublicUser(result.data, session.user);
    notify({ event: "PROFILE_UPDATED", recovery: recovery });
    return current;
  }

  function syncBibleVersion(id) {
    if (applyingRemote || !current || !ready) return;
    if (current.preferredBibleVersion === id) return;
    if (versionTimer && typeof global.clearTimeout === "function") global.clearTimeout(versionTimer);
    var wait = typeof global.setTimeout === "function"
      ? global.setTimeout.bind(global)
      : function (fn) { Promise.resolve().then(fn); return 0; };
    versionTimer = wait(function () {
      versionTimer = null;
      updateProfile({ preferredBibleVersion: id }).catch(function () {});
    }, 250);
  }

  async function deleteAccount(opts) {
    requireConfigured();
    var confirmation = opts && opts.confirmation;
    if (confirmation !== "DELETE") throw fail("Type DELETE to confirm account deletion.", "CONFIRMATION_REQUIRED");
    var token = getAccessToken();
    if (!token) throw fail("Sign in required.", "AUTH_REQUIRED");
    var response;
    try {
      response = await global.fetch("/api/account", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          authorization: "Bearer " + token,
        },
        body: JSON.stringify({ action: "delete", confirmation: "DELETE" }),
      });
    } catch (_) {
      throw fail("Could not delete the account. Check your connection and try again.", "ACCOUNT_DELETE_FAILED");
    }
    var body = null;
    try {
      body = await response.json();
    } catch (_) {
      body = null;
    }
    if (!response.ok) {
      throw fail((body && body.message) || "Could not delete the account.", "ACCOUNT_DELETE_FAILED");
    }
    await signOut();
  }

  function onAuthChange(callback) {
    if (typeof callback !== "function") return function () {};
    listeners.add(callback);
    return function unsubscribe() {
      listeners.delete(callback);
    };
  }

  function getClient() {
    return client;
  }

  start();

  global.GodsPromisesAuth = {
    whenReady: whenReady,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    decideBiblePreference: decideBiblePreference,
    getCurrentUser: getCurrentUser,
    onAuthChange: onAuthChange,
    requestPasswordReset: requestPasswordReset,
    updatePassword: updatePassword,
    updateProfile: updateProfile,
    deleteAccount: deleteAccount,
    getAccessToken: getAccessToken,
    getProfileError: getProfileError,
    isPasswordRecovery: isPasswordRecovery,
    syncBibleVersion: syncBibleVersion,
    getClient: getClient,
  };
})(typeof window !== "undefined" ? window : globalThis);
