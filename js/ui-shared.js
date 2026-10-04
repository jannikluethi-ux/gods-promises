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
      ? `<span class="relevance-badge" title="Ranked highly for your search">${escapeHtml(relevanceLabel)}</span>`
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
        <p class="card-promise">${escapeHtml(p.promise)}</p>
        <blockquote class="card-text">${escapeHtml(p.text)}</blockquote>
        <p class="card-context">${escapeHtml(p.context)}</p>
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


  /**
   * Bind pointer swipe, quiet prev/next buttons, and arrow keys for a reading deck.
   * Gestures that start on favorite/tag/controls do not navigate.
   * @param {HTMLElement} root
   * @param {{
   *   onPrev: () => void,
   *   onNext: () => void,
   *   isTypingTarget?: (el: EventTarget|null) => boolean,
   *   threshold?: number
   * }} opts
   * @returns {{ destroy: () => void }}
   */
  function bindReadingDeck(root, opts) {
    if (!root || !opts) return { destroy: function () {} };
    const onPrev = opts.onPrev;
    const onNext = opts.onNext;
    const threshold = typeof opts.threshold === "number" ? opts.threshold : 48;
    const ignoreSel =
      ".favorite-btn, .tag, .reading-nav, button, a, input, select, textarea, label";
    const isTypingTarget =
      opts.isTypingTarget ||
      function (el) {
        if (!el || !el.tagName) return false;
        const tag = el.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        return !!el.isContentEditable;
      };

    let tracking = false;
    let ignored = false;
    let startX = 0;
    let startY = 0;
    let pointerId = null;

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest(ignoreSel)) {
        ignored = true;
        tracking = false;
        return;
      }
      ignored = false;
      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
      pointerId = e.pointerId;
      try {
        root.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      root.classList.add("is-dragging");
    }

    function onPointerUp(e) {
      if (!tracking || ignored) {
        tracking = false;
        ignored = false;
        root.classList.remove("is-dragging");
        return;
      }
      if (pointerId != null && e.pointerId !== pointerId) return;
      tracking = false;
      root.classList.remove("is-dragging");
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.15) {
        return;
      }
      if (dx < 0) onNext();
      else onPrev();
    }

    function onPointerCancel() {
      tracking = false;
      ignored = false;
      root.classList.remove("is-dragging");
    }

    function onClickNav(e) {
      const prev = e.target.closest(".reading-nav--prev");
      if (prev) {
        e.preventDefault();
        onPrev();
        return;
      }
      const next = e.target.closest(".reading-nav--next");
      if (next) {
        e.preventDefault();
        onNext();
      }
    }

    function onKeyDown(e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isTypingTarget(e.target)) return;
      const active = document.activeElement;
      const inDeck = !active || active === document.body || active === document.documentElement || root.contains(active);
      if (!inDeck) return;
      e.preventDefault();
      if (e.key === "ArrowLeft") onPrev();
      else onNext();
    }

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerCancel);
    root.addEventListener("click", onClickNav);
    document.addEventListener("keydown", onKeyDown);

    return {
      destroy: function () {
        root.removeEventListener("pointerdown", onPointerDown);
        root.removeEventListener("pointerup", onPointerUp);
        root.removeEventListener("pointercancel", onPointerCancel);
        root.removeEventListener("click", onClickNav);
        document.removeEventListener("keydown", onKeyDown);
      },
    };
  }

  /**
   * Shell HTML for one-at-a-time reading UI.
   * @param {{ positionLabel: string, cardHtml: string, canPrev: boolean, canNext: boolean, listClass?: string }} opts
   */
  function readingDeckHtml(opts) {
    const pos = escapeHtml(opts.positionLabel || "");
    const listClass = opts.listClass || "results results--single";
    const prevDisabled = opts.canPrev ? "" : " disabled";
    const nextDisabled = opts.canNext ? "" : " disabled";
    return (
      `<div class="reading-stage">` +
      `<div class="reading-chrome">` +
      `<button type="button" class="reading-nav reading-nav--prev" aria-label="Previous promise"${prevDisabled}>` +
      `<span aria-hidden="true">‹</span><span class="reading-nav-label">Prev</span>` +
      `</button>` +
      `<p class="reading-position" aria-live="polite">${pos}</p>` +
      `<button type="button" class="reading-nav reading-nav--next" aria-label="Next promise"${nextDisabled}>` +
      `<span class="reading-nav-label">Next</span><span aria-hidden="true">›</span>` +
      `</button>` +
      `</div>` +
      `<div class="reading-viewport" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Promise reading cards">` +
      `<ul class="${listClass}">${opts.cardHtml || ""}</ul>` +
      `</div>` +
      `<p class="reading-hint">Swipe or use arrows</p>` +
      `</div>`
    );
  }

  global.GodsPromisesUI = {
    escapeHtml,
    crossIconSvg,
    favoriteButtonHtml,
    renderPromiseCard,
    bindFavoriteClicks,
    refreshAuthNav,
    initAuthNav,
    loginUrl,
    bindReadingDeck,
    readingDeckHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
