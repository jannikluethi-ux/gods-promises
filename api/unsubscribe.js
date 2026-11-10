/**
 * One-click unsubscribe for the morning promise email.
 * GET and POST /api/unsubscribe?token=...
 */
"use strict";

const { createHandler } = require("./_lib/unsubscribe-core");

module.exports = createHandler();
