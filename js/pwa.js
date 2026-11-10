/**
 * Registers the service worker and remembers the verse the landing page is showing
 * so it can be opened offline. Does nothing for file:// previews.
 */
(function (global) {
  "use strict";

  function rememberDaily(verse) {
    if (!verse || !verse.id) return;
    var worker = global.navigator && global.navigator.serviceWorker;
    if (!worker || !worker.controller) return;
    try {
      worker.controller.postMessage({ type: "daily-verse", verse: verse });
    } catch (err) {
      /* the page still works without the offline copy */
    }
  }

  function start() {
    var nav = global.navigator;
    if (!nav || !nav.serviceWorker || !global.location) return;
    var host = global.location.hostname;
    var secure = global.location.protocol === "https:" || host === "localhost" || host === "127.0.0.1";
    if (!secure) return;
    global.addEventListener("load", function () {
      nav.serviceWorker.register("/sw.js").catch(function () {});
    });
  }

  start();
  global.GodsPromisesPwa = { rememberDaily: rememberDaily };
})(typeof window !== "undefined" ? window : globalThis);
