/**
 * Shared UI helpers: Latin cross icon, favorite button, promise cards, header auth nav.
 */
(function (global) {
  "use strict";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Simple Latin cross SVG. outline = unselected; filled = selected/emphasized.
   * @param {boolean} filled
   */
  function crossIconSvg(filled) {
    // Bold Latin cross — reads as a clear tap target, not decoration
    if (filled) {
      return (
        '<svg class="cross-icon cross-icon--filled" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M9.5 2.5h5v5.5H21v5h-6.5V21.5h-5V13H3v-5h6.5V2.5z"/>' +
        "</svg>"
      );
    }
    return (
      '<svg class="cross-icon cross-icon--outline" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" fill-opacity="0.22" d="M9.5 2.5h5v5.5H21v5h-6.5V21.5h-5V13H3v-5h6.5V2.5z"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="2.25" stroke-linejoin="round" ' +
      'd="M9.5 2.5h5v5.5H21v5h-6.5V21.5h-5V13H3v-5h6.5V2.5z"/>' +
      "</svg>"
    );
  }

  /**
   * @param {string} promiseId
   * @param {boolean} isFav
   */
  function favoriteButtonHtml(promiseId, isFav) {
    const pressed = isFav ? "true" : "false";
    const label = isFav ? "Remove favorite" : "Save favorite";
    const short = isFav ? "Saved" : "Save";
    return (
      `<button type="button" class="favorite-btn" data-favorite-id="${escapeHtml(
        promiseId
      )}" aria-pressed="${pressed}" aria-label="${label}" title="${label}">` +
      `<span class="favorite-btn-icon">${crossIconSvg(!!isFav)}</span>` +
      `<span class="favorite-btn-label">${short}</span>` +
      `</button>`
    );
  }


  /* —— Explanation: one short original summary per promise —— */
  const EXPLAIN_VERSION = "unified-1"; // data unchanged; keep cache key
  let explainData = null;
  let explainPromise = null;

  function loadExplanations() {
    if (!explainPromise) {
      explainPromise = fetch("data/explanations.json?v=" + EXPLAIN_VERSION)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}))
        .then((d) => {
          explainData = d || {};
          fillExplanations(document);
          return explainData;
        });
    }
    return explainPromise;
  }

  function fillExplanations(root) {
    if (!explainData || !root || !root.querySelectorAll) return;
    root.querySelectorAll(".card-explain[data-explain-pending]").forEach((box) => {
      const text = explainData[box.getAttribute("data-explain-id")];
      box.removeAttribute("data-explain-pending");
      box.classList.remove("is-loading");
      const t = box.querySelector(".card-explain-text");
      if (text && t) t.textContent = text;
      else box.remove();
    });
  }

  function explainHtml(p) {
    if (!p || !p.id) return "";
    const ready = !!explainData;
    const text = ready ? explainData[p.id] || "" : "";
    if (ready && !text) return "";
    if (!ready) loadExplanations();
    return (
      `<div class="card-explain${ready ? "" : " is-loading"}" data-explain-id="${escapeHtml(p.id)}"` +
      `${ready ? "" : " data-explain-pending"}>` +
      `<p class="card-explain-text">${escapeHtml(text)}</p>` +
      `</div>`
    );
  }

  if (typeof document !== "undefined") {
    const start = () => {
      const kick = () => loadExplanations();
      if ("requestIdleCallback" in global) global.requestIdleCallback(kick, { timeout: 1200 });
      else setTimeout(kick, 200);
    };
    if (document.readyState === "complete") start();
    else global.addEventListener("load", start);
  }

  /**
   * @param {object} p promise
   * @param {{ interactiveTags?: boolean }} [opts]
   */
  function renderPromiseCard(p, opts) {
    const interactiveTags = !opts || opts.interactiveTags !== false;
    const favs = global.GodsPromisesFavorites;
    const isFav = favs && favs.isFavorite ? favs.isFavorite(p.id) : false;
    const relevanceLabel = opts && opts.relevanceLabel;

    const themeTags = (p.themes || [])
      .map((t) => {
        if (interactiveTags) {
          return `<li><button type="button" class="tag" data-theme="${escapeHtml(
            t
          )}" title="Filter by theme ${escapeHtml(t)}">${escapeHtml(
            t
          )}</button></li>`;
        }
        return `<li><span class="tag tag-static">${escapeHtml(t)}</span></li>`;
      })
      .join("");

    const feelingTags = (p.feelings || [])
      .map((f) => {
        if (interactiveTags) {
          return `<li><button type="button" class="tag tag-feeling" data-feeling="${escapeHtml(
            f
          )}" title="Filter by feeling ${escapeHtml(f)}">${escapeHtml(
            f
          )}</button></li>`;
        }
        return `<li><span class="tag tag-feeling tag-static">${escapeHtml(
          f
        )}</span></li>`;
      })
      .join("");

    const tagsBlock =
      feelingTags || themeTags
        ? `<ul class="card-tags" aria-label="Feelings and themes">${feelingTags}${themeTags}</ul>`
        : "";

    const badge = relevanceLabel
      ? `<span class="relevance-badge" title="Among the most popular verses for this search">${escapeHtml(relevanceLabel)}</span>`
      : "";

    return `
      <li class="card${relevanceLabel ? " card--relevant" : ""}" data-id="${escapeHtml(p.id)}">
        <div class="card-top">
          <div class="card-ref-wrap">
            <h3 class="card-ref">${escapeHtml(p.reference)}</h3>
            ${badge}
          </div>
          ${favoriteButtonHtml(p.id, isFav)}
        </div>
        <blockquote class="card-text">${escapeHtml(p.text)}</blockquote>
        <p class="card-version-note" hidden></p>
        ${explainHtml(p)}
        ${tagsBlock}
      </li>
    `;
  }

  function loginUrl(next) {
    const base = "login.html";
    if (!next) return base;
    return base + "?next=" + encodeURIComponent(next);
  }

  /**
   * Wire favorite buttons inside a root; prompts login when needed.
   * @param {ParentNode} root
   * @param {{ onChange?: function }} [opts]
   */
  function bindFavoriteClicks(root, opts) {
    if (!root) return;
    root.addEventListener("click", async (e) => {
      const btn = e.target.closest(".favorite-btn");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const auth = global.GodsPromisesAuth;
      const favs = global.GodsPromisesFavorites;
      const sub = global.GodsPromisesSubscription;
      const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
      const id = btn.getAttribute("data-favorite-id");
      if (!id) return;

      if (!user) {
        const next =
          (location.pathname.split("/").pop() || "index.html") +
          location.search +
          location.hash;
        location.href = loginUrl(next === "login.html" ? "me.html" : next);
        return;
      }

      if (sub && !sub.canAccessFavorites(user)) {
        location.href = "me.html#upgrade";
        return;
      }

      try {
        const result = await favs.toggle(id);
        const pressed = !!result.favorited;
        btn.setAttribute("aria-pressed", pressed ? "true" : "false");
        const label = pressed ? "Remove favorite" : "Save favorite";
        btn.setAttribute("aria-label", label);
        btn.title = label;
        btn.innerHTML =
          `<span class="favorite-btn-icon">${crossIconSvg(pressed)}</span>` +
          `<span class="favorite-btn-label">${pressed ? "Saved" : "Save"}</span>`;
        if (opts && typeof opts.onChange === "function") opts.onChange(id, pressed);
      } catch (err) {
        if (err && err.code === "AUTH_REQUIRED") {
          location.href = loginUrl("me.html");
          return;
        }
        if (err && err.code === "SUBSCRIPTION_REQUIRED") {
          location.href = "me.html#upgrade";
          return;
        }
        console.error(err);
      }
    });
  }

  /**
   * Update header auth controls (.js-auth-nav).
   */
  function refreshAuthNav() {
    const nav = document.querySelector(".js-auth-nav");
    if (!nav) return;
    const auth = global.GodsPromisesAuth;
    const user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;

    if (user) {
      const name = escapeHtml(user.displayName || user.email);
      nav.innerHTML = `
        <a class="nav-link" href="me.html">My favorites</a>
        <span class="nav-user" title="${escapeHtml(user.email)}">${name}</span>
        <a class="nav-link nav-link-muted" href="login.html">Account</a>
      `;
    } else {
      nav.innerHTML = `
        <a class="nav-link" href="login.html">Sign in</a>
      `;
    }
  }

  function initAuthNav() {
    refreshAuthNav();
    const auth = global.GodsPromisesAuth;
    if (auth && auth.onAuthChange) {
      auth.onAuthChange(refreshAuthNav);
    }
  }


  /* —— Reading deck: one card at a time, swipe / arrows / keys —— */

  function formatCount(n) {
    try {
      return Number(n).toLocaleString("en-US");
    } catch (e) {
      return String(n);
    }
  }

  function defaultIsTypingTarget(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return !!el.isContentEditable;
  }

  function prefersReducedMotion() {
    return !!(
      global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  const DECK_DURATION = 320;
  const DECK_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

  /**
   * One reading deck per host element. Listeners are bound once at creation;
   * show() swaps the list (search results, favorites, daily days) without
   * re-binding, and go() animates exactly one step at a time. Input that
   * arrives mid-transition is queued (at most one pending step), so rapid
   * clicks, keys or swipes can never skip or duplicate a card.
   *
   * @param {HTMLElement} host
   * @param {{ isTypingTarget?: (el: EventTarget|null) => boolean }} [hostOpts]
   */
  function createReadingDeck(host, hostOpts) {
    const isTypingTarget =
      (hostOpts && hostOpts.isTypingTarget) || defaultIsTypingTarget;
    const ignoreSel =
      ".favorite-btn, .tag, .reading-nav, a, input, select, textarea, label";

    let cfg = null;
    let index = 0;
    let count = 0;
    let animating = false;
    let queued = 0;
    let parts = null;
    let currentAnims = [];

    // Drag state
    let drag = null;
    let suppressClick = false;

    function connected() {
      return !!(parts && parts.stage && parts.stage.isConnected && host.contains(parts.stage));
    }

    function buildShell() {
      const stageClass = cfg.stageClass ? " " + cfg.stageClass : "";
      const L = cfg.labels || {};
      host.innerHTML =
        `<div class="reading-stage${stageClass}">` +
        `<div class="reading-chrome">` +
        `<button type="button" class="reading-nav reading-nav--prev" aria-label="${escapeHtml(L.prevAria || "Previous promise")}">` +
        `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
        `<span class="reading-nav-label">${escapeHtml(L.prev || "Previous")}</span>` +
        `</button>` +
        `<div class="reading-progress">` +
        `<p class="reading-position" aria-hidden="true"></p>` +
        `<div class="reading-meter" aria-hidden="true"><span class="reading-meter-fill"></span></div>` +
        `</div>` +
        `<button type="button" class="reading-nav reading-nav--next" aria-label="${escapeHtml(L.nextAria || "Next promise")}">` +
        `<span class="reading-nav-label">${escapeHtml(L.next || "Next")}</span>` +
        `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
        `</button>` +
        `</div>` +
        `<p class="sr-only reading-live" aria-live="polite" aria-atomic="true"></p>` +
        `<div class="reading-viewport" tabindex="0" role="region" aria-roledescription="carousel" aria-label="${escapeHtml(L.viewport || "Promise cards")}">` +
        `<div class="deck-peek deck-peek--prev" aria-hidden="true"></div>` +
        `<div class="deck-peek deck-peek--next" aria-hidden="true"></div>` +
        `<ul class="results results--single deck-track"></ul>` +
        `</div>` +
        `<p class="reading-hint"></p>` +
        `</div>`;
      const stage = host.firstElementChild;
      parts = {
        stage,
        prev: stage.querySelector(".reading-nav--prev"),
        next: stage.querySelector(".reading-nav--next"),
        position: stage.querySelector(".reading-position"),
        meter: stage.querySelector(".reading-meter-fill"),
        live: stage.querySelector(".reading-live"),
        viewport: stage.querySelector(".reading-viewport"),
        track: stage.querySelector(".deck-track"),
        peekPrev: stage.querySelector(".deck-peek--prev"),
        peekNext: stage.querySelector(".deck-peek--next"),
        hint: stage.querySelector(".reading-hint"),
      };
      host.classList.add("results-host--reading");
    }

    function cardElement(i) {
      const tmp = document.createElement("ul");
      tmp.innerHTML = String(cfg.renderCard(i) || "").trim();
      const li = tmp.firstElementChild;
      if (!li) return document.createElement("li");
      li.classList.add("card--reading", "deck-card");
      li.setAttribute("role", "group");
      li.setAttribute("aria-roledescription", "slide");
      li.setAttribute("aria-label", formatCount(i + 1) + " of " + formatCount(count));
      return li;
    }

    function positionInfo(i) {
      if (cfg.position) return cfg.position(i, count);
      const label = formatCount(i + 1) + " of " + formatCount(count);
      return { html: escapeHtml(label), label: label };
    }

    function syncChrome(announce) {
      if (!parts) return;
      const info = positionInfo(index);
      parts.position.innerHTML = info.html;
      const pct = count > 1 ? (index / (count - 1)) * 100 : 100;
      parts.meter.style.width = Math.max(2, pct).toFixed(2) + "%";
      const canPrev = index > 0;
      const canNext = index < count - 1;
      const active = document.activeElement;
      parts.prev.disabled = !canPrev;
      parts.next.disabled = !canNext;
      // Keep keyboard focus alive when a focused arrow reaches a boundary.
      if (active && active.disabled && (active === parts.prev || active === parts.next)) {
        const other = active === parts.prev ? parts.next : parts.prev;
        (other.disabled ? parts.viewport : other).focus({ preventScroll: true });
      }
      parts.peekPrev.classList.toggle("is-on", canPrev);
      parts.peekNext.classList.toggle("is-on", canNext);
      const hint = cfg.hint ? cfg.hint(index, count) : "Swipe or use the arrows";
      parts.hint.textContent = hint || "";
      parts.hint.hidden = !hint;
      if (announce) {
        const card = parts.track.querySelector(".deck-card:not(.is-leaving)");
        const ref = card && card.querySelector(".card-ref");
        parts.live.textContent = info.label + (ref ? ": " + ref.textContent : "");
      }
    }

    function hydrate(li) {
      if (cfg.afterPaint) cfg.afterPaint(li, index);
    }

    function stopAnims() {
      currentAnims.forEach((a) => {
        try {
          a.cancel();
        } catch (e) {
          /* ignore */
        }
      });
      currentAnims = [];
    }

    /** Paint the current card without animation (list changed, version switched…). */
    function paintStatic() {
      stopAnims();
      animating = false;
      queued = 0;
      parts.viewport.style.height = "";
      parts.track.innerHTML = "";
      const li = cardElement(index);
      parts.track.appendChild(li);
      syncChrome(false);
      hydrate(li);
    }

    /**
     * @param {{
     *   count: number, index?: number, renderCard: (i:number)=>string,
     *   afterPaint?: (li:HTMLElement, i:number)=>void,
     *   position?: (i:number, n:number)=>{html:string,label:string},
     *   hint?: (i:number, n:number)=>string,
     *   onIndexChange?: (i:number)=>void,
     *   labels?: object, stageClass?: string, key?: string
     * }} next
     */
    function show(next) {
      const sameShell =
        cfg && next && cfg.key === next.key && cfg.stageClass === next.stageClass && connected();
      cfg = next;
      count = Math.max(0, next.count | 0);
      index = Math.max(0, Math.min(next.index | 0, count - 1));
      if (!count) return;
      if (!sameShell) buildShell();
      paintStatic();
    }

    function setBusy(on) {
      if (parts) parts.stage.classList.toggle("is-animating", !!on);
    }

    function finishStep() {
      animating = false;
      setBusy(false);
      if (queued) {
        const q = queued;
        queued = 0;
        go(q);
      }
    }

    /** Gentle "end of deck" cue — a few pixels, no bounce. */
    function nudge(dir, fromX) {
      const li = parts && parts.track.querySelector(".deck-card");
      if (!li) return;
      if (prefersReducedMotion() || !li.animate) {
        li.style.transform = "";
        li.style.opacity = "";
        return;
      }
      const start = typeof fromX === "number" ? fromX : dir * -10;
      const a = li.animate(
        [{ transform: `translateX(${start}px)` }, { transform: "translateX(0)" }],
        { duration: 220, easing: DECK_EASE }
      );
      li.style.transform = "";
      li.style.opacity = "";
      currentAnims.push(a);
    }

    /**
     * Move one card. dir = +1 next, -1 previous.
     * @param {number} dir
     * @param {{ fromX?: number }} [o] drag offset to continue from
     */
    function go(dir, o) {
      if (!cfg || !count || !connected()) return false;
      dir = dir > 0 ? 1 : -1;
      if (animating) {
        queued = dir; // keep only the latest intent, one step
        return true;
      }
      const target = index + dir;
      if (target < 0 || target >= count) {
        nudge(dir, o && o.fromX);
        return false;
      }

      const viewport = parts.viewport;
      const track = parts.track;
      const outgoing = track.querySelector(".deck-card:not(.is-leaving)");
      const reduce = prefersReducedMotion();
      const canAnimate = !!(outgoing && outgoing.animate);

      index = target;
      const incoming = cardElement(index);

      if (!canAnimate) {
        track.innerHTML = "";
        track.appendChild(incoming);
        syncChrome(true);
        hydrate(incoming);
        if (cfg.onIndexChange) cfg.onIndexChange(index);
        return true;
      }

      animating = true;
      setBusy(true);
      const oldH = viewport.offsetHeight;
      const fromX = o && typeof o.fromX === "number" ? o.fromX : 0;
      const fromOpacity = outgoing.style.opacity ? parseFloat(outgoing.style.opacity) : 1;

      // Pin the outgoing card where it is, then let the incoming take the flow.
      outgoing.classList.add("is-leaving");
      outgoing.setAttribute("aria-hidden", "true");
      outgoing.style.transform = "";
      outgoing.style.opacity = "";
      outgoing.inert = true;
      track.appendChild(incoming);
      syncChrome(true);
      hydrate(incoming);
      if (cfg.onIndexChange) cfg.onIndexChange(index);

      const newH = viewport.offsetHeight;
      const w = Math.max(viewport.clientWidth, 240);
      const dist = Math.round(w * 0.62);
      const D = reduce ? 180 : DECK_DURATION;
      const anims = [];

      if (reduce) {
        anims.push(
          outgoing.animate([{ opacity: fromOpacity }, { opacity: 0 }], {
            duration: D,
            easing: "linear",
            fill: "forwards",
          })
        );
        anims.push(
          incoming.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D, easing: "linear" })
        );
      } else {
        anims.push(
          outgoing.animate(
            [
              { transform: `translateX(${fromX}px) scale(1)`, opacity: fromOpacity },
              { transform: `translateX(${-dir * dist}px) scale(0.94)`, opacity: 0 },
            ],
            { duration: D, easing: DECK_EASE, fill: "forwards" }
          )
        );
        anims.push(
          incoming.animate(
            [
              { transform: `translateX(${dir * dist}px) scale(0.94)`, opacity: 0 },
              { transform: "translateX(0) scale(1)", opacity: 1 },
            ],
            { duration: D, easing: DECK_EASE }
          )
        );
        if (Math.abs(newH - oldH) > 2) {
          anims.push(
            viewport.animate([{ height: oldH + "px" }, { height: newH + "px" }], {
              duration: D,
              easing: DECK_EASE,
            })
          );
        }
      }
      currentAnims = anims;
      Promise.all(anims.map((a) => a.finished.catch(() => null))).then(() => {
        if (outgoing.isConnected) outgoing.remove();
        currentAnims = [];
        finishStep();
      });
      return true;
    }

    /* —— Pointer: axis-locked horizontal drag; vertical stays native scroll —— */

    function cardNow() {
      return parts ? parts.track.querySelector(".deck-card:not(.is-leaving)") : null;
    }

    function onPointerDown(e) {
      if (!connected() || !parts.viewport.contains(e.target)) return;
      if (e.button != null && e.button !== 0) return;
      if (e.isPrimary === false) return;
      if (animating) return;
      if (e.target.closest && e.target.closest(ignoreSel)) return;
      drag = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        dx: 0,
        axis: "",
        samples: [{ x: e.clientX, t: e.timeStamp }],
      };
    }

    function dragOffset(dx) {
      const atStart = index <= 0 && dx > 0;
      const atEnd = index >= count - 1 && dx < 0;
      if (atStart || atEnd) return dx * 0.22; // firm resistance at the ends
      return dx;
    }

    function onPointerMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.2) {
          drag.axis = "x";
          try {
            parts.viewport.setPointerCapture(e.pointerId);
          } catch (err) {
            /* ignore */
          }
          parts.stage.classList.add("is-dragging");
        } else {
          drag = null; // vertical intent: leave it to the page scroll
          return;
        }
      }
      if (drag.axis !== "x") return;
      if (e.cancelable) e.preventDefault();
      drag.dx = dx;
      drag.samples.push({ x: e.clientX, t: e.timeStamp });
      if (drag.samples.length > 6) drag.samples.shift();
      const li = cardNow();
      if (!li) return;
      const off = dragOffset(dx);
      const w = Math.max(parts.viewport.clientWidth, 240);
      const fade = Math.min(Math.abs(off) / w, 1) * 0.35;
      li.style.transform = `translateX(${off}px)`;
      li.style.opacity = String(1 - fade);
      parts.stage.classList.toggle("is-pulling-next", off < 0);
      parts.stage.classList.toggle("is-pulling-prev", off > 0);
    }

    function endDrag(e, cancelled) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const d = drag;
      drag = null;
      parts.stage.classList.remove("is-dragging", "is-pulling-next", "is-pulling-prev");
      if (d.axis !== "x") return;
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
      const li = cardNow();
      const off = dragOffset(d.dx);
      const w = Math.max(parts.viewport.clientWidth, 240);
      const s = d.samples;
      let v = 0;
      if (s.length > 1) {
        const a = s[0];
        const b = s[s.length - 1];
        v = (b.x - a.x) / Math.max(b.t - a.t, 1);
      }
      const dir = d.dx < 0 ? 1 : -1;
      const far = Math.abs(d.dx) > Math.min(w * 0.22, 110);
      const flick = Math.abs(d.dx) > 28 && Math.abs(v) > 0.45 && Math.sign(v) === Math.sign(d.dx);
      const target = index + dir;
      if (!cancelled && (far || flick) && target >= 0 && target < count) {
        go(dir, { fromX: off });
        return;
      }
      // Settle back to centre.
      if (li) {
        const from = li.style.transform || "translateX(0)";
        const fromO = li.style.opacity || "1";
        li.style.transform = "";
        li.style.opacity = "";
        if (li.animate && !prefersReducedMotion() && Math.abs(off) > 1) {
          currentAnims.push(
            li.animate(
              [
                { transform: from, opacity: fromO },
                { transform: "translateX(0)", opacity: 1 },
              ],
              { duration: 220, easing: DECK_EASE }
            )
          );
        }
      }
    }

    function onPointerUp(e) {
      endDrag(e, false);
    }

    function onPointerCancel(e) {
      endDrag(e, true);
    }

    function onClick(e) {
      if (!connected()) return;
      if (suppressClick && parts.viewport.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const prev = e.target.closest(".reading-nav--prev");
      const next = e.target.closest(".reading-nav--next");
      if (prev && parts.stage.contains(prev)) {
        e.preventDefault();
        go(-1);
      } else if (next && parts.stage.contains(next)) {
        e.preventDefault();
        go(1);
      }
    }

    function onKeyDown(e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!connected() || !count) return;
      if (isTypingTarget(e.target)) return;
      const t = e.target;
      // Leave arrow keys alone inside other composite widgets.
      if (t && t.closest && t.closest('[role="tablist"], [role="radiogroup"], [role="listbox"], [role="menu"]')) return;
      e.preventDefault();
      go(e.key === "ArrowLeft" ? -1 : 1);
    }

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove, { passive: false });
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerCancel);
    host.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown);

    return {
      show,
      go,
      next: () => go(1),
      prev: () => go(-1),
      getIndex: () => index,
      getCount: () => count,
      isAnimating: () => animating,
      /** Re-render the current card in place (e.g. after a Bible-version change). */
      refresh: () => {
        if (cfg && count && connected()) paintStatic();
      },
      /** Host content replaced by something else (empty state). */
      reset: () => {
        stopAnims();
        animating = false;
        queued = 0;
        drag = null;
        parts = null;
        cfg = null;
        count = 0;
        host.classList.remove("results-host--reading");
      },
      destroy: () => {
        stopAnims();
        host.removeEventListener("pointerdown", onPointerDown);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerup", onPointerUp);
        host.removeEventListener("pointercancel", onPointerCancel);
        host.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKeyDown);
      },
    };
  }

  global.GodsPromisesUI = {
    escapeHtml,
    crossIconSvg,
    favoriteButtonHtml,
    renderPromiseCard,
    loadExplanations,
    bindFavoriteClicks,
    refreshAuthNav,
    initAuthNav,
    loginUrl,
    createReadingDeck,
    formatCount,
  };
})(typeof window !== "undefined" ? window : globalThis);
