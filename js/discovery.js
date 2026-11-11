/**
 * Scripture discovery for His Promise Daily.
 * Understands a query, retrieves curated connections, and splits them into
 * directly relevant passages and related perspectives. No network and no AI.
 * Generic words such as God, peace, or help never pull in an unrelated verse.
 */
(function (global) {
  "use strict";

  const DATA = global.GodsPromisesDiscoveryData;
  const DIRECT_MIN = 72;
  const RELATED_MIN = 46;

  const ROLE_LABELS = {
    promise: "Promise",
    principle: "Principle",
    instruction: "Instruction",
    encouragement: "Encouragement",
    related: "Related passage",
  };

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9'\s-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasWord(text, word) {
    if (!word) return false;
    if (word.indexOf(" ") !== -1) return (" " + text + " ").indexOf(" " + word + " ") !== -1;
    const re = new RegExp("(^|[^a-z0-9])" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)");
    return re.test(text);
  }

  function editAtMost1(a, b) {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 1) return 2;
    if (la === lb) {
      let first = -1;
      let diffs = 0;
      for (let i = 0; i < la; i++) {
        if (a.charAt(i) === b.charAt(i)) continue;
        diffs += 1;
        if (first < 0) first = i;
        if (diffs > 2) return 2;
      }
      if (diffs === 1) return 1;
      if (diffs === 2 && first < la - 1 && a.charAt(first) === b.charAt(first + 1) && a.charAt(first + 1) === b.charAt(first)) {
        for (let j = first + 2; j < la; j++) if (a.charAt(j) !== b.charAt(j)) return 2;
        return 1;
      }
      return 2;
    }
    const longer = la > lb ? a : b;
    const shorter = la > lb ? b : a;
    let i = 0;
    let j = 0;
    let skips = 0;
    while (i < longer.length && j < shorter.length) {
      if (longer.charAt(i) === shorter.charAt(j)) { i += 1; j += 1; }
      else { skips += 1; i += 1; if (skips > 1) return 2; }
    }
    return 1;
  }

  function signalWords() {
    const words = [];
    const concepts = DATA.CONCEPTS;
    Object.keys(concepts).forEach((id) => {
      (concepts[id].signals || []).forEach((sig) => {
        String(sig).split(/[^a-z]+/).forEach((part) => {
          if (part.length >= 5) words.push(part);
        });
      });
    });
    return Array.from(new Set(words));
  }

  function correctQuery(query) {
    const dict = signalWords();
    const known = new Set(dict);
    let changed = false;
    const next = String(query || "").replace(/[A-Za-z]+/g, (word) => {
      const n = normalize(word);
      if (n.length < 5 || known.has(n)) return word;
      const hits = [];
      for (let i = 0; i < dict.length; i++) if (editAtMost1(n, dict[i]) === 1) hits.push(dict[i]);
      if (!hits.length) return word;
      hits.sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
      if (hits.length > 1 && hits[0].length === hits[1].length) return word;
      changed = true;
      return hits[0];
    });
    return changed ? next : null;
  }

  function scoreConcepts(text) {
    const scored = [];
    Object.keys(DATA.CONCEPTS).forEach((id) => {
      const concept = DATA.CONCEPTS[id];
      let score = 0;
      const weights = concept.weights || {};
      (concept.signals || []).forEach((sig) => {
        const w = weights[sig] || (sig.indexOf(" ") === -1 ? 3 : 6);
        if (hasWord(text, sig)) score += w;
      });
      if (score > 0) scored.push({ id: id, score: score, concept: concept });
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

function pickIntention(concept, text) {
  const list = concept.intentions || [];
  for (let i = 0; i < list.length; i++) {
    const intent = list[i];
    if (!intent.when || !intent.when.length) return intent;
    for (let j = 0; j < intent.when.length; j++) {
      if (hasWord(text, intent.when[j])) return intent;
    }
  }
  return list[list.length - 1] || { id: "default", heading: "Passages that may speak to this", intro: "", direct: [], related: [] };
}

function intentionById(concept, id) {
  const list = (concept && concept.intentions) || [];
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

function mentionsMoney(text) {
  return hasWord(text, "money") || hasWord(text, "bills") || hasWord(text, "debt") || hasWord(text, "rich") || hasWord(text, "wealth") || hasWord(text, "broke") || hasWord(text, "rent");
}

function fearWords(text) {
  return hasWord(text, "fear") || hasWord(text, "afraid") || hasWord(text, "anxiety") || hasWord(text, "anxious") || hasWord(text, "scared") || hasWord(text, "worry") || hasWord(text, "worried") || hasWord(text, "panic");
}

function comingNext(text) {
  return hasWord(text, "what comes next") || hasWord(text, "what's next") || hasWord(text, "what is next") || hasWord(text, "what is coming") || hasWord(text, "what's coming") || hasWord(text, "comes next");
}

function blockedLoss(text) {
  return hasWord(text, "lost someone") || hasWord(text, "lost my money") || hasWord(text, "lost my job") || hasWord(text, "lost my patience") || hasWord(text, "lost my temper") || hasWord(text, "died") || hasWord(text, "death") || hasWord(text, "passed away") || hasWord(text, "funeral") || hasWord(text, "wallet") || hasWord(text, "keys") || hasWord(text, "job") || hasWord(text, "money");
}

function reading(concept, intention, also, note) {
  return { concept: concept, intention: intention, also: also || [], note: note || "" };
}

/**
 * Context-sensitive phrases. First match wins. A phrase locks one subject and
 * one intention; `also` may add a second already-curated intention. It does
 * not copy a synonym into every category, and it does not change a passage's
 * label or why-line.
 */
function readMeaning(text) {
  const overwhelmed = hasWord(text, "overwhelmed");
  const stressed = hasWord(text, "stressed") || hasWord(text, "stress") || hasWord(text, "under pressure");
  if ((overwhelmed || stressed) && mentionsMoney(text)) return reading("wealth", "worry");
  if ((overwhelmed || stressed) && fearWords(text)) return reading("fear", comingNext(text) || hasWord(text, "future") || hasWord(text, "tomorrow") ? "future" : "anxiety");
  if (fearWords(text) && comingNext(text)) return reading("fear", "future");
  if (overwhelmed && (hasWord(text, "work") || hasWord(text, "job") || hasWord(text, "career") || hasWord(text, "boss") || hasWord(text, "deadline") || hasWord(text, "workload"))) {
    return reading("composure", "rest");
  }
  if (overwhelmed && (hasWord(text, "everything") || hasWord(text, "life") || hasWord(text, "it all") || hasWord(text, "all of it"))) {
    return reading("composure", "rest", [{ concept: "hardship", intention: "hard" }], "Because the weight is life as a whole, passages about help in a hard season are included after the rest passages. They do not say the season will be short.");
  }
  if (hasWord(text, "can't cope") || hasWord(text, "cannot cope") || hasWord(text, "cant cope")) {
    return reading("composure", "strength", [{ concept: "composure", intention: "rest" }], "Not being able to cope is heard as a need for strength to continue, with rest for a heavy load beside it. Neither says the load will vanish.");
  }
  if (!mentionsMoney(text) && (hasWord(text, "on my shoulders") || hasWord(text, "on my shoulder") || hasWord(text, "too much to carry") || hasWord(text, "carrying too much") || hasWord(text, "feel burdened") || hasWord(text, "feeling burdened") || hasWord(text, "i am burdened") || hasWord(text, "i'm burdened") || hasWord(text, "im burdened") || hasWord(text, "so burdened"))) {
    return reading("composure", "rest");
  }
  if (hasWord(text, "giving up") || hasWord(text, "give up") || hasWord(text, "can't go on") || hasWord(text, "cannot go on") || hasWord(text, "cant go on")) {
    return reading("composure", "strength");
  }
  if (!mentionsMoney(text) && (hasWord(text, "drained") || hasWord(text, "burnt out") || hasWord(text, "burned out") || hasWord(text, "wiped out") || hasWord(text, "running on empty"))) {
    return reading("composure", "rest");
  }
  if ((hasWord(text, "exhausted") || hasWord(text, "weary") || hasWord(text, "worn out")) && (hasWord(text, "strength") || hasWord(text, "keep going"))) {
    return reading("composure", "rest", [{ concept: "composure", intention: "strength" }], "The words ask for rest and for strength to continue. Rest is listed first. The strength passages are included with it, and they are not a promise that you will feel rested or that you will succeed.");
  }
  if (hasWord(text, "running out of strength") || hasWord(text, "out of strength") || hasWord(text, "no strength left")) {
    return reading("composure", "strength", [{ concept: "composure", intention: "rest" }]);
  }
  if (hasWord(text, "lost") && !blockedLoss(text) && (hasWord(text, "feel") || hasWord(text, "feeling") || hasWord(text, "i am lost") || hasWord(text, "i'm lost") || hasWord(text, "im lost") || hasWord(text, "so lost") || hasWord(text, "lost my way"))) {
    return reading("guidance", "decision");
  }
  if (stressed && !mentionsMoney(text) && !fearWords(text)) return reading("composure", "rest");
  return null;
}

  const EMOTIONS = { composure: 1, fear: 1, loneliness: 1, grief: 1, doubt: 1 };

function understand(query) {
  const text = normalize(query);
  if (!text) return null;
  const phrase = readMeaning(text);
  if (phrase && DATA.CONCEPTS[phrase.concept]) {
    const intention = intentionById(DATA.CONCEPTS[phrase.concept], phrase.intention);
    if (intention) {
      return {
        text: text,
        conceptId: phrase.concept,
        intentionId: intention.id,
        ambiguous: false,
        heading: intention.heading,
        intro: phrase.note ? intention.intro + " " + phrase.note : intention.intro,
        direct: intention.direct || [],
        related: intention.related || [],
        score: 12,
        also: phrase.also,
      };
    }
  }
  const scored = scoreConcepts(text);
    if (!scored.length || scored[0].score < 3) return null;
    let primary = scored[0];
    let second = scored[1];
    // A concrete subject (money, marriage, children) keeps the query when an
    // emotion word is also present. "Anxious about money" stays a money question.
    if (second && EMOTIONS[primary.id] && !EMOTIONS[second.id] && second.score >= 4 && second.score >= primary.score * 0.75) {
      const swap = primary;
      primary = second;
      second = swap;
    }
    const ambiguous = !!(second && !EMOTIONS[primary.id] && !EMOTIONS[second.id] && second.score >= 4 && second.score >= primary.score * 0.72);
    const intention = pickIntention(primary.concept, text);
    if (ambiguous) {
      return {
        text: text,
        conceptId: primary.id,
        intentionId: intention.id,
        ambiguous: true,
        heading: "Passages that may speak to this",
        intro: "This could be heard in more than one way (" + primary.concept.intentions[0].heading.toLowerCase() + ", or " + second.concept.label + "). The passages below stay with the stronger reading and do not force a single emotion onto it.",
        direct: intention.direct || [],
        related: intention.related || [],
        score: primary.score,
        also: [],
      };
    }
    return {
      text: text,
      conceptId: primary.id,
      intentionId: intention.id,
      ambiguous: false,
      heading: intention.heading,
      intro: intention.intro,
      direct: intention.direct || [],
      related: intention.related || [],
      score: primary.score,
      also: [],
    };
  }

  function rankLinks(understood, list) {
    const ranked = [];
    const seen = new Set();
    DATA.LINKS.forEach((link) => {
      if (link.concept !== understood.conceptId) return;
      const resolved = resolveLink(link, list);
      if (!resolved) return;
      const scored = scoreLink(link, understood, resolved.text);
      const row = {
        id: resolved.id,
        reference: resolved.reference,
        book: resolved.book,
        chapter: resolved.chapter,
        verseStart: resolved.verseStart,
        verseEnd: resolved.verseEnd,
        text: resolved.text,
        themes: resolved.themes,
        feelings: resolved.feelings,
        supplement: resolved.supplement,
        promise: resolved.promise,
        role: link.role,
        roleLabel: ROLE_LABELS[link.role] || "Related passage",
        why: link.why,
        angle: link.angle,
        score: Math.round(scored.score * 10) / 10,
        band: scored.band,
      };
      const prev = seen.has(row.id) ? ranked.find((r) => r.id === row.id) : null;
      if (prev) {
        if (row.score > prev.score) ranked[ranked.indexOf(prev)] = row;
        return;
      }
      seen.add(row.id);
      ranked.push(row);
    });
    return ranked;
  }

  function overlaps(p, link) {
    if (!p) return false;
    if (String(p.book).toLowerCase() !== String(link.book).toLowerCase()) return false;
    if (Number(p.chapter) !== Number(link.chapter)) return false;
    const ps = Number(p.verseStart);
    const pe = Number(p.verseEnd != null ? p.verseEnd : ps);
    return !(pe < link.verseStart || ps > link.verseEnd);
  }

  function spanSize(p) {
    return Number(p.verseEnd != null ? p.verseEnd : p.verseStart) - Number(p.verseStart);
  }

  function resolveLink(link, promises) {
    let best = null;
    for (let i = 0; i < promises.length; i++) {
      const p = promises[i];
      if (!overlaps(p, link)) continue;
      if (!best || spanSize(p) < spanSize(best)) best = p;
    }
    if (best) {
      return {
        id: best.id,
        reference: best.reference,
        book: best.book,
        chapter: best.chapter,
        verseStart: best.verseStart,
        verseEnd: best.verseEnd,
        text: best.text,
        themes: best.themes || [],
        feelings: best.feelings || [],
        supplement: false,
        promise: best,
      };
    }
    let found = null;
    Object.keys(DATA.SUPPLEMENTS).forEach((k) => {
      if (DATA.SUPPLEMENTS[k].id === link.supplementId) found = DATA.SUPPLEMENTS[k];
    });
    if (!found) return null;
    const ref = found.verseStart === found.verseEnd
      ? found.book + " " + found.chapter + ":" + found.verseStart
      : found.book + " " + found.chapter + ":" + found.verseStart + "–" + found.verseEnd;
    return {
      id: found.id,
      reference: ref,
      book: found.book,
      chapter: found.chapter,
      verseStart: found.verseStart,
      verseEnd: found.verseEnd,
      text: found.text,
      themes: [],
      feelings: [],
      supplement: true,
      promise: null,
    };
  }

  function scoreLink(link, understood, resolvedText) {
    const direct = (link.direct || []).indexOf(understood.intentionId) !== -1;
    const related = (link.related || []).indexOf(understood.intentionId) !== -1;
    let factor = 0.22;
    if (direct) factor = 1;
    else if (related) factor = 0.64;
    let score = link.directness * factor;
    const aliases = link.aliases || [];
    for (let i = 0; i < aliases.length; i++) {
      if (understood.text.indexOf(aliases[i]) !== -1) score += 28;
    }
    return { score: score, band: direct ? "direct" : related ? "related" : "edge" };
  }

  function discover(query, promises) {
    const list = promises || [];
    let corrected = null;
    let understood = understand(query);
    if (!understood) {
      corrected = correctQuery(query);
      if (corrected) understood = understand(corrected);
    }
    if (!understood) {
      return {
        mode: "fallback",
        heading: "This search wasn’t clear",
        intro: "The search wasn’t understood well enough to choose scriptures for it.",
        note: "",
        conceptId: null,
        intentionId: null,
        corrected: corrected,
        direct: [],
        related: [],
        query: query,
      };
    }
    const ranked = rankLinks(understood, list);
    (understood.also || []).forEach((extra) => {
      if (!extra || extra.concept === understood.conceptId && extra.intention === understood.intentionId) return;
      const more = rankLinks({ text: understood.text, conceptId: extra.concept, intentionId: extra.intention }, list);
      more.forEach((row) => {
        row.score = Math.round(row.score * 0.9 * 10) / 10;
        const prev = ranked.find((item) => item.id === row.id);
        if (!prev) ranked.push(row);
        else if (row.score > prev.score) ranked[ranked.indexOf(prev)] = row;
      });
    });
    ranked.sort((a, b) => b.score - a.score || b.verseStart - a.verseStart);
    const direct = ranked.filter((r) => r.score >= DIRECT_MIN);
    const related = ranked.filter((r) => r.score >= RELATED_MIN && r.score < DIRECT_MIN);
    if (!direct.length && !related.length) {
      return {
        mode: "limited",
        heading: understood.heading,
        intro: understood.intro,
        note: "The search found limited matches for this, and it is not padding the list with unrelated comfort verses.",
        conceptId: understood.conceptId,
        intentionId: understood.intentionId,
        corrected: corrected,
        direct: [],
        related: [],
        query: query,
      };
    }
    const thin = direct.length + related.length < 3;
    return {
      mode: "results",
      heading: understood.heading,
      intro: understood.intro,
      note: thin ? "The search found limited matches. Only passages that clearly belong are shown." : "",
      conceptId: understood.conceptId,
      intentionId: understood.intentionId,
      ambiguous: understood.ambiguous,
      corrected: corrected,
      direct: direct,
      related: related,
      query: query,
    };
  }

  function studyResult(study, promises) {
    const list = promises || [];
    const parts = study.parts && study.parts.length
      ? study.parts
      : [{ concept: study.concept, intention: study.intention, group: "direct" }];
    const direct = [];
    const related = [];
    const seen = new Set();
    parts.forEach((part) => {
      const ranked = rankLinks({ text: "", conceptId: part.concept, intentionId: part.intention }, list);
      ranked.sort((a, b) => b.score - a.score || b.verseStart - a.verseStart);
      ranked.forEach((row) => {
        if (seen.has(row.id) || row.score < RELATED_MIN) return;
        if (part.book && row.book !== part.book) return;
        if (part.chapter && Number(row.chapter) !== Number(part.chapter)) return;
        seen.add(row.id);
        const placeRelated = part.group === "related" || row.score < DIRECT_MIN;
        if (placeRelated) related.push(row);
        else direct.push(row);
      });
    });
    direct.sort((a, b) => b.score - a.score || b.verseStart - a.verseStart);
    related.sort((a, b) => b.score - a.score || b.verseStart - a.verseStart);
    while (direct.length + related.length > 24) {
      if (related.length) related.pop();
      else direct.pop();
    }
    const primary = parts[0] || {};
    const n = direct.length + related.length;
    return {
      mode: n ? "results" : "limited",
      heading: study.heading,
      intro: study.intro,
      note: study.note || (n && n < 3 ? "The search found limited matches. Only passages that clearly belong are shown." : ""),
      conceptId: study.concept || primary.concept || "filter",
      intentionId: study.intention || primary.intention || "filter",
      query: study.query || "",
      filterStudy: true,
      direct: direct,
      related: related,
    };
  }

  global.GodsPromisesDiscovery = {
    discover: discover,
    understand: understand,
    correctQuery: correctQuery,
    studyResult: studyResult,
    ROLE_LABELS: ROLE_LABELS,
    DIRECT_MIN: DIRECT_MIN,
    RELATED_MIN: RELATED_MIN,
  };
})(typeof window !== "undefined" ? window : globalThis);
