#!/usr/bin/env node
/**
 * Local preview for the explanation feedback widget: serves dist/ and mounts the real
 * /api/feedback handler. Storage is an in-memory fake of the Supabase RPCs unless
 * FEEDBACK_DEV_RPC points at a module exporting an async rpc(fn, args) (e.g. a local Postgres).
 *
 *   python3 scripts/build_site.py --target production && node scripts/dev_feedback_server.js [port]
 *
 * FEEDBACK_DEV_FAIL=1 makes every feedback request fail with 502 (to preview the error state).
 * Development only: never deployed (Vercel serves dist/ plus api/).
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { createHandler } = require("../api/_lib/feedback-core");
const { createFakeRpc } = require("../tests/helpers/fake-feedback-rpc");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const port = Number(process.argv[2] || 8790);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };
const rpc = process.env.FEEDBACK_DEV_RPC ? require(path.resolve(process.env.FEEDBACK_DEV_RPC)) : createFakeRpc();
const failing = process.env.FEEDBACK_DEV_FAIL === "1";
const handler = createHandler({
  env: { SUPABASE_URL: "https://local.invalid", SUPABASE_SERVICE_ROLE_KEY: "dev-only-not-a-secret-000000", FEEDBACK_HASH_SECRET: "dev-only-hash-secret-0000000000000000" },
  rpc: failing ? async () => { throw new Error("simulated outage"); } : rpc,
});

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/feedback") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      req.body = chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined;
      handler(req, res);
    });
    return;
  }
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) { res.statusCode = 400; return res.end(); }
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}).listen(port, () => console.log(`feedback preview on http://localhost:${port}/ (${failing ? "failing" : process.env.FEEDBACK_DEV_RPC ? "custom rpc" : "in-memory"} storage)`));
