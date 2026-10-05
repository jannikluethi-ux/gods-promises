(function () {
  "use strict";

  const data = window.GODS_PROMISES_DATA;
  if (!data || !Array.isArray(data.promises)) {
    document.getElementById("results").innerHTML =
      '<div class="empty" role="status"><h2>Data missing</h2><p>Could not load promises. Ensure promises-data.js is present.</p></div>';
    return;
  }

  const UI = window.GodsPromisesUI;
  if (UI && UI.initAuthNav) UI.initAuthNav();

  const Smart = window.GodsPromisesSmartSearch;
  const Relevance = window.GodsPromisesRelevance;
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

  const OT_BOOKS = new Set([
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth",
    "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther",
    "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
    "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
    "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
    "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  ]);
  const NT_BOOKS = new Set([
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
  ]);

  const el = {
    search: document.getElementById("search"),
    searchForm: document.getElementById("search-form"),
    searchSubmit: document.getElementById("search-submit"),
    testamentGroup: document.getElementById("testament-options"),
    book: document.getElementById("book-filter"),
    theme: document.getElementById("theme-filter"),
    feeling: document.getElementById("feeling-filter"),
    count: document.getElementById("result-count"),
    resultsMeta: document.getElementById("results-meta"),
    results: document.getElementById("results"),
    filtersToggle: document.getElementById("filters-toggle"),
    filtersPanel: document.getElementById("filters-panel"),
    filtersBadge: document.getElementById("filters-badge"),
    smartGuide: document.getElementById("smart-guide"),
  };

  /* —— Daily verse (changes at midnight Europe/Zurich) —— */

  const DAILY_TZ = "Europe/Zurich";
  /** Short enough to read in one breath on the landing card. */
  const DAILY_MAX_TEXT = 320;
  /** Prime step so consecutive days walk the pool without repeating. */
  const DAILY_STEP = 7919;
  const dailyPool = (function () {
    const short = promises.filter(
      (p) => p && p.text && p.text.length <= DAILY_MAX_TEXT
    );
    return short.length ? short : promises.slice();
  })();

  /** Calendar date in Zurich as "YYYY-MM-DD" (DST handled by Intl). */
  function zurichDateKey(now) {
    const d = now || new Date();
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: DAILY_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const get = (t) => (parts.find((x) => x.type === t) || {}).value;
      return get("year") + "-" + get("month") + "-" + get("day");
    } catch (e) {
      // Very old engines: approximate with CET (UTC+1).
      const z = new Date(d.getTime() + 60 * 60 * 1000);
      return z.toISOString().slice(0, 10);
    }
  }

  function gcd(a, b) {
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  /**
   * Deterministic verse for a Zurich date key: whole days since 1970-01-01
   * times a prime step, modulo the pool. Each new Zurich day gives a
   * different verse until the whole pool has been shown once.
   */
  function dailyPromiseFor(key) {
    const n = dailyPool.length;
    if (!n) return null;
    const [y, m, d] = key.split("-").map(Number);
    const day = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    const step = gcd(DAILY_STEP % n || 1, n) === 1 ? DAILY_STEP % n || 1 : 1;
    const idx = (((day % n) * step) % n + n) % n;
    return dailyPool[idx];
  }

  function dailyDateLabel(key) {
    const [y, m, d] = key.split("-").map(Number);
    try {
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(y, m - 1, d, 12)));
    } catch (e) {
      return key;
    }
  }

  let dailyKeyShown = "";

  /** @type {""|"OT"|"NT"} */
  let activeTestament = "";

  const PAGE_SIZE = 48;
  let visibleLimit = PAGE_SIZE;
  /** Index into lastFiltered for the one-at-a-time reading card. */
  let currentIndex = 0;
  /** @type {object[]} */
  let lastFiltered = [];
  let lastRankedMeta = null;
  /** @type {{ destroy: () => void }|null} */
  let deckBinding = null;

  /**
   * Smart-guide session state.
   * @type {{
   *   queryKey: string,
   *   detection: object|null,
   *   clarification: object|null,
   *   dismissed: boolean,
   *   softFeelingSet: boolean,
   *   previousFeeling: string
   * }}
   */
  let smartState = {
    queryKey: "",
    detection: null,
    clarification: null,
    dismissed: false,
    softFeelingSet: false,
    previousFeeling: "",
  };

  function testamentOf(book) {
    if (OT_BOOKS.has(book)) return "OT";
    if (NT_BOOKS.has(book)) return "NT";
    return "";
  }

  function booksInOrder(testament) {
    const seen = new Set();
    const order = [];
    for (const p of promises) {
      if (testament && testamentOf(p.book) !== testament) continue;
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

  function queryKey(q) {
    return normalize(q).trim().replace(/\s+/g, " ");
  }

  function knownThemesList() {
    return themeUniverse().map((t) => normalize(t));
  }

  function knownFeelingsList() {
    return feelingUniverse().map((f) => normalize(f));
  }

  function currentPlan() {
    if (!Smart) return null;
    const q = el.search.value;
    if (!q.trim()) return null;
    // Use smart plan when we have intent/clarification OR always for stopword stripping
    const clarification =
      smartState.clarification &&
      smartState.queryKey === queryKey(q)
        ? smartState.clarification
        : null;
    const detection = Smart.detectIntent(q, {
      knownThemes: knownThemesList(),
      knownFeelings: knownFeelingsList(),
    });
    if (!detection && !clarification) {
      // Still strip stopwords for plain queries like "I am stressed" leftovers
      const content = Smart.stripStopwords(Smart.tokenize(q));
      if (content.length !== tokensFromQuery(q).length) {
        return {
          intent: null,
          orGroups: [],
          andTokens: content,
          softFeelings: [],
          boostThemes: [],
          boostFeelings: [],
          boostTerms: [],
          statusLabel: "",
          contentTokens: content,
        };
      }
      return null;
    }
    return Smart.buildSearchPlan(q, clarification);
  }

  function matches(item, tokens, testament, book, theme, feeling, plan) {
    const { p, hay } = item;
    if (testament && testamentOf(p.book) !== testament) return false;
    if (book && p.book !== book) return false;
    if (theme && !(p.themes || []).includes(theme)) return false;
    if (feeling && !(p.feelings || []).includes(feeling)) return false;

    if (plan && Smart && (plan.orGroups.length || plan.andTokens.length)) {
      return Smart.matchesPlan(hay, plan);
    }

    for (const tok of tokens) {
      if (!hay.includes(tok)) return false;
    }
    return true;
  }

  function escapeHtml(str) {
    return UI && UI.escapeHtml
      ? UI.escapeHtml(str)
      : String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
  }

  function renderCard(p, meta) {
    const relevanceLabel = meta && meta.relevanceLabel;
    if (UI && UI.renderPromiseCard) {
      return UI.renderPromiseCard(p, {
        interactiveTags: true,
        relevanceLabel: relevanceLabel || "",
      });
    }
    const badge = relevanceLabel
      ? `<span class="relevance-badge">${escapeHtml(relevanceLabel)}</span>`
      : "";
    return `
      <li class="card${relevanceLabel ? " card--relevant" : ""}" data-id="${escapeHtml(p.id)}">
        <div class="card-top">
          <div class="card-ref-wrap">
            <h3 class="card-ref">${escapeHtml(p.reference)}</h3>
            ${badge}
          </div>
        </div>
        <p class="card-promise">${escapeHtml(p.promise)}</p>
        <blockquote class="card-text">${escapeHtml(p.text)}</blockquote>
        <p class="card-context">${escapeHtml(p.context)}</p>
      </li>
    `;
  }

  function resetVisibleLimit() {
    visibleLimit = PAGE_SIZE;
  }

  function resetDeckIndex() {
    currentIndex = 0;
  }

  function ensureSliceForIndex(index) {
    const n = lastFiltered.length;
    while (index >= visibleLimit && visibleLimit < n) {
      visibleLimit = Math.min(visibleLimit + PAGE_SIZE, n);
    }
  }

  function destroyDeckBinding() {
    if (deckBinding && typeof deckBinding.destroy === "function") {
      deckBinding.destroy();
    }
    deckBinding = null;
  }

  function goToIndex(index) {
    const n = lastFiltered.length;
    if (n === 0) return;
    const next = Math.max(0, Math.min(index, n - 1));
    ensureSliceForIndex(next);
    // Approaching end of loaded slice — grow quietly
    if (next >= visibleLimit - 4 && visibleLimit < n) {
      visibleLimit = Math.min(visibleLimit + PAGE_SIZE, n);
    }
    currentIndex = next;
    paintReadingDeck();
  }

  function goPrev() {
    goToIndex(currentIndex - 1);
  }

  function goNext() {
    goToIndex(currentIndex + 1);
  }

  function paintReadingDeck() {
    const n = lastFiltered.length;
    if (n === 0) return;

    if (currentIndex >= n) currentIndex = n - 1;
    if (currentIndex < 0) currentIndex = 0;
    ensureSliceForIndex(currentIndex);

    const p = lastFiltered[currentIndex];
    const meta =
      lastRankedMeta && lastRankedMeta[currentIndex]
        ? {
            relevanceLabel: lastRankedMeta[currentIndex].relevanceLabel || "",
            score: lastRankedMeta[currentIndex].score,
          }
        : null;

    // Mark the single card as a reading card via class on the list item
    let cardHtml = renderCard(p, meta);
    cardHtml = cardHtml.replace(
      'class="card',
      'class="card card--reading'
    );

    const positionLabel = currentIndex + 1 + " of " + n;
    const html =
      UI && UI.readingDeckHtml
        ? UI.readingDeckHtml({
            positionLabel,
            cardHtml,
            canPrev: currentIndex > 0,
            canNext: currentIndex < n - 1,
          })
        : `<ul class="results results--single">${cardHtml}</ul>` +
          `<p class="reading-position">${positionLabel}</p>`;

    destroyDeckBinding();
    el.results.innerHTML = html;
    el.results.classList.add("results-host--reading");
    document.body.classList.add("reading-active");

    if (UI && UI.bindReadingDeck) {
      deckBinding = UI.bindReadingDeck(el.results, {
        onPrev: goPrev,
        onNext: goNext,
        isTypingTarget(target) {
          if (!target || !target.tagName) return false;
          const tag = target.tagName.toLowerCase();
          if (tag === "input" || tag === "textarea" || tag === "select") return true;
          if (target.closest && target.closest("#search, .smart-guide, .filters")) {
            return true;
          }
          return !!target.isContentEditable;
        },
      });
    }
  }

  function softSetFeelingFromPlan(plan) {
    if (!plan || !plan.softFeelings || !plan.softFeelings.length) return;
    if (!el.feeling) return;
    // Don't overwrite an explicit Feeling dropdown the user already chose
    // unless we previously soft-set it from the smart flow.
    if (el.feeling.value && !smartState.softFeelingSet) return;

    const available = [...el.feeling.options].map((o) => o.value);
    const pick = plan.softFeelings.find((f) => available.includes(f));
    if (!pick) return;

    if (!smartState.softFeelingSet) {
      smartState.previousFeeling = el.feeling.value;
    }
    el.feeling.value = pick;
    smartState.softFeelingSet = true;
  }

  function clearSoftFeeling() {
    if (!smartState.softFeelingSet) return;
    if (el.feeling) {
      el.feeling.value = smartState.previousFeeling || "";
    }
    smartState.softFeelingSet = false;
    smartState.previousFeeling = "";
  }

  function updateSmartGuide() {
    if (!el.smartGuide || !Smart) return;

    const q = el.search.value;
    const key = queryKey(q);

    // Reset session when query changes meaningfully
    if (key !== smartState.queryKey) {
      const hadClarification = !!smartState.clarification;
      smartState.queryKey = key;
      smartState.clarification = null;
      smartState.dismissed = false;
      smartState.detection = null;
      if (hadClarification || smartState.softFeelingSet) {
        clearSoftFeeling();
      }
    }

    if (smartState.clarification) {
      // Show status line only
      const plan = Smart.buildSearchPlan(q, smartState.clarification);
      el.smartGuide.hidden = false;
      el.smartGuide.innerHTML = Smart.renderStatusHtml(plan, escapeHtml);
      el.smartGuide.classList.add("smart-guide--status");
      el.smartGuide.classList.remove("smart-guide--ask");
      return;
    }

    if (smartState.dismissed || !key) {
      el.smartGuide.hidden = true;
      el.smartGuide.innerHTML = "";
      el.smartGuide.classList.remove("smart-guide--ask", "smart-guide--status");
      return;
    }

    const detection = Smart.detectIntent(q, {
      knownThemes: knownThemesList(),
      knownFeelings: knownFeelingsList(),
    });
    smartState.detection = detection;

    if (!detection) {
      el.smartGuide.hidden = true;
      el.smartGuide.innerHTML = "";
      el.smartGuide.classList.remove("smart-guide--ask", "smart-guide--status");
      return;
    }

    el.smartGuide.hidden = false;
    el.smartGuide.classList.add("smart-guide--ask");
    el.smartGuide.classList.remove("smart-guide--status");
    el.smartGuide.innerHTML = Smart.renderGuideHtml(detection, escapeHtml);
  }

  function applyClarification(clarification) {
    smartState.clarification = clarification;
    smartState.dismissed = false;
    const plan = Smart
      ? Smart.buildSearchPlan(el.search.value, clarification)
      : null;
    softSetFeelingFromPlan(plan);
    updateSmartGuide();
    render();
    revealScripture();
  }

  function clearGuideKeepQuery() {
    smartState.clarification = null;
    smartState.dismissed = true;
    smartState.detection = null;
    clearSoftFeeling();
    updateSmartGuide();
    render();
  }

  function resetSmartFully() {
    smartState = {
      queryKey: "",
      detection: null,
      clarification: null,
      dismissed: false,
      softFeelingSet: false,
      previousFeeling: "",
    };
    if (el.smartGuide) {
      el.smartGuide.hidden = true;
      el.smartGuide.innerHTML = "";
    }
  }

  function isLanding() {
    return (
      !el.search.value.trim() &&
      !activeTestament &&
      !el.book.value &&
      !el.theme.value &&
      !el.feeling.value
    );
  }

  /** Empty query, no filters: one quiet daily-verse card, nothing else. */
  function paintDailyVerse() {
    const key = zurichDateKey();
    const p = dailyPromiseFor(key);
    destroyDeckBinding();
    lastFiltered = p ? [p] : [];
    lastRankedMeta = null;
    currentIndex = 0;
    dailyKeyShown = key;
    document.body.classList.add("is-landing");
    el.count.innerHTML = "";
    updateFiltersBadge();
    if (!p) {
      el.results.innerHTML = "";
      el.results.classList.remove("results-host--reading");
      document.body.classList.remove("reading-active");
      return;
    }
    let cardHtml = renderCard(p, null);
    cardHtml = cardHtml.replace(
      'class="card',
      'class="card card--reading card--daily'
    );
    el.results.innerHTML =
      `<div class="reading-stage reading-stage--daily">` +
      `<p class="daily-label"><span>Today’s verse</span>` +
      `<span class="daily-date">${escapeHtml(dailyDateLabel(key))}</span></p>` +
      `<ul class="results results--single">${cardHtml}</ul>` +
      `</div>`;
    el.results.classList.add("results-host--reading");
    document.body.classList.add("reading-active");
  }

  /** Swap to the next day’s verse at Zurich midnight if still on the landing. */
  function checkDailyRollover() {
    if (!isLanding()) return;
    if (zurichDateKey() !== dailyKeyShown) paintDailyVerse();
  }

  function render(opts) {
    const preserveLimit = opts && opts.preserveLimit;
    const preserveIndex = opts && opts.preserveIndex;
    if (!preserveLimit) resetVisibleLimit();
    if (!preserveIndex && !preserveLimit) resetDeckIndex();

    updateSmartGuide();

    if (isLanding()) {
      paintDailyVerse();
      return;
    }
    document.body.classList.remove("is-landing");

    const plan = currentPlan();
    const rawTokens = tokensFromQuery(el.search.value);
    // Prefer smart plan tokens (stopwords stripped); else legacy AND tokens
    const tokens = plan
      ? [] // plan handles matching
      : rawTokens;
    const testament = activeTestament;
    const book = el.book.value;
    const theme = el.theme.value;
    const feeling = el.feeling.value;

    let filteredItems = indexed.filter((item) =>
      matches(item, tokens, testament, book, theme, feeling, plan)
    );

    const filterCtx = {
      feeling: feeling || "",
      theme: theme || "",
    };

    let rankedMeta = null;
    if (plan && (Relevance || Smart)) {
      if (Relevance && Relevance.rankItems) {
        rankedMeta = Relevance.rankItems(filteredItems, plan, filterCtx);
        filteredItems = rankedMeta.map((x) => x.item);
      } else {
        filteredItems = filteredItems
          .map((item) => ({
            item,
            score: Smart.scorePromise(item.p, plan),
          }))
          .sort((a, b) => b.score - a.score || 0)
          .map((x) => x.item);
      }
    }

    const filtered = filteredItems.map((item) => item.p);
    lastFiltered = filtered;
    lastRankedMeta = rankedMeta;

    const n = filtered.length;
    if (currentIndex >= n) currentIndex = Math.max(0, n - 1);
    ensureSliceForIndex(currentIndex);

    const notes = [];
    if (testament === "OT") notes.push("Old Testament");
    if (testament === "NT") notes.push("New Testament");
    if (feeling) notes.push(`feeling: ${feeling}`);
    if (theme) notes.push(`theme: ${theme}`);
    if (book) notes.push(`book: ${book}`);
    const noteStr = notes.length ? ` · ${notes.join(" · ")}` : "";
    el.count.innerHTML =
      n === 0
        ? `<strong>No matches</strong>${noteStr}`
        : `<strong>${n}</strong> promise${n === 1 ? "" : "s"}${noteStr}`;

    updateFiltersBadge();

    if (n === 0) {
      destroyDeckBinding();
      el.results.classList.remove("results-host--reading");
      document.body.classList.remove("reading-active");
      el.results.innerHTML = `
        <div class="empty" role="status">
          <h2>No promises found</h2>
          <p>Try another feeling or theme, or choose “All” in the filters.</p>
        </div>`;
      return;
    }

    paintReadingDeck();
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

  function syncTestamentButtons() {
    if (!el.testamentGroup) return;
    el.testamentGroup.querySelectorAll(".testament-btn").forEach((btn) => {
      const val = btn.dataset.testament || "";
      btn.setAttribute(
        "aria-pressed",
        val === activeTestament ? "true" : "false"
      );
    });
  }

  function setTestament(value) {
    activeTestament = value || "";
    syncTestamentButtons();
    refreshBookOptions(true);
    render();
  }

  function refreshBookOptions(preserveValue) {
    const previous = preserveValue ? el.book.value : "";
    fillSelect(el.book, "All books", booksInOrder(activeTestament || ""));
    if (previous && [...el.book.options].some((o) => o.value === previous)) {
      el.book.value = previous;
    } else {
      el.book.value = "";
    }
  }

  function activeFilterCount() {
    let n = 0;
    if (activeTestament) n += 1;
    if (el.feeling && el.feeling.value) n += 1;
    if (el.theme && el.theme.value) n += 1;
    if (el.book && el.book.value) n += 1;
    return n;
  }

  function updateFiltersBadge() {
    if (!el.filtersBadge) return;
    const n = activeFilterCount();
    if (n > 0) {
      el.filtersBadge.textContent = String(n);
      el.filtersBadge.hidden = false;
      el.filtersBadge.setAttribute(
        "aria-label",
        n === 1 ? "1 filter active" : n + " filters active"
      );
    } else {
      el.filtersBadge.textContent = "";
      el.filtersBadge.hidden = true;
      el.filtersBadge.removeAttribute("aria-label");
    }
  }

  function setFiltersOpen(open) {
    if (!el.filtersToggle || !el.filtersPanel) return;
    el.filtersToggle.setAttribute("aria-expanded", open ? "true" : "false");
    el.filtersPanel.hidden = !open;
    document.body.classList.toggle("filters-open", !!open);
  }

  function initFiltersToggle() {
    if (!el.filtersToggle || !el.filtersPanel) return;
    // Always start collapsed so the first view is just the search bar.
    setFiltersOpen(false);
    el.filtersToggle.addEventListener("click", () => {
      const next =
        el.filtersToggle.getAttribute("aria-expanded") !== "true";
      setFiltersOpen(next);
    });
  }

  function initFilters() {
    fillSelect(el.feeling, "All feelings", feelingUniverse());
    fillSelect(el.theme, "All themes", themeUniverse());
    refreshBookOptions(false);
  }

  function initSmartGuide() {
    if (!el.smartGuide || !Smart) return;

    el.smartGuide.addEventListener("click", (e) => {
      const dismiss = e.target.closest("#smart-guide-dismiss");
      if (dismiss) {
        smartState.dismissed = true;
        updateSmartGuide();
        return;
      }

      const clearGuide = e.target.closest("#smart-clear-guide");
      if (clearGuide) {
        clearGuideKeepQuery();
        return;
      }

      const skip = e.target.closest("#smart-skip");
      if (skip) {
        const det = smartState.detection;
        applyClarification({
          intentId: det ? det.intentId : "",
          optionId: null,
          option: null,
          freeText: "",
          skipped: true,
        });
        return;
      }

      const applyBtn = e.target.closest("#smart-apply");
      if (applyBtn) {
        const input = el.smartGuide.querySelector("#smart-freetext");
        const text = input ? input.value.trim() : "";
        const det = smartState.detection;
        if (!det) return;
        // Prefer "other" option when free-texting, else base intent
        const otherOpt =
          Smart.getOption(det.intentId, "other") ||
          (det.followUp.options && det.followUp.options[0]) ||
          null;
        applyClarification({
          intentId: det.intentId,
          optionId: otherOpt ? otherOpt.id : "other",
          option: otherOpt,
          freeText: text,
          skipped: false,
        });
        return;
      }

      const chip = e.target.closest(".smart-chip");
      if (chip) {
        const det = smartState.detection;
        if (!det) return;
        const optionId = chip.dataset.optionId;
        const option = Smart.getOption(det.intentId, optionId);
        if (!option) return;

        if (option.openText) {
          const input = el.smartGuide.querySelector("#smart-freetext");
          if (input) {
            input.focus();
            // If they already typed something, apply with this option
            if (input.value.trim()) {
              applyClarification({
                intentId: det.intentId,
                optionId: option.id,
                option: option,
                freeText: input.value.trim(),
                skipped: false,
              });
            }
            // else leave guide open for typing
          }
          return;
        }

        applyClarification({
          intentId: det.intentId,
          optionId: option.id,
          option: option,
          freeText: "",
          skipped: false,
        });
      }
    });

    el.smartGuide.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.target && e.target.id === "smart-freetext") {
        e.preventDefault();
        const applyBtn = el.smartGuide.querySelector("#smart-apply");
        if (applyBtn) applyBtn.click();
      }
    });
  }

  /**
   * Bring the scripture card into the main viewport, just below the sticky bar.
   * The deck is one card. Scroll that card — not the reading stage, whose top
   * is often already on screen, so a phone never leaves the search bar.
   * Call only after render() has inserted the card.
   */
  function revealScripture() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const behavior = reduce ? "auto" : "smooth";
    const run = () => {
      if (!el.results) return;
      const target =
        el.results.querySelector(".card--reading") ||
        el.results.querySelector(".empty");
      if (!target || !target.isConnected) return;
      target.scrollIntoView({ behavior: behavior, block: "start" });
    };
    // Two frames so layout includes the card render() just inserted.
    requestAnimationFrame(() => requestAnimationFrame(run));
    // Phones restore scroll onto the focused field when the keyboard closes.
    if (coarse) window.setTimeout(run, 480);
  }

  function pulseSearchButton() {
    const btn = el.searchSubmit;
    if (!btn) return;
    btn.classList.remove("is-pressed");
    void btn.offsetWidth;
    btn.classList.add("is-pressed");
    window.setTimeout(() => btn.classList.remove("is-pressed"), 220);
  }

  function submitSearch() {
    clearTimeout(debounce);
    pulseSearchButton();
    if (el.search && document.activeElement === el.search) el.search.blur();
    render();
    // Card (or empty state) is in the DOM now; scroll after that.
    // The quiet daily-verse landing stays put.
    if (!isLanding()) revealScripture();
  }

  let debounce;
  el.search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(render, 80);
  });
  el.search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // Own the Enter path so iOS search fields still reveal the card.
      // preventDefault keeps the form submit from running this twice.
      e.preventDefault();
      submitSearch();
      return;
    }
    if (e.key === "Escape") {
      el.search.value = "";
      resetSmartFully();
      render();
    }
  });
  if (el.searchForm) {
    el.searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitSearch();
    });
  }
  if (el.testamentGroup) {
    el.testamentGroup.addEventListener("click", (e) => {
      const btn = e.target.closest(".testament-btn");
      if (!btn) return;
      setTestament(btn.dataset.testament || "");
    });
  }
  el.book.addEventListener("change", render);
  el.theme.addEventListener("change", render);
  el.feeling.addEventListener("change", () => {
    // User explicitly changed feeling — no longer a soft-set
    smartState.softFeelingSet = false;
    smartState.previousFeeling = "";
    render();
  });

  el.results.addEventListener("click", (e) => {
    if (e.target.closest(".favorite-btn")) return;
    if (e.target.closest(".reading-nav")) return;
    const feelingTag = e.target.closest(".tag-feeling");
    if (feelingTag) {
      el.feeling.value = feelingTag.dataset.feeling || "";
      smartState.softFeelingSet = false;
      render();
      return;
    }
    const tag = e.target.closest(".tag");
    if (!tag || !tag.dataset.theme) return;
    el.theme.value = tag.dataset.theme;
    render();
  });

  if (UI && UI.bindFavoriteClicks) {
    UI.bindFavoriteClicks(el.results);
  }

  const auth = window.GodsPromisesAuth;
  if (auth && auth.onAuthChange) {
    auth.onAuthChange(() =>
      render({ preserveLimit: true, preserveIndex: true })
    );
  }

  initFiltersToggle();
  initFilters();
  initSmartGuide();
  syncTestamentButtons();
  render();

  // Roll the daily verse over at midnight Zurich while the tab stays open.
  window.setInterval(checkDailyRollover, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkDailyRollover();
  });
})();
