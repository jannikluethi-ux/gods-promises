/**
 * App configuration — flip subscriptionRequired later to gate favorites / personal area.
 * Supabase / Stripe placeholders are intentionally empty until wired up.
 *
 * Future swap notes:
 * - Set subscriptionRequired: true once payments exist.
 * - Fill supabaseUrl + supabaseAnonKey, then replace auth.js / favorites.js
 *   persistence with Supabase Auth + a favorites table (same public API).
 * - Stripe (or similar) should set user.subscriptionStatus to "active" | "inactive"
 *   on the profile record that getCurrentUser() returns.
 */
(function (global) {
  "use strict";

  global.GodsPromisesConfig = {
    appName: "God’s Promises",
    /** When true, favorites / personal area require user.subscriptionStatus === "active". */
    subscriptionRequired: false,
    /** Placeholder for later Supabase Auth + remote favorites. */
    supabaseUrl: "",
    supabaseAnonKey: "",
  };
})(typeof window !== "undefined" ? window : globalThis);
