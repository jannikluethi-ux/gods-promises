/**
 * Topical popularity + relevance ranking for God’s Promises search.
 * Anchors grounded in OpenBible / YouVersion / pastoral topical lists
 * (see scripts/relevance-sources.md).
 */
(function (global) {
  "use strict";

  /**
   * Canonical book order for stable tie-breaks.
   */
  const BOOK_ORDER = [
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Proverbs",
    "Ecclesiastes",
    "Song of Solomon",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
    "Matthew",
    "Mark",
    "Luke",
    "John",
    "Acts",
    "Romans",
    "1 Corinthians",
    "2 Corinthians",
    "Galatians",
    "Ephesians",
    "Philippians",
    "Colossians",
    "1 Thessalonians",
    "2 Thessalonians",
    "1 Timothy",
    "2 Timothy",
    "Titus",
    "Philemon",
    "Hebrews",
    "James",
    "1 Peter",
    "2 Peter",
    "1 John",
    "2 John",
    "3 John",
    "Jude",
    "Revelation",
  ];

  const BOOK_INDEX = Object.create(null);
  BOOK_ORDER.forEach((b, i) => {
    BOOK_INDEX[b.toLowerCase()] = i;
  });
  BOOK_INDEX.psalm = BOOK_INDEX.psalms;

  /** @typedef {{ book: string, chapter: number, verseStart: number, verseEnd?: number, weight: number }} Anchor */

  /**
   * Topic keys → well-known verse anchors with popularity weights.
   * Keys align with smart-search intents, feelings, and theme vocabulary.
   */
  const TOPIC_ANCHORS = {
    // --- Anxiety / worry / stress / fear ---
    anxiety: [
      a("Philippians", 4, 6, 7, 100),
      a("Isaiah", 41, 10, 10, 96),
      a("1 Peter", 5, 6, 7, 92),
      a("Matthew", 6, 25, 34, 90),
      a("John", 14, 27, 27, 86),
      a("2 Timothy", 1, 7, 7, 82),
      a("Psalms", 55, 22, 22, 78),
      a("Joshua", 1, 8, 9, 74),
      a("Isaiah", 26, 3, 4, 72),
      a("Psalms", 56, 3, 4, 70),
      a("Psalms", 94, 18, 19, 66),
      a("Matthew", 11, 28, 30, 64),
      a("Proverbs", 3, 5, 6, 60),
      a("Psalms", 23, 1, 4, 58),
      a("Exodus", 14, 13, 14, 52),
    ],
    stress: null, // alias → anxiety
    fear: null, // filled below from anxiety + courage refs
    anxious: null,
    worried: null,
    worry: null,
    afraid: null,
    stressed: null,

    // --- Loneliness / abandonment ---
    loneliness: [
      a("Isaiah", 41, 10, 10, 100),
      a("Psalms", 27, 10, 10, 96),
      a("Matthew", 28, 18, 20, 94),
      a("Deuteronomy", 31, 6, 6, 92),
      a("Hebrews", 13, 5, 6, 90),
      a("1 Peter", 5, 6, 7, 86),
      a("John", 14, 18, 18, 84),
      a("Psalms", 23, 1, 4, 80),
      a("Psalms", 147, 3, 3, 76),
      a("Deuteronomy", 31, 8, 8, 74),
      a("Joshua", 1, 5, 5, 70),
      a("Isaiah", 43, 1, 2, 68),
      a("Psalms", 139, 7, 12, 64),
      a("Romans", 8, 38, 39, 62),
      a("Zephaniah", 3, 16, 17, 58),
    ],
    lonely: null,
    alone: null,
    abandoned: null,

    // --- Sadness / grief / depression ---
    grief: [
      a("Psalms", 34, 15, 18, 100),
      a("Psalms", 147, 3, 3, 96),
      a("Matthew", 11, 28, 30, 92),
      a("Psalms", 30, 5, 5, 88),
      a("2 Corinthians", 1, 3, 4, 86),
      a("Revelation", 21, 3, 4, 84),
      a("Isaiah", 53, 4, 6, 80),
      a("Lamentations", 3, 21, 23, 78),
      a("Psalms", 23, 1, 4, 74),
      a("John", 14, 1, 3, 70),
      a("Isaiah", 61, 1, 3, 66),
      a("Romans", 8, 28, 28, 62),
      a("Psalms", 42, 11, 11, 58),
    ],
    sadness: null,
    sad: null,
    depression: null,
    depressed: null,

    // --- Anger / bitterness ---
    anger: [
      a("Ephesians", 4, 31, 32, 100),
      a("Ephesians", 4, 32, 32, 98),
      a("Proverbs", 15, 1, 1, 92),
      a("James", 1, 19, 20, 90),
      a("Ephesians", 4, 26, 27, 88),
      a("Colossians", 3, 12, 15, 84),
      a("Psalms", 37, 7, 8, 80),
      a("Proverbs", 16, 32, 32, 70),
      a("Romans", 12, 17, 21, 66),
      a("Matthew", 6, 14, 15, 62),
    ],
    angry: null,
    bitterness: null,
    bitter: null,

    // --- Guilt / shame / forgiveness ---
    forgiveness: [
      a("1 John", 1, 8, 9, 100),
      a("Ephesians", 4, 32, 32, 94),
      a("Romans", 8, 1, 2, 92),
      a("Psalms", 103, 10, 12, 88),
      a("Isaiah", 1, 18, 18, 84),
      a("Micah", 7, 18, 19, 82),
      a("Matthew", 6, 14, 15, 78),
      a("Isaiah", 43, 25, 25, 74),
      a("Colossians", 3, 12, 15, 70),
      a("Acts", 3, 19, 19, 64),
      a("Hebrews", 8, 12, 12, 60),
    ],
    guilt: null,
    guilty: null,
    shame: null,
    ashamed: null,

    // --- Hope / hopelessness ---
    hope: [
      a("Romans", 15, 13, 13, 100),
      a("Jeremiah", 29, 10, 11, 98),
      a("Isaiah", 40, 28, 31, 94),
      a("Hebrews", 11, 1, 1, 88),
      a("Romans", 5, 5, 5, 84),
      a("Lamentations", 3, 21, 23, 82),
      a("Romans", 8, 28, 28, 80),
      a("1 Peter", 1, 3, 3, 76),
      a("Revelation", 21, 3, 4, 72),
      a("Psalms", 42, 11, 11, 68),
      a("Hebrews", 10, 23, 23, 64),
      a("Philippians", 1, 6, 6, 60),
    ],
    hopeless: null,
    hopelessness: null,

    // --- Strength / weariness / burnout ---
    strength: [
      a("Philippians", 4, 13, 13, 100),
      a("Isaiah", 41, 10, 10, 96),
      a("Isaiah", 40, 28, 31, 94),
      a("Matthew", 11, 28, 30, 90),
      a("2 Corinthians", 12, 9, 10, 86),
      a("Psalms", 73, 26, 26, 80),
      a("Joshua", 1, 8, 9, 78),
      a("Deuteronomy", 31, 6, 6, 74),
      a("Ephesians", 6, 10, 11, 70),
      a("Psalms", 46, 1, 3, 68),
      a("Isaiah", 40, 29, 29, 64),
      a("Nehemiah", 8, 10, 10, 58),
    ],
    weariness: null,
    weary: null,
    burnout: null,
    tired: null,
    exhausted: null,

    // --- Guidance / confusion / decision ---
    guidance: [
      a("Proverbs", 3, 5, 6, 100),
      a("James", 1, 5, 6, 94),
      a("Psalms", 32, 8, 8, 86),
      a("Isaiah", 30, 21, 21, 80),
      a("Psalms", 119, 105, 105, 76),
      a("Jeremiah", 29, 10, 11, 70),
      a("Psalms", 25, 4, 5, 66),
      a("Isaiah", 58, 11, 11, 62),
      a("Romans", 12, 2, 2, 58),
    ],
    confusion: null,
    confused: null,
    decision: null,
    wisdom: null,

    // --- Provision / money / need ---
    provision: [
      a("Philippians", 4, 19, 19, 100),
      a("Matthew", 6, 31, 34, 96),
      a("Matthew", 6, 25, 30, 90),
      a("Psalms", 23, 1, 4, 88),
      a("Matthew", 6, 33, 33, 84),
      a("Hebrews", 13, 5, 6, 80),
      a("Psalms", 37, 25, 25, 72),
      a("2 Corinthians", 9, 8, 8, 68),
      a("Malachi", 3, 10, 10, 60),
    ],
    money: null,
    need: null,
    finances: null,

    // --- Peace ---
    peace: [
      a("John", 16, 33, 33, 100),
      a("Isaiah", 26, 3, 4, 96),
      a("John", 14, 27, 27, 94),
      a("Philippians", 4, 6, 7, 92),
      a("Colossians", 3, 12, 15, 84),
      a("Numbers", 6, 24, 26, 78),
      a("Romans", 5, 1, 1, 72),
      a("2 Thessalonians", 3, 16, 16, 70),
      a("Psalms", 4, 8, 8, 64),
      a("Psalms", 29, 11, 11, 58),
    ],
    peaceful: null,

    // --- Love / rejection ---
    love: [
      a("Romans", 8, 38, 39, 100),
      a("John", 3, 16, 17, 98),
      a("Zephaniah", 3, 16, 17, 90),
      a("1 John", 4, 16, 18, 88),
      a("Romans", 5, 6, 8, 86),
      a("Jeremiah", 31, 3, 3, 80),
      a("Ephesians", 3, 16, 19, 76),
      a("Isaiah", 49, 15, 16, 72),
      a("Psalms", 136, 1, 1, 60),
    ],
    rejection: null,
    rejected: null,
    unloved: null,
    loved: null,

    // --- Healing ---
    healing: [
      a("Isaiah", 53, 4, 6, 100),
      a("Psalms", 147, 3, 3, 94),
      a("James", 5, 13, 16, 90),
      a("Jeremiah", 30, 17, 17, 84),
      a("Exodus", 15, 26, 26, 80),
      a("Psalms", 103, 2, 3, 76),
      a("3 John", 1, 2, 2, 64),
      a("Matthew", 11, 28, 30, 60),
    ],

    // --- Salvation / eternal life ---
    salvation: [
      a("John", 3, 16, 17, 100),
      a("Ephesians", 2, 8, 10, 96),
      a("Romans", 6, 23, 23, 90),
      a("Romans", 10, 9, 10, 86),
      a("John", 10, 9, 10, 82),
      a("Acts", 16, 31, 31, 74),
      a("Titus", 3, 5, 7, 70),
      a("1 John", 5, 11, 13, 66),
    ],
    "eternal-life": null,

    // --- Protection ---
    protection: [
      a("Psalms", 91, 1, 4, 100),
      a("Psalms", 46, 1, 3, 94),
      a("Psalms", 121, 1, 8, 92),
      a("Isaiah", 41, 10, 10, 88),
      a("2 Thessalonians", 3, 3, 3, 80),
      a("Proverbs", 18, 10, 10, 76),
      a("Psalms", 27, 1, 1, 72),
      a("Deuteronomy", 31, 6, 6, 68),
      a("Isaiah", 43, 1, 2, 64),
    ],

    // --- Faithfulness / trust ---
    faithfulness: [
      a("Lamentations", 3, 21, 23, 100),
      a("Hebrews", 10, 23, 23, 92),
      a("Proverbs", 3, 5, 6, 90),
      a("Deuteronomy", 7, 9, 9, 84),
      a("Numbers", 23, 19, 19, 80),
      a("2 Timothy", 2, 13, 13, 76),
      a("Psalms", 36, 5, 5, 70),
      a("1 Corinthians", 1, 9, 9, 66),
      a("Malachi", 3, 6, 6, 62),
    ],
    trust: null,
    presence: [
      a("Isaiah", 41, 10, 10, 96),
      a("Matthew", 28, 18, 20, 94),
      a("Hebrews", 13, 5, 6, 90),
      a("Deuteronomy", 31, 6, 6, 88),
      a("Psalms", 139, 7, 12, 82),
      a("Joshua", 1, 8, 9, 78),
      a("Zephaniah", 3, 16, 17, 74),
    ],
    courage: [
      a("Joshua", 1, 8, 9, 100),
      a("Deuteronomy", 31, 6, 6, 94),
      a("Isaiah", 41, 10, 10, 90),
      a("2 Timothy", 1, 7, 7, 86),
      a("Psalms", 27, 1, 1, 78),
      a("Psalms", 31, 24, 24, 70),
    ],
    comfort: [
      a("2 Corinthians", 1, 3, 4, 100),
      a("Psalms", 23, 1, 4, 94),
      a("Matthew", 11, 28, 30, 90),
      a("Psalms", 34, 15, 18, 86),
      a("Isaiah", 40, 1, 2, 80),
      a("John", 14, 16, 18, 74),
    ],
    rest: [
      a("Matthew", 11, 28, 30, 100),
      a("Psalms", 23, 1, 4, 88),
      a("Exodus", 33, 14, 14, 80),
      a("Hebrews", 4, 9, 11, 72),
      a("Isaiah", 40, 28, 31, 68),
    ],
    happy: [
      a("Psalms", 16, 11, 11, 80),
      a("Philippians", 4, 4, 5, 76),
      a("Nehemiah", 8, 10, 10, 72),
      a("John", 15, 11, 11, 68),
      a("Psalms", 126, 3, 3, 64),
    ],
    grateful: [
      a("1 Thessalonians", 5, 16, 18, 84),
      a("Psalms", 100, 4, 5, 80),
      a("Psalms", 103, 1, 5, 76),
      a("Colossians", 3, 15, 17, 70),
    ],
  };

  // Aliases share the same anchor arrays
  const ALIASES = {
    stress: "anxiety",
    stressed: "anxiety",
    anxious: "anxiety",
    worried: "anxiety",
    worry: "anxiety",
    afraid: "fear",
    scared: "fear",
    lonely: "loneliness",
    alone: "loneliness",
    abandoned: "loneliness",
    sadness: "grief",
    sad: "grief",
    depression: "grief",
    depressed: "grief",
    angry: "anger",
    bitterness: "anger",
    bitter: "anger",
    guilt: "forgiveness",
    guilty: "forgiveness",
    shame: "forgiveness",
    ashamed: "forgiveness",
    hopeless: "hope",
    hopelessness: "hope",
    hopeful: "hope",
    weariness: "strength",
    weary: "strength",
    burnout: "strength",
    burned: "strength",
    tired: "strength",
    exhausted: "strength",
    confusion: "guidance",
    confused: "guidance",
    decision: "guidance",
    wisdom: "guidance",
    money: "provision",
    need: "provision",
    finances: "provision",
    peaceful: "peace",
    rejection: "love",
    rejected: "love",
    unloved: "love",
    loved: "love",
    "eternal-life": "salvation",
    trust: "faithfulness",
  };

  // Fear shares anxiety core + courage anchors
  TOPIC_ANCHORS.fear = TOPIC_ANCHORS.anxiety
    .slice()
    .concat([
      a("Psalms", 27, 1, 1, 76),
      a("Psalms", 23, 1, 4, 74),
      a("Romans", 8, 15, 15, 60),
      a("1 John", 4, 16, 18, 70),
    ]);

  Object.keys(ALIASES).forEach((k) => {
    TOPIC_ANCHORS[k] = TOPIC_ANCHORS[ALIASES[k]];
  });

  function a(book, chapter, verseStart, verseEnd, weight) {
    return { book: book, chapter: chapter, verseStart: verseStart, verseEnd: verseEnd, weight: weight };
  }

  function normalizeBook(book) {
    const n = String(book || "")
      .toLowerCase()
      .trim();
    if (n === "psalm") return "psalms";
    return n;
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "'")
      .trim();
  }

  function bookOrderIndex(book) {
    const i = BOOK_INDEX[normalizeBook(book)];
    return i == null ? 999 : i;
  }

  function promiseOverlapsAnchor(p, anchor) {
    if (normalizeBook(p.book) !== normalizeBook(anchor.book)) return false;
    if (Number(p.chapter) !== Number(anchor.chapter)) return false;
    const ps = Number(p.verseStart);
    const pe = Number(p.verseEnd != null ? p.verseEnd : ps);
    const as = Number(anchor.verseStart);
    const ae = Number(anchor.verseEnd != null ? anchor.verseEnd : as);
    return !(pe < as || ps > ae);
  }

  /** Intent id → primary topical keys for anchor ranking */
  const INTENT_PRIMARY_TOPICS = {
    stressed: ["anxiety"],
    anxious: ["anxiety", "fear"],
    lonely: ["loneliness", "presence"],
    sad: ["grief", "comfort"],
    angry: ["anger"],
    guilty: ["forgiveness"],
    hopeless: ["hope"],
    weary: ["strength", "rest"],
    confused: ["guidance"],
    happy: ["happy", "grateful"],
    loved: ["love"],
    unloved: ["love", "loneliness"],
  };

  function resolveTopicKey(key) {
    if (!key) return null;
    const k = normalize(key).replace(/\s+/g, "-");
    if (TOPIC_ANCHORS[k]) return ALIASES[k] || k;
    const plain = k.replace(/-/g, "");
    if (TOPIC_ANCHORS[plain]) return ALIASES[plain] || plain;
    return null;
  }

  /**
   * Collect weighted topic keys from plan + filters.
   * Primary intent topics get full anchor weight; soft/secondary get a reduced factor.
   * @returns {Array<{key: string, factor: number}>}
   */
  function detectTopics(plan, filters) {
    const byKey = Object.create(null);
    const add = (key, factor) => {
      const resolved = resolveTopicKey(key);
      if (!resolved) return;
      const f = factor == null ? 1 : factor;
      if (!byKey[resolved] || f > byKey[resolved]) byKey[resolved] = f;
    };

    if (plan) {
      const intentId =
        (plan.intent && plan.intent.intentId) || plan.rankingIntentId || null;
      if (intentId && INTENT_PRIMARY_TOPICS[intentId]) {
        INTENT_PRIMARY_TOPICS[intentId].forEach((t) => add(t, 1));
      } else if (intentId) {
        add(intentId, 1);
      }
      // Keyword may alias to a side topic (e.g. burnout → strength); keep soft
      // so it cannot outrank the primary intent topic list above.
      if (plan.intent && plan.intent.keyword) add(plan.intent.keyword, 0.35);

      // Soft feelings / clarify options: secondary (do not outrank primary topical hits)
      (plan.softFeelings || []).forEach((f) => add(f, 0.45));
      (plan.boostFeelings || []).forEach((f) => add(f, 0.55));
      (plan.boostThemes || []).forEach((t) => add(t, 0.35));
      (plan.boostTerms || []).forEach((t) => add(t, 0.4));
      (plan.contentTokens || []).forEach((t) => add(t, intentId ? 0.35 : 1));
    }

    if (filters) {
      if (filters.feeling) add(filters.feeling, plan && plan.intent ? 0.4 : 1);
      if (filters.theme) add(filters.theme, plan && plan.intent ? 0.5 : 1);
    }

    return Object.keys(byKey).map((key) => ({ key: key, factor: byKey[key] }));
  }

  /**
   * Best (factor-scaled) anchor weight for this promise under the given topics.
   */
  function anchorBoost(p, topics) {
    let best = 0;
    let matchedTopic = null;
    for (const entry of topics) {
      const topic = entry.key || entry;
      const factor = entry.factor != null ? entry.factor : 1;
      const anchors = TOPIC_ANCHORS[topic];
      if (!anchors) continue;
      for (const anchor of anchors) {
        if (promiseOverlapsAnchor(p, anchor)) {
          const w = anchor.weight * factor;
          if (w > best) {
            best = w;
            matchedTopic = topic;
          }
        }
      }
    }
    return { boost: best, topic: matchedTopic };
  }

  /**
   * Full relevance score for a promise given plan (+ optional filters).
   * Higher = more relevant.
   */
  function scorePromise(p, plan, filters) {
    if (!plan && !(filters && (filters.feeling || filters.theme))) return 0;

    let popularity = 0;
    let relevance = 0;
    const topics = detectTopics(plan, filters);
    const anchored = anchorBoost(p, topics);

    // Primary: researched topical popularity (OpenBible / YouVersion-style weights)
    if (anchored.boost > 0) {
      popularity = anchored.boost;
      const primaryHit = topics.some(
        (t) => (t.key || t) === anchored.topic && (t.factor == null || t.factor >= 0.95)
      );
      if (primaryHit) popularity += 1; // tiny tie-break within same weight band
    }

    const feelings = p.feelings || [];
    const themes = p.themes || [];
    const terms = (p.searchTerms || []).map(normalize);
    const promiseText = normalize(p.promise || "");
    const hay = normalize(
      [
        p.reference,
        p.book,
        p.promise,
        p.text,
        ...(themes || []),
        ...(feelings || []),
        ...(p.searchTerms || []),
      ].join(" ")
    );

    if (plan) {
      // Secondary: feeling / theme tag overlap with intent
      for (const f of plan.boostFeelings || []) {
        if (feelings.includes(f)) relevance += 14;
      }
      for (const f of plan.softFeelings || []) {
        if (feelings.includes(f)) relevance += 10;
      }
      for (const t of plan.boostThemes || []) {
        if (themes.includes(t)) relevance += 12;
      }

      // Secondary: searchTerms / paraphrase keyword hits (incl. soft context)
      for (const term of plan.boostTerms || []) {
        const nt = normalize(term);
        if (!nt) continue;
        if (terms.some((x) => x === nt || x.includes(nt))) relevance += 8;
        else if (promiseText.includes(nt)) relevance += 6;
        else if (hay.includes(nt)) relevance += 2;
      }

      // Synonym group hits (prefer searchTerms / feelings over full haystack)
      for (const group of plan.orGroups || []) {
        let hitTier = 0;
        for (const syn of group) {
          const ns = normalize(syn);
          if (!ns) continue;
          if (feelings.includes(syn) || feelings.includes(ns)) {
            hitTier = Math.max(hitTier, 3);
          } else if (terms.includes(ns) || terms.some((x) => x === ns)) {
            hitTier = Math.max(hitTier, 3);
          } else if (promiseText.includes(ns)) {
            hitTier = Math.max(hitTier, 2);
          } else if (hay.includes(ns)) {
            hitTier = Math.max(hitTier, 1);
          }
        }
        if (hitTier === 3) relevance += 6;
        else if (hitTier === 2) relevance += 4;
        else if (hitTier === 1) relevance += 2;
      }

      for (const t of plan.boostThemes || []) {
        const nt = normalize(t);
        if (terms.some((x) => x.includes(nt)) || promiseText.includes(nt)) {
          relevance += 4;
        }
      }

      for (const tok of plan.andTokens || []) {
        const nt = normalize(tok);
        if (!nt || nt.length < 2) continue;
        if (terms.some((x) => x.includes(nt)) || promiseText.includes(nt)) relevance += 3;
        else if (hay.includes(nt)) relevance += 1;
      }
    }

    if (filters) {
      if (filters.feeling && feelings.includes(filters.feeling)) relevance += 8;
      if (filters.theme && themes.includes(filters.theme)) relevance += 8;
    }

    // Popularity dominates; relevance only orders within the same popularity band
    return popularity * 1000 + relevance;
  }

  /**
   * Compare two scored items; stable tie-break by book order then verse.
   */
  function compareScored(a, b) {
    if (b.score !== a.score) return b.score - a.score;
    const bi = bookOrderIndex(a.p.book);
    const bj = bookOrderIndex(b.p.book);
    if (bi !== bj) return bi - bj;
    if (a.p.chapter !== b.p.chapter) return a.p.chapter - b.p.chapter;
    return (a.p.verseStart || 0) - (b.p.verseStart || 0);
  }

  /**
   * Rank filtered items; attach score + relevanceTier (1–3 for top hits).
   * @param {Array<{p: object}>} items
   * @param {object|null} plan
   * @param {{feeling?: string, theme?: string}|null} filters
   */
  function rankItems(items, plan, filters) {
    const scored = items.map((item, idx) => ({
      item: item,
      p: item.p,
      score: scorePromise(item.p, plan, filters),
      idx: idx,
    }));
    scored.sort((a, b) => compareScored(a, b) || a.idx - b.idx);

    // Mark top 1–3 popularity-anchored hits (avoid cluttering keyword-only matches)
    const popularityFloor = 50 * 1000; // anchor weight ≥ ~50
    let tier = 0;
    for (let i = 0; i < scored.length && i < 3; i++) {
      const s = scored[i];
      if (s.score < popularityFloor) break;
      tier += 1;
      s.relevanceTier = tier;
      s.relevanceLabel = tier === 1 ? "Most popular" : "Popular";
    }

    return scored;
  }

  global.GodsPromisesRelevance = {
    TOPIC_ANCHORS: TOPIC_ANCHORS,
    detectTopics: detectTopics,
    scorePromise: scorePromise,
    rankItems: rankItems,
    promiseOverlapsAnchor: promiseOverlapsAnchor,
    bookOrderIndex: bookOrderIndex,
  };
})(typeof window !== "undefined" ? window : globalThis);
