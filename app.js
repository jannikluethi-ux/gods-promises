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

  const el = {
    search: document.getElementById("search"),
    clear: document.getElementById("clear-search"),
    book: document.getElementById("book-filter"),
    themes: document.getElementById("theme-chips"),
    count: document.getElementById("result-count"),
    results: document.getElementById("results"),
  };

  /** @type {Set<string>} */
  const activeThemes = new Set();

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

  function matches(item, tokens, book, themes) {
    const { p, hay } = item;
    if (book && p.book !== book) return false;
    if (themes.size) {
      const set = new Set(p.themes || []);
      for (const t of themes) {
        if (!set.has(t)) return false;
      }
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
    const tags = (p.themes || [])
      .map(
        (t) =>
          `<li><button type="button" class="tag" data-theme="${escapeHtml(
            t
          )}" title="Filter by ${escapeHtml(t)}">${escapeHtml(t)}</button></li>`
      )
      .join("");

    return `
      <li class="card" data-id="${escapeHtml(p.id)}">
        <h3 class="card-ref">${escapeHtml(p.reference)}</h3>
        <p class="card-promise">${escapeHtml(p.promise)}</p>
        <blockquote class="card-text">${escapeHtml(p.text)}</blockquote>
        <p class="card-context">${escapeHtml(p.context)}</p>
        <ul class="card-tags" aria-label="Themes">${tags}</ul>
      </li>
    `;
  }

  function render() {
    const tokens = tokensFromQuery(el.search.value);
    const book = el.book.value;
    const filtered = indexed
      .filter((item) => matches(item, tokens, book, activeThemes))
      .map((item) => item.p);

    const n = filtered.length;
    const themeNote =
      activeThemes.size > 0
        ? ` · themes: ${[...activeThemes].join(", ")}`
        : "";
    el.count.innerHTML =
      n === 0
        ? `<strong>No matches</strong>${themeNote}`
        : `<strong>${n}</strong> promise${n === 1 ? "" : "s"}${themeNote}`;

    el.clear.disabled = !el.search.value && !book && activeThemes.size === 0;

    if (n === 0) {
      el.results.innerHTML = `
        <div class="empty" role="status">
          <h2>No promises found</h2>
          <p>Try a broader word, clear a theme chip, or choose “All books”.</p>
        </div>`;
      return;
    }

    el.results.innerHTML = `<ul class="results">${filtered
      .map(renderCard)
      .join("")}</ul>`;
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

  function toggleTheme(theme) {
    if (activeThemes.has(theme)) activeThemes.delete(theme);
    else activeThemes.add(theme);
    el.themes.querySelectorAll(".chip").forEach((btn) => {
      btn.setAttribute(
        "aria-pressed",
        activeThemes.has(btn.dataset.theme) ? "true" : "false"
      );
    });
    render();
  }

  function clearAll() {
    el.search.value = "";
    el.book.value = "";
    activeThemes.clear();
    el.themes.querySelectorAll(".chip").forEach((btn) => {
      btn.setAttribute("aria-pressed", "false");
    });
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

  el.results.addEventListener("click", (e) => {
    const tag = e.target.closest(".tag");
    if (!tag) return;
    const theme = tag.dataset.theme;
    if (!activeThemes.has(theme)) toggleTheme(theme);
    else render();
  });

  initBooks();
  initThemes();
  render();
})();
