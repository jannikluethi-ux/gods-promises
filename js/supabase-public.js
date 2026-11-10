/**
 * Public Supabase settings placeholder.
 * scripts/build_site.py overwrites dist/js/supabase-public.js from the build
 * environment. This source file stays empty so a missing key is obvious and no
 * secret is committed. The service-role key is never written here.
 */
(function (global) {
  "use strict";
  var cfg = global.GodsPromisesConfig || (global.GodsPromisesConfig = {});
  if (!cfg.supabaseUrl) cfg.supabaseUrl = "";
  if (!cfg.supabaseAnonKey) cfg.supabaseAnonKey = "";
})(typeof window !== "undefined" ? window : globalThis);
