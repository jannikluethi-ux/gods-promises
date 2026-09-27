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
    if (filled) {
      return (
        '<svg class="cross-icon cross-icon--filled" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M10 2h4v6h6v4h-6v10h-4V12H4V8h6V2z"/>' +
        "</svg>"
      );
    }
    return (
      '<svg class="cross-icon cross-icon--outline" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
      '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" ' +
      'd="M10 3h4v5h6v4h-6v9h-4v-9H4V8h6V3z"/>' +
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
    return (
      `<button type="button" class="favorite-btn" data-favorite-id="${escapeHtml(
        promiseId
      )}" aria-pressed="${pressed}" aria-label="${label}" title="${label}">` +
      crossIconSvg(!!isFav) +
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
        btn.innerHTML = crossIconSvg(pressed);
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

  global.GodsPromisesUI = {
    escapeHtml,
    crossIconSvg,
    favoriteButtonHtml,
    renderPromiseCard,
    bindFavoriteClicks,
    refreshAuthNav,
    initAuthNav,
    loginUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
