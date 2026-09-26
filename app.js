(function () {
  "use strict";

  const data = window.GODS_PROMISES_DATA;
  if (!data || !Array.isArray(data.promises)) {
    document.getElementById("results").innerHTML =
      '<div class="empty" role="status"><h2>Data missing</h2><p>Could not load promises. Ensure promises-data.js is present.</p></div>';
    return;
  }

  const promises = data.promises;
  const FEATURED_THEMES = [
    "covenant",
    "presence",
    "protection",
    "provision",
    "fear",
    "hope",
    "offspring",
    "land",
    "blessing",
    "faithfulness",
    "forgiveness",
    "salvation",
    "peace",
    "strength",
    "comfort",
    "new-beginning",
    "eternal-life",
    "guidance",
    "restoration",
    "victory",
    "healing",
    "wisdom",
  ];

  const FEATURED_FEELINGS = Array.isArray(data.feelingsVocabulary)
    ? data.feelingsVocabulary
    : [
        "angry",
        "anxious",
        "afraid",
        "lonely",
        "sad",
        "guilty",
        "hopeless",
        "weary",
        "happy",
        "grateful",
        "peaceful",
        "hopeful",
        "loved",
        "confused",
        "bitter",
        "jealous",
      ];

  const el = {
    search: document.getElementById("search"),
    clear: document.getElementById("clear-search"),
    book: document.getElementById("book-filter"),
    theme: document.getElementById("theme-filter"),
    feeling: document.getElementById("feeling-filter"),
    count: document.getElementById("result-count"),
    results: document.getElementById("results"),
  };

  const PAGE_SIZE = 48;
  let visibleLimit = PAGE_SIZE;
  /** @type {object[]} */
  let lastFiltered = [];

  function booksInOrder() {
    const seen = new Set();
    const order = [];
    for (const p of promises) {
      if (!seen.has(p.book)) {
        seen.add(p.book);
        order.push(p.book);
      }
    }
    return order;
  }

  function themeUniverse() {
    const counts = new Map();
    for (const p of promises) {
      for (const t of p.themes || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    const featured = FEATURED_THEMES.filter((t) => counts.has(t));
    const rest = [...counts.keys()]
      .filter((t) => !FEATURED_THEMES.includes(t))
      .sort((a, b) => a.localeCompare(b));
    return [...featured, ...rest];
  }

  function feelingUniverse() {
    const counts = new Map();
    for (const p of promises) {
      for (const f of p.feelings || []) {
        counts.set(f, (counts.get(f) || 0) + 1);
      }
    }
    const featured = FEATURED_FEELINGS.filter(
      (f) => counts.has(f) || FEATURED_FEELINGS.includes(f)
    );
    const rest = [...counts.keys()]
      .filter((f) => !FEATURED_FEELINGS.includes(f))
      .sort((a, b) => a.localeCompare(b));
    // Always show core feelings even if sparse
    const core = FEATURED_FEELINGS.slice();
    const extras = rest.filter((f) => !core.includes(f));
    return [...core, ...extras];
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function haystack(p) {
    return normalize(
      [
        p.reference,
        p.book,
        p.promise,
        p.text,
        p.context,
        ...(p.themes || []),
        ...(p.feelings || []),
        ...(p.searchTerms || []),
      ].join(" ")
    );
  }

  const indexed = promises.map((p) => ({ p, hay: haystack(p) }));

  function tokensFromQuery(q) {
    return normalize(q)
      .split(/[^a-z0-9+-]+/)
      .filter(Boolean);
  }

  /**
   * Filter logic (dropdowns are single-select, like Book):
   * - Book / Theme / Feeling: exact when set
   * - Across types: AND
   * - Text tokens: all must appear in the haystack
   */
  function matches(item, tokens, book, theme, feeling) {
    const { p, hay } = item;
    if (book && p.book !== book) return false;
    if (theme && !(p.themes || []).includes(theme)) return false;
    if (feeling && !(p.feelings || []).includes(feeling)) return false;
    for (const tok of tokens) {
      if (!hay.includes(tok)) return false;
    }
    return true;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderCard(p) {
    const themeTags = (p.themes || [])
      .map(
        (t) =>
          `<li><button type="button" class="tag" data-theme="${escapeHtml(
            t
          )}" title="Filter by theme ${escapeHtml(t)}">${escapeHtml(
            t
          )}</button></li>`
      )
      .join("");

    const feelingTags = (p.feelings || [])
      .map(
        (f) =>
          `<li><button type="button" class="tag tag-feeling" data-feeling="${escapeHtml(
            f
          )}" title="Filter by feeling ${escapeHtml(f)}">${escapeHtml(
            f
          )}</button></li>`
      )
      .join("");

    const tagsBlock =
      feelingTags || themeTags
        ? `<ul class="card-tags" aria-label="Feelings and themes">${feelingTags}${themeTags}</ul>`
        : "";

    return `
      <li class="card" data-id="${escapeHtml(p.id)}">
        <h3 class="card-ref">${escapeHtml(p.reference)}</h3>
        <p class="card-promise">${escapeHtml(p.promise)}</p>
        <blockquote class="card-text">${escapeHtml(p.text)}</blockquote>
        <p class="card-context">${escapeHtml(p.context)}</p>
        ${tagsBlock}
      </li>
    `;
  }

  function resetVisibleLimit() {
    visibleLimit = PAGE_SIZE;
  }

  function render(opts) {
    const preserveLimit = opts && opts.preserveLimit;
    if (!preserveLimit) resetVisibleLimit();

    const tokens = tokensFromQuery(el.search.value);
    const book = el.book.value;
    const theme = el.theme.value;
    const feeling = el.feeling.value;
    const filtered = indexed
      .filter((item) => matches(item, tokens, book, theme, feeling))
      .map((item) => item.p);
    lastFiltered = filtered;

    const n = filtered.length;
    const shown = Math.min(visibleLimit, n);
    const notes = [];
    if (feeling) notes.push(`feeling: ${feeling}`);
    if (theme) notes.push(`theme: ${theme}`);
    if (book) notes.push(`book: ${book}`);
    const noteStr = notes.length ? ` · ${notes.join(" · ")}` : "";
    const rangeStr =
      shown < n ? ` · showing <strong>${shown}</strong>` : "";
    el.count.innerHTML =
      n === 0
        ? `<strong>No matches</strong>${noteStr}`
        : `<strong>${n}</strong> promise${n === 1 ? "" : "s"}${rangeStr}${noteStr}`;

    el.clear.disabled =
      !el.search.value && !book && !theme && !feeling;

    if (n === 0) {
      el.results.innerHTML = `
        <div class="empty" role="status">
          <h2>No promises found</h2>
          <p>Try another feeling or theme, clear search, or choose “All” in the menus.</p>
        </div>`;
      return;
    }

    const slice = filtered.slice(0, shown);
    const moreBtn =
      shown < n
        ? `<div class="load-more-wrap">
            <button type="button" class="load-more" id="load-more">
              Show more (${n - shown} remaining)
            </button>
          </div>`
        : "";

    el.results.innerHTML =
      `<ul class="results">${slice.map(renderCard).join("")}</ul>` + moreBtn;
  }

  function fillSelect(select, emptyLabel, values) {
    const opts = [`<option value="">${escapeHtml(emptyLabel)}</option>`].concat(
      values.map(
        (v) =>
          `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`
      )
    );
    select.innerHTML = opts.join("");
  }

  function initFilters() {
    fillSelect(el.feeling, "All feelings", feelingUniverse());
    fillSelect(el.theme, "All themes", themeUniverse());
    fillSelect(el.book, "All books", booksInOrder());
  }

  function clearAll() {
    el.search.value = "";
    el.book.value = "";
    el.theme.value = "";
    el.feeling.value = "";
    render();
    el.search.focus();
  }

  let debounce;
  el.search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 80);
  });
  el.search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      el.search.value = "";
      render();
    }
  });
  el.clear.addEventListener("click", clearAll);
  el.book.addEventListener("change", render);
  el.theme.addEventListener("change", render);
  el.feeling.addEventListener("change", render);

  el.results.addEventListener("click", (e) => {
    const more = e.target.closest("#load-more, .load-more");
    if (more) {
      visibleLimit += PAGE_SIZE;
      render({ preserveLimit: true });
      return;
    }
    const feelingTag = e.target.closest(".tag-feeling");
    if (feelingTag) {
      el.feeling.value = feelingTag.dataset.feeling || "";
      render();
      return;
    }
    const tag = e.target.closest(".tag");
    if (!tag || !tag.dataset.theme) return;
    el.theme.value = tag.dataset.theme;
    render();
  });

  initFilters();
  render();
})();
