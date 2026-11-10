/**
 * Vercel Cron: GET /api/daily-email
 * Requires CRON_SECRET. Sends with RESEND_API_KEY. See docs/morning-email.md.
 */
"use strict";

const { createHandler } = require("./_lib/daily-email-core");

module.exports = createHandler();
