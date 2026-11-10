/**
 * Vercel serverless function: POST /api/account
 * Deletes the signed-in Supabase user after checking the access token.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Fails closed without them.
 */
"use strict";

const { createHandler } = require("./_lib/account-core");

module.exports = createHandler();
