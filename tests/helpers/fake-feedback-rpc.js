/* In-memory stand-in for the two Supabase RPCs, mirroring the SQL semantics
 * (unique submitter+verse+version, allowlisted categories, 15 attempts / 10 min per submitter).
 * Used by tests/feedback-api.test.js and scripts/dev_feedback_server.js only. */
"use strict";
const crypto = require("crypto");
const { CATEGORIES } = require("../../api/_lib/feedback-core");

function createFakeRpc() {
  const rows = [];
  const events = [];
  async function rpc(fn, a) {
    if (fn === "hpd_feedback_status") {
      return { submitted: rows.some((r) => r.submitter_key === a.p_submitter_key && r.verse_id === a.p_verse_id && r.explanation_version === a.p_explanation_version) };
    }
    if (fn === "hpd_feedback_search_submit") {
      if (!/^[0-9a-f]{64}$/.test(a.p_submitter_key) || !/^[0-9a-f]{64}$/.test(a.p_ip_key)) throw new Error("bad key");
      if (typeof a.p_helpful !== "boolean") throw new Error("bad helpful");
      if (!a.p_helpful && !a.p_reason) throw new Error("bad reason");
      if (!Array.isArray(a.p_result_refs) || a.p_result_refs.length !== a.p_result_ids.length) throw new Error("bad refs");
      const row = {
        query: a.p_query, intent: a.p_intent, category: a.p_category,
        result_ids: a.p_result_ids, result_refs: a.p_result_refs,
        helpful: a.p_helpful, reason: a.p_reason, comment: a.p_comment,
        auth_user_id: a.p_auth_user_id || null,
      };
      rpc.searchRows.push(row);
      return { status: "created", id: crypto.randomUUID() };
    }
    if (fn !== "hpd_feedback_submit") throw new Error("unknown rpc " + fn);
    for (const k of ["p_submitter_key", "p_ip_key", "p_explanation_sha256"]) if (!/^[0-9a-f]{64}$/.test(a[k])) throw new Error("bad " + k);
    if (!a.p_categories.every((c) => CATEGORIES[a.p_rating].includes(c))) throw new Error("check_violation categories");
    if (a.p_comment !== null && [...a.p_comment].length > 500) throw new Error("check_violation comment");
    const now = Date.now();
    const recent = events.filter((e) => e.key === a.p_submitter_key && now - e.t < 600000).length;
    if (recent >= 15) return { status: "rate_limited" };
    events.push({ key: a.p_submitter_key, t: now });
    if (rows.some((r) => r.submitter_key === a.p_submitter_key && r.verse_id === a.p_verse_id && r.explanation_version === a.p_explanation_version)) {
      return { status: "duplicate" };
    }
    const row = {
      id: crypto.randomUUID(), verse_id: a.p_verse_id, reference: a.p_reference, book: a.p_book,
      chapter: a.p_chapter, verse_start: a.p_verse_start, verse_end: a.p_verse_end,
      explanation_version: a.p_explanation_version, explanation_sha256: a.p_explanation_sha256,
      language: a.p_language, rating: a.p_rating, categories: [...new Set(a.p_categories)].sort(),
      comment: a.p_comment, local_user_id: null, auth_user_id: a.p_auth_user_id || null,
      submitter_key: a.p_submitter_key,
      source: a.p_source, created_at: new Date().toISOString(),
    };
    rows.push(row);
    return { status: "created", id: row.id };
  }
  rpc.rows = rows;
  rpc.searchRows = [];
  return rpc;
}

module.exports = { createFakeRpc };
