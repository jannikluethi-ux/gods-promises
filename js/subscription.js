/**
 * Subscription access seam. No real payments yet.
 * When GodsPromisesConfig.subscriptionRequired is false, access is fully open.
 * When true, requires user.subscriptionStatus === "active".
 */
(function (global) {
  "use strict";

  function cfg() {
    return global.GodsPromisesConfig || { subscriptionRequired: false };
  }

  function isActive(user) {
    return !!(user && user.subscriptionStatus === "active");
  }

  /**
   * @param {object|null|undefined} user
   * @returns {boolean}
   */
  function canAccessFavorites(user) {
    if (!cfg().subscriptionRequired) return true;
    return isActive(user);
  }

  /**
   * Whole personal area / app shell beyond public catalog.
   * @param {object|null|undefined} user
   * @returns {boolean}
   */
  function canAccessApp(user) {
    if (!cfg().subscriptionRequired) return true;
    return isActive(user);
  }

  global.GodsPromisesSubscription = {
    canAccessFavorites,
    canAccessApp,
  };
})(typeof window !== "undefined" ? window : globalThis);
