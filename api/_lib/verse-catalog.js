/**
 * Reads the published catalog for server routes.
 * Verse text is the World English Bible already stored on each promise.
 * Explanations are the reviewed strings. This module does not rewrite either.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const VERSE_ID_RE = /^[a-z0-9]+(?:-[0-9]+){2,3}$/;

function loadVerses(root) {
  const base = root || path.join(__dirname, "..", "..");
  const promises = JSON.parse(fs.readFileSync(path.join(base, "promises.json"), "utf8")).promises;
  const explanations = JSON.parse(fs.readFileSync(path.join(base, "data", "explanations.json"), "utf8"));
  return promises.map(function (entry) {
    const explanation = explanations[entry.id];
    return {
      id: entry.id,
      reference: entry.reference,
      book: entry.book,
      text: entry.text,
      explanation: typeof explanation === "string" ? explanation : "",
    };
  });
}

module.exports = { loadVerses, VERSE_ID_RE };
