/**
 * Vercel serverless function: POST /api/feedback (submit), GET /api/feedback?verseId=&v= (status).
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and FEEDBACK_HASH_SECRET; fails closed (503)
 * without them. See docs/explanation-feedback.md.
 */
"use strict";

const { createHandler } = require("./_lib/feedback-core");

module.exports = createHandler();
