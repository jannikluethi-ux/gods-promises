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

  const EMOTIONS = { composure: 1, fear: 1, loneliness: 1, grief: 1, doubt: 1 };

  function understand(query) {
    const text = normalize(query);
    if (!text) return null;
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
    };
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
        heading: "For a hard moment",
        intro: "",
        note: "",
        conceptId: null,
        intentionId: null,
        corrected: corrected,
        direct: [],
        related: [],
        query: query,
      };
    }
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
        if (row.score > prev.score) {
          ranked[ranked.indexOf(prev)] = row;
        }
        return;
      }
      seen.add(row.id);
      ranked.push(row);
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

  global.GodsPromisesDiscovery = {
    discover: discover,
    understand: understand,
    correctQuery: correctQuery,
    ROLE_LABELS: ROLE_LABELS,
    DIRECT_MIN: DIRECT_MIN,
    RELATED_MIN: RELATED_MIN,
  };
})(typeof window !== "undefined" ? window : globalThis);
