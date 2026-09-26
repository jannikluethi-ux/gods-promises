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

  /** Core feeling chips — always shown, even if sparse in data */
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
    themes: document.getElementById("theme-chips"),
    feelings: document.getElementById("feeling-chips"),
    count: document.getElementById("result-count"),
    results: document.getElementById("results"),
  };

  /** @type {Set<string>} */
  const activeThemes = new Set();
  /** @type {Set<string>} */
  const activeFeelings = new Set();

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

  // Precompute search blobs
  const indexed = promises.map((p) => ({ p, hay: haystack(p) }));

  function tokensFromQuery(q) {
    return normalize(q)
      .split(/[^a-z0-9+-]+/)
      .filter(Boolean);
  }

  /**
   * Filter logic:
   * - Book: exact match when set
   * - Themes: AND (promise must include every selected theme)
   * - Feelings: OR (promise must include at least one selected feeling)
   * - Across types (book × themes × feelings × text): AND
   * - Text tokens: all must appear in the haystack
   */
  function matches(item, tokens, book, themes, feelings) {
    const { p, hay } = item;
    if (book && p.book !== book) return false;
    if (themes.size) {
      const set = new Set(p.themes || []);
      for (const t of themes) {
        if (!set.has(t)) return false;
      }
    }
    if (feelings.size) {
      const set = new Set(p.feelings || []);
      let any = false;
      for (const f of feelings) {
        if (set.has(f)) {
          any = true;
          break;
        }
      }
      if (!any) return false;
    }
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
    const filtered = indexed
      .filter((item) =>
        matches(item, tokens, book, activeThemes, activeFeelings)
      )
      .map((item) => item.p);
    lastFiltered = filtered;

    const n = filtered.length;
    const shown = Math.min(visibleLimit, n);
    const notes = [];
    if (activeFeelings.size > 0) {
      notes.push(`feelings: ${[...activeFeelings].join(", ")}`);
    }
    if (activeThemes.size > 0) {
      notes.push(`themes: ${[...activeThemes].join(", ")}`);
    }
    const noteStr = notes.length ? ` · ${notes.join(" · ")}` : "";
    const rangeStr =
      n > PAGE_SIZE && shown < n
        ? ` · showing <strong>${shown}</strong>`
        : shown < n
          ? ` · showing <strong>${shown}</strong>`
          : "";
    el.count.innerHTML =
      n === 0
        ? `<strong>No matches</strong>${noteStr}`
        : `<strong>${n}</strong> promise${n === 1 ? "" : "s"}${rangeStr}${noteStr}`;

    el.clear.disabled =
      !el.search.value &&
      !book &&
      activeThemes.size === 0 &&
      activeFeelings.size === 0;

    if (n === 0) {
      el.results.innerHTML = `
        <div class="empty" role="status">
          <h2>No promises found</h2>
          <p>Try a feeling like lonely or anxious, clear a chip, or choose “All books”.</p>
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

  function initBooks() {
    const opts = ['<option value="">All books</option>'].concat(
      booksInOrder().map(
        (b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`
      )
    );
    el.book.innerHTML = opts.join("");
  }

  function initThemes() {
    el.themes.innerHTML = themeUniverse()
      .map((t) => {
        return `<button type="button" class="chip" data-theme="${escapeHtml(
          t
        )}" aria-pressed="false">${escapeHtml(t)}</button>`;
      })
      .join("");
  }

  function initFeelings() {
    if (!el.feelings) return;
    el.feelings.innerHTML = FEATURED_FEELINGS.map((f) => {
      return `<button type="button" class="chip chip-feeling" data-feeling="${escapeHtml(
        f
      )}" aria-pressed="false">${escapeHtml(f)}</button>`;
    }).join("");
  }

  function syncChipPressed(container, attr, activeSet) {
    if (!container) return;
    container.querySelectorAll(".chip").forEach((btn) => {
      const key = btn.dataset[attr];
      btn.setAttribute("aria-pressed", activeSet.has(key) ? "true" : "false");
    });
  }

  function toggleTheme(theme) {
    if (activeThemes.has(theme)) activeThemes.delete(theme);
    else activeThemes.add(theme);
    syncChipPressed(el.themes, "theme", activeThemes);
    render();
  }

  function toggleFeeling(feeling) {
    if (activeFeelings.has(feeling)) activeFeelings.delete(feeling);
    else activeFeelings.add(feeling);
    syncChipPressed(el.feelings, "feeling", activeFeelings);
    render();
  }

  function clearAll() {
    el.search.value = "";
    el.book.value = "";
    activeThemes.clear();
    activeFeelings.clear();
    syncChipPressed(el.themes, "theme", activeThemes);
    syncChipPressed(el.feelings, "feeling", activeFeelings);
    render();
    el.search.focus();
  }

  // Events
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

  el.themes.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    toggleTheme(btn.dataset.theme);
  });

  if (el.feelings) {
    el.feelings.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      toggleFeeling(btn.dataset.feeling);
    });
  }

  el.results.addEventListener("click", (e) => {
    const more = e.target.closest("#load-more, .load-more");
    if (more) {
      visibleLimit += PAGE_SIZE;
      render({ preserveLimit: true });
      return;
    }
    const feelingTag = e.target.closest(".tag-feeling");
    if (feelingTag) {
      const feeling = feelingTag.dataset.feeling;
      if (!activeFeelings.has(feeling)) toggleFeeling(feeling);
      else render();
      return;
    }
    const tag = e.target.closest(".tag");
    if (!tag) return;
    const theme = tag.dataset.theme;
    if (!theme) return;
    if (!activeThemes.has(theme)) toggleTheme(theme);
    else render();
  });

  initBooks();
  initFeelings();
  initThemes();
  render();
})();
