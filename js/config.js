/**
 * Runtime configuration.
 * supabaseUrl and supabaseAnonKey are filled by js/supabase-public.js, which the
 * production build writes from SUPABASE_URL and SUPABASE_ANON_KEY (or
 * SUPABASE_PUBLISHABLE_KEY). The service-role key is never placed here.
 * subscriptionRequired stays false until a real payment integration exists.
 */
(function (global) {
  "use strict";

  global.GodsPromisesConfig = {
    appName: "His Promise Daily",
    /** When true, favorites and the personal page require an active entitlement. */
    subscriptionRequired: false,
    supabaseUrl: "",
    supabaseAnonKey: "",
  };
})(typeof window !== "undefined" ? window : globalThis);
