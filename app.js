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

  const Versions = window.GodsPromisesVersions;
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
    version: document.getElementById("version-filter"),
    versionMeta: document.getElementById("version-meta-label"),
    count: document.getElementById("result-count"),
    resultsMeta: document.getElementById("results-meta"),
    results: document.getElementById("results"),
    filtersToggle: document.getElementById("filters-toggle"),
    filtersPanel: document.getElementById("filters-panel"),
    filtersBadge: document.getElementById("filters-badge"),
    smartGuide: document.getElementById("smart-guide"),
    browseModes: document.getElementById("browse-modes"),
  };

  /* —— Daily verse (changes at midnight Europe/Zurich). Shared with the morning email. —— */

  const Daily = window.GodsPromisesDaily;
  if (!Daily) throw new Error("Daily verse module did not load");
  const DAILY_TZ = Daily.TIME_ZONE;
  const dailyPool = Daily.dailyPool(promises);

  function zurichDateKey(now) {
    return Daily.zurichDateKey(now);
  }

  function dailyPromiseFor(key) {
    return Daily.promiseForPool(dailyPool, key);
  }

  function dailyDateLabel(key) {
    return Daily.dateLabel(key);
  }

  /** How many past days the daily carousel can reach (today is offset 0). */
  const DAILY_MAX_BACK = 60;

  function shiftDateKey(key, offset) {
    return Daily.shiftDateKey(key, offset);
  }

  function daysBetweenKeys(a, b) {
    return Daily.daysBetweenKeys(a, b);
  }

  function dailyRelativeLabel(offset, key) {
    return Daily.relativeLabel(offset, key);
  }

  /** Keep a small offline copy of the verse this Zurich day is showing. */
  function rememberDailyVerse(key, promise) {
    const pwa = window.GodsPromisesPwa;
    if (!pwa || !pwa.rememberDaily || !promise) return;
    const send = () => {
      const node = document.querySelector('[data-daily-date="' + key + '"] .card-explain-text');
      pwa.rememberDaily({
        date: key,
        id: promise.id,
        reference: promise.reference,
        text: promise.text,
        explanation: node && node.textContent ? node.textContent : "",
      });
    };
    send();
    setTimeout(send, 1600);
  }

  let dailyKeyShown = "";
  /** Days back from today on the landing carousel (0 = today). */
  let dailyOffset = 0;

  /** @type {""|"OT"|"NT"} */
  let activeTestament = "";

  /** Index into lastFiltered for the one-at-a-time reading card. */
  let currentIndex = 0;
  /** @type {object[]} */
  let lastFiltered = [];
  let lastRankedMeta = null;
  /**
   * Landing view with no search or filters: "daily" = today's verse with the
   * 60-day history in the same deck; "all" = the whole collection in order.
   * @type {"daily"|"all"}
   */
  let browseMode = "daily";
  /** Remembered position in the full collection while switching modes. */
  let allIndex = 0;

  function isTypingTargetHome(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (target.closest && target.closest("#search, .smart-guide, .filters")) {
      return true;
    }
    return !!target.isContentEditable;
  }

  /** One deck controller for #results; listeners are bound exactly once. */
  const deck =
    UI && UI.createReadingDeck
      ? UI.createReadingDeck(el.results, { isTypingTarget: isTypingTargetHome })
      : null;

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
    // Scripture refs keep digit-preserving literal AND match (no plan)
    if (Smart.looksLikeScriptureRef(q)) return null;
    const clarification =
      smartState.clarification &&
      smartState.queryKey === queryKey(q)
        ? smartState.clarification
        : null;
    // Always build a plan for plain text: stopwords, synonym/feeling expand,
    // soft context words, and topic hints for popularity ranking — even when
    // the clarifying guide is not shown.
    return Smart.buildSearchPlan(q, clarification, {
      knownThemes: knownThemesList(),
      knownFeelings: knownFeelingsList(),
    });
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

    // Plan with only soft boosts / empty content after stopword strip: no text constraint
    if (plan && Smart && !plan.orGroups.length && !plan.andTokens.length) {
      // Fall through to raw tokens if any; else match (filters alone)
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


  function updateVersionMeta() {
    if (!el.versionMeta) return;
    if (Versions && Versions.versionLabelForMeta) {
      el.versionMeta.textContent = Versions.versionLabelForMeta();
    } else {
      el.versionMeta.textContent = "WEB · public domain";
    }
  }

  function hydrateVisibleCards(list) {
    updateVersionMeta();
    if (!Versions || !Versions.hydrateCards || !el.results) return;
    const promises = list || lastFiltered || [];
    Versions.hydrateCards(el.results, promises);
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
        <blockquote class="card-text">${escapeHtml(p.text)}</blockquote>
      </li>
    `;
  }

  function resetDeckIndex() {
    currentIndex = 0;
  }

  function isBookOnlyQuery(q) {
    const n = normalize(q).trim();
    if (!n) return false;
    if (n === "psalm" || n === "psalms" || n === "song of solomon") return true;
    return promises.some((p) => String(p.book).toLowerCase() === n);
  }

  function discoveryKeep(row, found) {
    const testament = activeTestament;
    const book = el.book.value;
    const theme = el.theme.value;
    const feeling = el.feeling.value;
    if (testament && testamentOf(row.book) !== testament) return false;
    if (book && row.book !== book) return false;
    if (found && found.filterStudy) return true;
    if (theme && !(row.themes || []).includes(theme)) return false;
    if (feeling && !(row.feelings || []).includes(feeling)) return false;
    return true;
  }

  function cardShell(p) {
    const html = renderCard(p, null).trim();
    return html.replace(/^<li\b/, "<div").replace(/<\/li>\s*$/, "</div>");
  }

  function supplementCard(row) {
    return `<div class="card" data-id="${escapeHtml(row.id)}">
      <div class="card-top"><div class="card-ref-wrap"><h3 class="card-ref">${escapeHtml(row.reference)}</h3></div></div>
      <blockquote class="card-text">${escapeHtml(row.text)}</blockquote>
      <p class="card-version-note" hidden></p>
    </div>`;
  }

  function discoveryArticle(row) {
    const body = row.promise ? cardShell(row.promise) : supplementCard(row);
    return `<article class="discovery-item">
      <p class="discovery-role"><span>${escapeHtml(row.roleLabel)}</span></p>
      <p class="discovery-why">${escapeHtml(row.why)}</p>
      ${body}
    </article>`;
  }

  function discoveryGroup(title, rows) {
    if (!rows.length) return "";
    return `<h3 class="discovery-group">${escapeHtml(title)}</h3>
      <div class="discovery-group-list">${rows.map(discoveryArticle).join("")}</div>`;
  }

  function searchFeedbackHtml(found, rows) {
    const ids = rows.map((row) => row.id).join(",");
    const refs = rows.map((row) => row.reference);
    return `<div class="search-feedback" data-query="${escapeHtml(found.query || "")}" data-intent="${escapeHtml((found.conceptId || "") + "/" + (found.intentionId || ""))}" data-category="${escapeHtml(found.heading || "")}" data-results="${escapeHtml(ids)}" data-refs="${escapeHtml(JSON.stringify(refs))}">
      <p>Did these results address your search?</p>
      <div class="search-feedback-actions">
        <button type="button" data-helpful="yes">Yes</button>
        <button type="button" data-helpful="no">No</button>
      </div>
      <div class="search-feedback-reasons" hidden>
        <p>What was off?</p>
        <button type="button" data-reason="missing_scripture">Missing scripture</button>
        <button type="button" data-reason="wrong_category">Wrong category</button>
        <button type="button" data-reason="irrelevant">Irrelevant</button>
        <button type="button" data-reason="wrong_interpretation">Wrong interpretation</button>
      </div>
      <p class="search-feedback-status" role="status"></p>
    </div>`;
  }

  function renderDiscovery(found) {
    if (deck) deck.reset();
    el.results.classList.remove("results-host--reading");
    document.body.classList.remove("reading-active");
    const direct = (found.direct || []).filter((row) => discoveryKeep(row, found));
    const related = (found.related || []).filter((row) => discoveryKeep(row, found));
    const rows = direct.concat(related);
    const notes = [];
    if (activeTestament === "OT") notes.push("Old Testament");
    if (activeTestament === "NT") notes.push("New Testament");
    if (el.feeling && el.feeling.value) notes.push("feeling: " + el.feeling.value);
    if (el.theme && el.theme.value) notes.push("theme: " + el.theme.value);
    if (el.book && el.book.value) notes.push("book: " + el.book.value);
    const noteStr = notes.length ? " · " + notes.join(" · ") : "";
    const correction = found.corrected
      ? ` <span class="search-corrected">Showing results for “${escapeHtml(found.corrected)}”</span>`
      : "";
    const n = rows.length;
    el.count.innerHTML = n
      ? `<strong>${n}</strong> passage${n === 1 ? "" : "s"}${noteStr}${correction}`
      : `<strong>No matches</strong>${noteStr}`;
    updateFiltersBadge();
    lastRankedMeta = null;
    lastFiltered = rows.map((row) => row.promise || {
      id: row.id,
      reference: row.reference,
      book: row.book,
      chapter: row.chapter,
      verseStart: row.verseStart,
      verseEnd: row.verseEnd,
      text: row.text,
    });
    if (!n) {
      showEmptyResults(`
        <div class="empty" role="status">
          <h2>No promises found</h2>
          <p>Try another feeling or theme, or choose “All” in the filters.</p>
        </div>`);
      return;
    }
    const note = found.note ? `<p class="discovery-note">${escapeHtml(found.note)}</p>` : "";
    el.results.innerHTML = `<div class="discovery" data-discovery="1">
      <header class="discovery-lead">
        <h2>${escapeHtml(found.heading || "Passages")}</h2>
        <p>${escapeHtml(found.intro || "")}</p>
        ${note}
      </header>
      ${discoveryGroup("Directly relevant", direct)}
      ${discoveryGroup("Related biblical perspectives", related)}
      ${searchFeedbackHtml(found, rows)}
    </div>`;
    hydrateVisibleCards(lastFiltered);
    if (currentIndex >= n) currentIndex = 0;
  }

  function renderComfortFallback() {
    const testament = activeTestament;
    const book = el.book.value;
    const theme = el.theme.value;
    const feeling = el.feeling.value;
    const comfort = Smart && Smart.comfortPromises ? Smart.comfortPromises(promises) : [];
    const comfortItems = comfort
      .map((p) => indexed.find((item) => item.p.id === p.id))
      .filter(Boolean);
    const narrowed = comfortItems.filter((item) =>
      matches(item, [], testament, book, theme, feeling, null)
    );
    const chosen = (narrowed.length ? narrowed : comfortItems).map((item) => item.p);
    const notes = [];
    if (testament === "OT") notes.push("Old Testament");
    if (testament === "NT") notes.push("New Testament");
    if (feeling) notes.push("feeling: " + feeling);
    if (theme) notes.push("theme: " + theme);
    if (book) notes.push("book: " + book);
    const noteStr = notes.length ? " · " + notes.join(" · ") : "";
    el.count.innerHTML = `<strong>Not understood</strong>${noteStr}`;
    updateFiltersBadge();
    lastFiltered = chosen;
    lastRankedMeta = null;
    showSearchFallback(chosen);
  }

  function showSearchFallback(list) {
    if (deck) deck.reset();
    el.results.classList.remove("results-host--reading");
    document.body.classList.remove("reading-active");
    const suggestions = [
      ["I feel anxious", "Anxiety"],
      ["I feel exhausted", "Exhaustion"],
      ["I need peace in my mind", "Peace of mind"],
      ["I need strength to continue", "Strength to continue"],
      ["I wish I was rich", "Money"],
      ["I am worried about money", "Money worries"],
      ["I feel frustrated", "Frustration"],
      ["I am grieving", "Grief"],
      ["I can't forgive", "Forgiveness"],
      ["I want a stronger marriage", "Marriage"],
      ["I need guidance", "A decision"],
      ["I feel alone", "Loneliness"],
    ];
    const chips = suggestions
      .map(
        (pair) =>
          `<button type="button" class="search-suggest" data-suggest="${escapeHtml(pair[0])}">${escapeHtml(pair[1])}</button>`
      )
      .join("");
    const cards = list.map((p) => renderCard(p, null)).join("");
    el.results.innerHTML = `
      <div class="search-fallback" data-fallback="1" role="status">
        <div class="search-fallback-lead">
          <h2>This search wasn’t clear</h2>
          <p>The search wasn’t understood well enough to choose scriptures for it. Try a suggestion, or say the situation in a few ordinary words.</p>
          <div class="search-suggests" role="group" aria-label="Suggested searches">${chips}</div>
        </div>
        <h3 class="discovery-group">Not a match for that search</h3>
        <p class="discovery-why">These are promises people often find comforting. They are not a result for the words you typed.</p>
        <ul class="results search-fallback-list">${cards}</ul>
      </div>`;
    hydrateVisibleCards(list);
  }

  function showEmptyResults(html) {
    if (deck) deck.reset();
    el.results.classList.remove("results-host--reading");
    document.body.classList.remove("reading-active");
    el.results.innerHTML = html;
  }

  function rankedMetaFor(i) {
    return lastRankedMeta && lastRankedMeta[i]
      ? {
          relevanceLabel: lastRankedMeta[i].relevanceLabel || "",
          score: lastRankedMeta[i].score,
        }
      : null;
  }

  /**
   * Main collection or search/filter results in the shared reading deck.
   * The deck keeps its shell (arrows, progress, listeners) between calls.
   */
  function paintReadingDeck() {
    const n = lastFiltered.length;
    if (n === 0) return;
    if (currentIndex >= n) currentIndex = n - 1;
    if (currentIndex < 0) currentIndex = 0;
    const list = lastFiltered;
    const isAll = isLanding() && browseMode === "all";
    document.body.classList.add("reading-active");
    if (!deck) {
      el.results.innerHTML = `<ul class="results results--single">${renderCard(list[currentIndex], rankedMetaFor(currentIndex))}</ul>`;
      hydrateVisibleCards([list[currentIndex]]);
      return;
    }
    deck.show({
      key: isAll ? "all" : "results",
      stageClass: isAll ? "reading-stage--all" : "",
      count: n,
      index: currentIndex,
      renderCard: (i) => renderCard(list[i], rankedMetaFor(i)),
      afterPaint: (li, i) => hydrateVisibleCards([list[i]]),
      onIndexChange: (i) => {
        currentIndex = i;
        if (isAll) allIndex = i;
      },
      labels: {
        prev: "Previous",
        next: "Next",
        prevAria: "Previous promise",
        nextAria: "Next promise",
        viewport: isAll ? "All promises" : "Search results",
      },
      hint: (i, total) => (total > 1 ? "Swipe or use the arrows" : ""),
    });
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

  function syncBrowseModes() {
    if (!el.browseModes) return;
    const show = isLanding();
    el.browseModes.hidden = !show;
    el.browseModes.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.dataset.mode === browseMode ? "true" : "false");
    });
  }

  function setBrowseMode(mode) {
    const next = mode === "all" ? "all" : "daily";
    if (next === browseMode) return;
    if (browseMode === "all" && deck && deck.getCount()) allIndex = deck.getIndex();
    browseMode = next;
    render({ preserveIndex: true });
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

  /**
   * Empty query, no filters, "Today" mode: the daily verse and the previous
   * DAILY_MAX_BACK days live in one chronological deck — oldest on the left,
   * today on the right. It opens on today; swipe right / ‹ / ArrowLeft goes
   * back a day, and the deck stops at today (no future days). Each day uses
   * the same deterministic Zurich-date picker, so a past card shows exactly
   * the verse that day showed.
   */
  function paintDailyVerse() {
    const todayKey = zurichDateKey();
    if (dailyOffset < 0) dailyOffset = 0;
    if (dailyOffset > DAILY_MAX_BACK) dailyOffset = DAILY_MAX_BACK;
    const total = DAILY_MAX_BACK + 1;
    const keyAt = (i) => shiftDateKey(todayKey, DAILY_MAX_BACK - i);
    const promiseAt = (i) => dailyPromiseFor(keyAt(i));
    const p = promiseAt(DAILY_MAX_BACK - dailyOffset);
    lastFiltered = p ? [p] : [];
    lastRankedMeta = null;
    currentIndex = 0;
    dailyKeyShown = todayKey;
    document.body.classList.add("is-landing");
    el.count.innerHTML = "";
    updateFiltersBadge();
    if (!p) {
      showEmptyResults("");
      return;
    }
    rememberDailyVerse(todayKey, promiseAt(DAILY_MAX_BACK));
    document.body.classList.add("reading-active");
    const cardFor = (i) => {
      const key = keyAt(i);
      let cardHtml = renderCard(promiseAt(i), null);
      cardHtml = cardHtml.replace('class="card', 'class="card card--daily');
      return cardHtml.replace(/^(\s*<li\b)/, `$1 data-daily-date="${escapeHtml(key)}"`);
    };
    if (!deck) {
      el.results.innerHTML = `<ul class="results results--single">${cardFor(DAILY_MAX_BACK - dailyOffset)}</ul>`;
      hydrateVisibleCards([p]);
      return;
    }
    deck.show({
      key: "daily",
      stageClass: "reading-stage--daily",
      count: total,
      index: DAILY_MAX_BACK - dailyOffset,
      renderCard: cardFor,
      afterPaint: (li, i) => {
        const q = promiseAt(i);
        lastFiltered = q ? [q] : [];
        hydrateVisibleCards(lastFiltered);
      },
      onIndexChange: (i) => {
        dailyOffset = DAILY_MAX_BACK - i;
      },
      position: (i) => {
        const off = DAILY_MAX_BACK - i;
        const key = keyAt(i);
        const rel = dailyRelativeLabel(off, key);
        const fullDate = dailyDateLabel(key);
        const sub =
          off <= 1
            ? fullDate
            : off + " days ago";
        return {
          html:
            `<span class="daily-when">${escapeHtml(rel)}</span>` +
            `<span class="daily-date">${escapeHtml(sub)}</span>`,
          label: rel + (off <= 1 ? ", " + fullDate : "") + ". Day " + (i + 1) + " of " + total,
        };
      },
      labels: {
        prev: "Earlier",
        next: "Later",
        prevAria: "Previous day’s verse",
        nextAria: "Next day’s verse",
        viewport: "Daily verses",
      },
      hint: (i, n) => (i === n - 1 ? "Swipe right for the past 60 days" : "Swipe or use the arrows"),
    });
  }

  /**
   * At Zurich midnight, if still on the landing: today's card moves to the new
   * day; a past card stays on the same date (its offset grows by one).
   */
  function checkDailyRollover() {
    if (!isLanding() || browseMode !== "daily") return;
    const todayKey = zurichDateKey();
    if (todayKey === dailyKeyShown) return;
    if (dailyOffset > 0 && dailyKeyShown) {
      const diff = daysBetweenKeys(dailyKeyShown, todayKey);
      if (diff > 0) dailyOffset = Math.min(dailyOffset + diff, DAILY_MAX_BACK);
    }
    paintDailyVerse();
  }

  function render(opts) {
    const preserveLimit = opts && opts.preserveLimit;
    const preserveIndex = opts && opts.preserveIndex;
    if (!preserveIndex && !preserveLimit) resetDeckIndex();

    updateSmartGuide();
    syncBrowseModes();

    if (isLanding()) {
      if (browseMode === "all") {
        document.body.classList.add("is-landing");
        lastFiltered = promises;
        lastRankedMeta = null;
        currentIndex = allIndex;
        el.count.innerHTML = "";
        updateFiltersBadge();
        paintReadingDeck();
        return;
      }
      paintDailyVerse();
      return;
    }
    document.body.classList.remove("is-landing");
    // Leaving the landing: next time it opens on today's verse.
    dailyOffset = 0;

    const earlyQuery = el.search.value.trim();
    const earlyScripture = Smart && Smart.looksLikeScriptureRef(earlyQuery);
    if (
      earlyQuery &&
      !earlyScripture &&
      !isBookOnlyQuery(earlyQuery) &&
      window.GodsPromisesDiscovery
    ) {
      const found = window.GodsPromisesDiscovery.discover(earlyQuery, promises);
      if (found.mode === "results" || found.mode === "limited") {
        renderDiscovery(found);
        return;
      }
      if (found.mode === "fallback") {
        renderComfortFallback();
        return;
      }
    }

    if (
      !earlyQuery &&
      (el.feeling.value || el.theme.value) &&
      window.GodsPromisesFilterStudies &&
      window.GodsPromisesDiscovery &&
      window.GodsPromisesDiscovery.studyResult
    ) {
      const study = window.GodsPromisesFilterStudies.forFilters(el.feeling.value, el.theme.value);
      if (study) {
        renderDiscovery(window.GodsPromisesDiscovery.studyResult(study, promises));
        return;
      }
    }

    let plan = currentPlan();
    const rawTokens = tokensFromQuery(el.search.value);
    // Prefer smart plan tokens (stopwords stripped); else legacy AND tokens
    let tokens = plan
      ? [] // plan handles matching
      : rawTokens;
    const testament = activeTestament;
    const book = el.book.value;
    const theme = el.theme.value;
    const feeling = el.feeling.value;
    const rawQuery = el.search.value.trim();
    const scriptureQuery = Smart && Smart.looksLikeScriptureRef(rawQuery);
    let correctedQuery = "";

    function textHits(activePlan, activeTokens) {
      return indexed.filter((item) =>
        matches(item, activeTokens, "", "", "", "", activePlan)
      ).length;
    }

    let filteredItems = indexed.filter((item) =>
      matches(item, tokens, testament, book, theme, feeling, plan)
    );

    // Typos are corrected only when the words themselves match nothing.
    // A real match hidden by Testament or Book stays empty so those filters hold.
    const uncorrectedHits = textHits(plan, tokens);
    if (
      rawQuery &&
      Smart &&
      Smart.correctQuery &&
      !scriptureQuery &&
      uncorrectedHits === 0 &&
      !(smartState.clarification && smartState.queryKey === queryKey(rawQuery))
    ) {
      const corrected = Smart.correctQuery(rawQuery);
      if (corrected && corrected !== rawQuery) {
        const correctedPlan = Smart.buildSearchPlan(corrected, null, {
          knownThemes: knownThemesList(),
          knownFeelings: knownFeelingsList(),
        });
        if (textHits(correctedPlan, []) > 0) {
          plan = correctedPlan;
          tokens = [];
          correctedQuery = corrected;
          filteredItems = indexed.filter((item) =>
            matches(item, tokens, testament, book, theme, feeling, plan)
          );
        }
      }
    }

    const filterCtx = {
      feeling: feeling || "",
      theme: theme || "",
    };

    const queryMissed =
      !!rawQuery &&
      !scriptureQuery &&
      textHits(plan, tokens) === 0;
    let usedFallback = false;
    if (queryMissed && filteredItems.length === 0 && Smart && Smart.comfortPromises) {
      const comfort = Smart.comfortPromises(promises);
      const comfortItems = comfort
        .map((p) => indexed.find((item) => item.p === p || item.p.id === p.id))
        .filter(Boolean);
      const narrowed = comfortItems.filter((item) =>
        matches(item, [], testament, book, theme, feeling, null)
      );
      filteredItems = narrowed.length ? narrowed : comfortItems;
      usedFallback = filteredItems.length > 0;
    }

    let rankedMeta = null;
    const shouldRank =
      !usedFallback &&
      ((plan && (plan.orGroups.length || plan.andTokens.length || plan.contentTokens.length || plan.rankingIntentId || plan.softFeelings.length)) ||
      filterCtx.feeling ||
      filterCtx.theme);
    if (shouldRank && (Relevance || Smart)) {
      if (Relevance && Relevance.rankItems) {
        rankedMeta = Relevance.rankItems(filteredItems, plan, filterCtx);
        filteredItems = rankedMeta.map((x) => x.item);
      } else if (plan && Smart) {
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

    const notes = [];
    if (testament === "OT") notes.push("Old Testament");
    if (testament === "NT") notes.push("New Testament");
    if (feeling) notes.push(`feeling: ${feeling}`);
    if (theme) notes.push(`theme: ${theme}`);
    if (book) notes.push(`book: ${book}`);
    const noteStr = notes.length ? ` · ${notes.join(" · ")}` : "";
    const correctionNote = correctedQuery
      ? ` <span class="search-corrected">Showing results for “${escapeHtml(correctedQuery)}”</span>`
      : "";
    el.count.innerHTML =
      n === 0
        ? `<strong>No matches</strong>${noteStr}`
        : `<strong>${UI && UI.formatCount ? UI.formatCount(n) : n}</strong> promise${n === 1 ? "" : "s"}${noteStr}${correctionNote}`;

    updateFiltersBadge();

    if (n === 0) {
      showEmptyResults(`
        <div class="empty" role="status">
          <h2>No promises found</h2>
          <p>Try another feeling or theme, or choose “All” in the filters.</p>
        </div>`);
      return;
    }

    if (usedFallback) {
      showSearchFallback(filtered);
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
    if (Versions && Versions.fillSelect && el.version) {
      Versions.fillSelect(el.version);
    }
    updateVersionMeta();
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
        el.results.querySelector(".search-fallback-lead") ||
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
  function applyVersionToScreen() {
    if (Versions && Versions.fillSelect && el.version) Versions.fillSelect(el.version);
    updateVersionMeta();
    if (deck && deck.getCount()) {
      deck.refresh();
      return;
    }
    if (lastFiltered && lastFiltered.length) hydrateVisibleCards(lastFiltered);
  }

  if (Versions && Versions.onChange) Versions.onChange(applyVersionToScreen);

  if (el.version) {
    el.version.addEventListener("change", () => {
      if (Versions && Versions.setCurrent) Versions.setCurrent(el.version.value);
      // setCurrent notifies onChange, which keeps the search, category,
      // explanation, and feedback and only replaces the verse text.
      if (!Versions || !Versions.onChange) applyVersionToScreen();
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

  if (el.browseModes) {
    el.browseModes.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mode]");
      if (!btn) return;
      setBrowseMode(btn.dataset.mode);
    });
  }

  function sendSearchFeedback(box, helpful, reason) {
    const status = box.querySelector(".search-feedback-status");
    let refs = [];
    try { refs = JSON.parse(box.getAttribute("data-refs") || "[]"); } catch (err) { refs = []; }
    const payload = {
      kind: "search",
      query: box.getAttribute("data-query") || "",
      intent: box.getAttribute("data-intent") || "",
      category: box.getAttribute("data-category") || "",
      resultIds: String(box.getAttribute("data-results") || "").split(",").filter(Boolean),
      resultRefs: Array.isArray(refs) ? refs : [],
      helpful: helpful,
      reason: reason || null,
      comment: null,
      website: "",
    };
    if (status) status.textContent = "Sending…";
    fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    }).then((res) => {
      if (status) status.textContent = res.ok ? "Thank you. That helps the reading stay honest." : "Thanks. That couldn’t be sent just now.";
    }).catch(() => {
      if (status) status.textContent = "Thanks. That couldn’t be sent just now.";
    });
  }

  el.results.addEventListener("click", (e) => {
    const suggest = e.target.closest("[data-suggest]");
    if (suggest && el.search) {
      el.search.value = suggest.getAttribute("data-suggest") || "";
      render();
      if (typeof revealScripture === "function") revealScripture();
      return;
    }
    const helpfulBtn = e.target.closest("[data-helpful]");
    if (helpfulBtn) {
      const box = helpfulBtn.closest(".search-feedback");
      const helpful = helpfulBtn.getAttribute("data-helpful") === "yes";
      if (!helpful) {
        const reasons = box && box.querySelector(".search-feedback-reasons");
        if (reasons) reasons.hidden = false;
      }
      if (helpful) sendSearchFeedback(box, true, null);
      return;
    }
    const reasonBtn = e.target.closest("[data-reason]");
    if (reasonBtn) {
      const box = reasonBtn.closest(".search-feedback");
      sendSearchFeedback(box, false, reasonBtn.getAttribute("data-reason"));
      return;
    }
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

  function renderWhenReady(opts) {
    const auth = window.GodsPromisesAuth;
    const favs = window.GodsPromisesFavorites;
    Promise.resolve(auth && auth.whenReady ? auth.whenReady() : null)
      .then(() => (favs && favs.whenReady ? favs.whenReady() : null))
      .then(() => render(opts))
      .catch(() => render(opts));
  }

  const auth = window.GodsPromisesAuth;
  if (auth && auth.onAuthChange) {
    auth.onAuthChange(() => renderWhenReady({ preserveLimit: true, preserveIndex: true }));
  }

  initFiltersToggle();
  initFilters();
  initSmartGuide();
  syncTestamentButtons();
  renderWhenReady();

  // Roll the daily verse over at midnight Zurich while the tab stays open.
  window.setInterval(checkDailyRollover, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkDailyRollover();
  });
})();
