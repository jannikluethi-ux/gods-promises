/** Shows a calm move notice only on the old GitHub Pages address. No redirect, no data migration. */
(function () {
  "use strict";
  if (!/\.github\.io$/i.test(location.hostname)) return;
  var el = document.getElementById("host-notice");
  if (el) el.hidden = false;
})();
