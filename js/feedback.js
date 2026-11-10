/**
 * Explanation feedback widget: "Was this explanation helpful?" under each explanation.
 *
 * - Markup is tiny and static until someone taps Yes/No; the form is built on demand.
 * - One set of delegated listeners on document handles every card and verse page.
 * - Posts only to the same-origin /api/feedback server function (never to a database).
 * - localStorage is only a UX cache of "already submitted"; the server enforces uniqueness
 *   per anonymous httpOnly session cookie + verse + explanation version.
 */
(function (global) {
  "use strict";

  var API = "/api/feedback";
  var STORE_KEY = "hpd.feedback.v1";
  var MAX_COMMENT = 500;
  var THANKS = "Thank you! Your feedback helps us make His Promise Daily better.";
  var ALREADY = "You’ve already shared feedback on this explanation. Thank you!";
  var CATEGORIES = {
    positive: [
      ["clear", "Clear and easy to understand"],
      ["accurate", "Biblically accurate and relevant"],
      ["understanding", "Helped me understand the verse better"],
      ["practical", "Practical and applicable to my daily life"],
      ["encouraging", "Encouraged or inspired me"],
    ],
    negative: [
      ["confusing", "The explanation is confusing"],
      ["too_general", "Too general or superficial"],
      ["missing_context", "Missing important biblical context"],
      ["inaccurate", "The interpretation seems inaccurate"],
      ["no_application", "Doesn’t explain how to apply the verse"],
      ["too_long", "Too long or repetitive"],
      ["unclear_meaning", "Doesn’t answer what the verse actually means"],
      ["other", "Other"],
    ],
  };
  var ERRORS = {
    rate_limited: "You’ve sent a lot of feedback just now. Please try again a little later.",
    explanation_updated: "This explanation was just updated. Please reload the page to share feedback on the new version.",
    generic: "Sorry, your feedback couldn’t be sent. Please check your connection and try again.",
  };
  var VERSE_RE = /^[a-z0-9]+(?:-[0-9]+){2,3}$/;
  var seq = 0;

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* —— UX cache (never a security boundary) —— */
  function readStore() {
    try {
      var v = JSON.parse(global.localStorage.getItem(STORE_KEY) || "{}");
      return v && typeof v === "object" ? v : {};
    } catch (_) {
      return {};
    }
  }
  function cacheKey(verseId, version) {
    return verseId + "|" + version;
  }
  function wasSubmitted(verseId, version) {
    return !!readStore()[cacheKey(verseId, version)];
  }
  function remember(verseId, version, rating) {
    try {
      var s = readStore();
      s[cacheKey(verseId, version)] = { r: rating === "negative" ? "n" : rating === "positive" ? "p" : "?", t: Date.now() };
      var keys = Object.keys(s);
      if (keys.length > 2000) keys.sort(function (a, b) { return s[a].t - s[b].t; }).slice(0, keys.length - 2000).forEach(function (k) { delete s[k]; });
      global.localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch (_) {
      /* storage full or blocked: server still prevents duplicates */
    }
  }

  /* —— Markup —— */
  function doneHtml(message) {
    return '<p class="fb-done" role="status" tabindex="-1">' +
      '<svg class="fb-done-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "<span>" + esc(message) + "</span></p>";
  }

  function innerHtml(verseId, version) {
    if (wasSubmitted(verseId, version)) return doneHtml(ALREADY);
    var id = "fb-q-" + ++seq;
    return '<p class="fb-question" id="' + id + '">Was this explanation helpful?</p>' +
      '<div class="fb-choices" role="group" aria-labelledby="' + id + '">' +
      '<button type="button" class="fb-choice" data-fb-rating="positive" aria-pressed="false" aria-expanded="false"><span aria-hidden="true">👍</span> Yes, helpful</button>' +
      '<button type="button" class="fb-choice" data-fb-rating="negative" aria-pressed="false" aria-expanded="false"><span aria-hidden="true">👎</span> Not really</button>' +
      "</div>";
  }

  /**
   * Widget for a card / page. Returns "" for unknown ids so callers can always concatenate.
   * @param {string} verseId
   * @param {string} version explanation version the reader is looking at
   * @param {"card"|"verse_page"} [source]
   */
  function html(verseId, version, source) {
    if (!VERSE_RE.test(String(verseId || "")) || !version) return "";
    return '<section class="fb" data-fb-verse="' + esc(verseId) + '" data-fb-version="' + esc(version) +
      '" data-fb-source="' + (source === "verse_page" ? "verse_page" : "card") + '" aria-label="Feedback on this explanation">' +
      innerHtml(verseId, version) + "</section>";
  }

  function formHtml(rating) {
    var n = ++seq;
    var cats = CATEGORIES[rating].map(function (c) {
      return '<li><label class="fb-cat"><input type="checkbox" name="fb-cat" value="' + c[0] + '" />' +
        "<span>" + esc(c[1]) + "</span></label></li>";
    }).join("");
    var legend = rating === "positive" ? "What helped? (optional)" : "What could be better? (optional)";
    return '<form class="fb-form" novalidate>' +
      '<fieldset class="fb-cats"><legend>' + legend + "</legend><ul>" + cats + "</ul></fieldset>" +
      '<label class="fb-label" for="fb-c-' + n + '">Anything else you’d like us to know? <span class="fb-optional">(optional)</span></label>' +
      '<textarea id="fb-c-' + n + '" class="fb-comment" name="comment" rows="3" maxlength="' + MAX_COMMENT + '" ' +
      'placeholder="Tell us how we could improve this explanation…" aria-describedby="fb-n-' + n + '"></textarea>' +
      '<p class="fb-count" id="fb-n-' + n + '">0 / ' + MAX_COMMENT + "</p>" +
      // Honeypot: invisible to people and assistive tech; bots that fill it are ignored server-side.
      '<div class="fb-hp" aria-hidden="true"><label>Leave this field empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>' +
      '<div class="fb-actions"><button type="submit" class="fb-submit">Send feedback</button>' +
      '<p class="fb-status" role="status" aria-live="polite"></p></div>' +
      "</form>";
  }

  /* —— Rendering hooks —— */
  function hydrate(root) {
    var scope = root && root.querySelectorAll ? root : global.document;
    if (!scope) return;
    var list = scope.querySelectorAll(".fb[data-fb-verse]:not([data-fb-ready])");
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      el.setAttribute("data-fb-ready", "");
      if (!el.firstElementChild) el.innerHTML = innerHtml(el.getAttribute("data-fb-verse"), el.getAttribute("data-fb-version"));
    }
  }

  function showDone(box, message) {
    box.classList.remove("is-open");
    box.innerHTML = doneHtml(message);
    var p = box.querySelector(".fb-done");
    // Only move focus when the reader just submitted (their focused button was replaced).
    if (p && box.getAttribute("data-fb-focus") === "1") {
      try { p.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    }
  }

  function accessToken() {
    try {
      var auth = global.GodsPromisesAuth;
      var token = auth && auth.getAccessToken ? auth.getAccessToken() : null;
      return typeof token === "string" && token.length >= 20 ? token : null;
    } catch (_) {
      return null;
    }
  }

  function payloadFrom(box) {
    var form = box.querySelector(".fb-form");
    var rating = box.getAttribute("data-fb-rating");
    var cats = [];
    var boxes = form ? form.querySelectorAll('input[name="fb-cat"]:checked') : [];
    for (var i = 0; i < boxes.length; i++) cats.push(boxes[i].value);
    var comment = form ? form.querySelector(".fb-comment").value.trim() : "";
    var hp = form ? form.querySelector('input[name="website"]').value : "";
    var body = {
      verseId: box.getAttribute("data-fb-verse"),
      explanationVersion: box.getAttribute("data-fb-version"),
      language: "en",
      rating: rating,
      categories: cats,
      source: box.getAttribute("data-fb-source") === "verse_page" ? "verse_page" : "card",
    };
    if (comment) body.comment = comment.slice(0, MAX_COMMENT);
    if (hp) body.website = hp;
    return body;
  }

  function checkStatus(box) {
    if (box.getAttribute("data-fb-checked") || !global.fetch) return;
    box.setAttribute("data-fb-checked", "1");
    var verseId = box.getAttribute("data-fb-verse");
    var version = box.getAttribute("data-fb-version");
    global.fetch(API + "?verseId=" + encodeURIComponent(verseId) + "&v=" + encodeURIComponent(version), {
      credentials: "same-origin", headers: { accept: "application/json" },
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.submitted === true && box.isConnected && !box.getAttribute("data-fb-sent")) {
        remember(verseId, version, "?");
        showDone(box, ALREADY);
      }
    }).catch(function () { /* status is a nicety; submit still dedupes */ });
  }

  function choose(box, btn) {
    var rating = btn.getAttribute("data-fb-rating");
    if (box.getAttribute("data-fb-rating") === rating && box.querySelector(".fb-form")) return;
    box.setAttribute("data-fb-rating", rating);
    var choices = box.querySelectorAll(".fb-choice");
    for (var i = 0; i < choices.length; i++) {
      var on = choices[i] === btn;
      choices[i].setAttribute("aria-pressed", on ? "true" : "false");
      choices[i].setAttribute("aria-expanded", on ? "true" : "false");
    }
    var comment = box.querySelector(".fb-comment");
    var keep = comment ? comment.value : "";
    var old = box.querySelector(".fb-form");
    if (old) old.remove();
    box.insertAdjacentHTML("beforeend", formHtml(rating));
    box.classList.add("is-open");
    if (keep) {
      var c = box.querySelector(".fb-comment");
      c.value = keep;
      updateCount(c);
    }
    checkStatus(box);
  }

  function updateCount(textarea) {
    var form = textarea.closest(".fb-form");
    var count = form && form.querySelector(".fb-count");
    if (!count) return;
    var n = textarea.value.length;
    count.textContent = n + " / " + MAX_COMMENT;
    count.classList.toggle("is-near", n >= MAX_COMMENT - 50);
  }

  function setStatus(form, text, isError) {
    var s = form.querySelector(".fb-status");
    if (!s) return;
    s.textContent = text || "";
    s.classList.toggle("is-error", !!isError);
  }

  function submit(box, form) {
    if (box.getAttribute("data-fb-busy")) return;
    var body = payloadFrom(box);
    if (!body.rating) return;
    var btn = form.querySelector(".fb-submit");
    box.setAttribute("data-fb-busy", "1");
    form.setAttribute("aria-busy", "true");
    btn.disabled = true;
    btn.textContent = "Sending…";
    setStatus(form, "", false);
    var done = function (status, data) {
      box.removeAttribute("data-fb-busy");
      form.removeAttribute("aria-busy");
      var code = data && data.error;
      if (status === 201 || status === 200) {
        box.setAttribute("data-fb-sent", "1");
        remember(body.verseId, body.explanationVersion, body.rating);
        box.setAttribute("data-fb-focus", "1");
        showDone(box, THANKS);
        return;
      }
      if (status === 409 && code === "already_submitted") {
        remember(body.verseId, body.explanationVersion, "?");
        box.setAttribute("data-fb-focus", "1");
        showDone(box, ALREADY);
        return;
      }
      btn.disabled = false;
      btn.textContent = "Send feedback";
      setStatus(form, ERRORS[code] || ERRORS.generic, true);
    };
    if (!global.fetch) return done(0, null);
    var ctrl = global.AbortController ? new global.AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
    var headers = { "content-type": "application/json", accept: "application/json" };
    var token = accessToken();
    if (token) headers.authorization = "Bearer " + token;
    global.fetch(API, {
      method: "POST",
      credentials: "same-origin",
      headers: headers,
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) { done(r.status, d); });
    }).catch(function () { done(0, null); }).then(function () { clearTimeout(timer); });
  }

  /* —— Delegated events (installed once) —— */
  function onClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest(".fb-choice") : null;
    if (!btn) return;
    var box = btn.closest(".fb[data-fb-verse]");
    if (!box || box.getAttribute("data-fb-busy")) return;
    choose(box, btn);
  }
  function onSubmit(e) {
    var form = e.target;
    if (!form || !form.classList || !form.classList.contains("fb-form")) return;
    e.preventDefault();
    var box = form.closest(".fb[data-fb-verse]");
    if (box) submit(box, form);
  }
  function onInput(e) {
    if (e.target && e.target.classList && e.target.classList.contains("fb-comment")) updateCount(e.target);
  }

  if (global.document && global.document.addEventListener) {
    global.document.addEventListener("click", onClick);
    global.document.addEventListener("submit", onSubmit);
    global.document.addEventListener("input", onInput);
    var start = function () { hydrate(global.document); };
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", start);
    else start();
  }

  global.HPDFeedback = {
    html: html,
    hydrate: hydrate,
    wasSubmitted: wasSubmitted,
    _test: { CATEGORIES: CATEGORIES, payloadFrom: payloadFrom, formHtml: formHtml, innerHtml: innerHtml, remember: remember, THANKS: THANKS, ALREADY: ALREADY, ERRORS: ERRORS },
  };
})(typeof window !== "undefined" ? window : globalThis);
