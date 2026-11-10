/**
 * Subscription access seam. No payments are implemented.
 * subscriptionRequired stays false, so the catalog and favorites stay open
 * to every signed-in person. The check below is the model a later payment
 * integration will use. Status is read from the profile row; the browser
 * cannot grant it.
 *
 * Active means status "active", or "canceled" while subscriptionExpiresAt
 * is still in the future. "none", "inactive", and "expired" are not active.
 */
(function (global) {
  "use strict";

  function cfg() {
    return global.GodsPromisesConfig || { subscriptionRequired: false };
  }

  function isActive(user) {
    if (!user || user.accountStatus === "disabled") return false;
    if (user.subscriptionStatus === "active") return true;
    if (user.subscriptionStatus === "canceled" && user.subscriptionExpiresAt) {
      var expires = Date.parse(user.subscriptionExpiresAt);
      return Number.isFinite(expires) && expires > Date.now();
    }
    return false;
  }

  /**
   * @param {object|null|undefined} user
   * @returns {boolean}
   */
  function canAccessFavorites(user) {
    if (user && user.accountStatus === "disabled") return false;
    if (!cfg().subscriptionRequired) return true;
    return isActive(user);
  }

  /**
   * Personal page beyond the public catalog.
   * @param {object|null|undefined} user
   * @returns {boolean}
   */
  function canAccessApp(user) {
    if (user && user.accountStatus === "disabled") return false;
    if (!cfg().subscriptionRequired) return true;
    return isActive(user);
  }

  global.GodsPromisesSubscription = {
    isActive: isActive,
    canAccessFavorites: canAccessFavorites,
    canAccessApp: canAccessApp,
  };
})(typeof window !== "undefined" ? window : globalThis);
