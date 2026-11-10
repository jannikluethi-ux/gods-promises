/**
 * Square share card for one verse: Yellowtail wordmark, italic Newsreader
 * verse, reference, soft cloud blue. Used by /api/og and local previews.
 * Fonts are read from disk. No network and no secrets.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const React = require("react");
const satori = require("satori").default;
const { Resvg } = require("@resvg/resvg-js");

const WIDTH = 1080;
const HEIGHT = 1080;
const FONT_DIR = path.join(__dirname, "..", "..", "assets", "fonts");

let fontCache = null;

function loadFonts() {
  if (fontCache) return fontCache;
  fontCache = [
    { name: "Yellowtail", data: fs.readFileSync(path.join(FONT_DIR, "Yellowtail-Regular.ttf")), weight: 400, style: "normal" },
    { name: "Newsreader", data: fs.readFileSync(path.join(FONT_DIR, "Newsreader-Regular.ttf")), weight: 400, style: "normal" },
    { name: "Newsreader", data: fs.readFileSync(path.join(FONT_DIR, "Newsreader-Italic.ttf")), weight: 400, style: "italic" },
  ];
  return fontCache;
}

function verseFontSize(length) {
  if (length < 160) return 46;
  if (length < 280) return 40;
  if (length < 420) return 34;
  if (length < 620) return 29;
  if (length < 820) return 25;
  return 22;
}

function cardElement(verse) {
  const text = String(verse.text || "").replace(/\s+/g, " ").trim();
  const reference = String(verse.reference || "").replace(/\s+/g, " ").trim();
  const size = verseFontSize(text.length);
  const h = React.createElement;
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundImage: "linear-gradient(180deg, #e9eff5 0%, #e1e9f1 46%, #d3dfea 100%)",
        padding: "52px",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          backgroundColor: "#fbfcfd",
          borderRadius: "36px",
          border: "1px solid #d5dfe9",
          padding: "56px 68px 48px",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Yellowtail",
            fontSize: "78px",
            lineHeight: 1.05,
            color: "#1a2230",
          },
        },
        "His Promise Daily"
      ),
      h("div", {
        style: {
          display: "flex",
          width: "56px",
          height: "2px",
          backgroundColor: "#3d5470",
          opacity: 0.45,
          marginTop: "22px",
          marginBottom: "28px",
        },
      }),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexGrow: 1,
            alignItems: text.length > 520 ? "flex-start" : "center",
            fontFamily: "Newsreader",
            fontStyle: "italic",
            fontSize: size + "px",
            lineHeight: 1.38,
            color: "#1a2230",
          },
        },
        text
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: "28px",
            fontFamily: "Newsreader",
            fontSize: "22px",
            letterSpacing: "0.14em",
            color: "#3d5470",
            textTransform: "uppercase",
          },
        },
        reference + "  ·  WEB"
      )
    )
  );
}

async function renderShareCardPng(verse) {
  const svg = await satori(cardElement(verse), {
    width: WIDTH,
    height: HEIGHT,
    fonts: loadFonts(),
  });
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
  }).render().asPng();
  return Buffer.from(png);
}

function renderIconPng(size, maskable) {
  const pad = maskable ? Math.round(size * 0.18) : Math.round(size * 0.08);
  const cross = Math.round(size * (maskable ? 0.34 : 0.42));
  const x = Math.round((size - cross) / 2);
  const arm = Math.round(cross * 0.22);
  const stemX = x + Math.round((cross - arm) / 2);
  const barY = x + Math.round(cross * 0.28);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : Math.round(size * 0.18)}" fill="#e1e9f1"/>
  <rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${size - pad * 2}" rx="${Math.round(size * 0.12)}" fill="#fbfcfd"/>
  <rect x="${stemX}" y="${x}" width="${arm}" height="${cross}" rx="${Math.round(arm / 4)}" fill="#3d5470"/>
  <rect x="${x}" y="${barY}" width="${cross}" height="${arm}" rx="${Math.round(arm / 4)}" fill="#3d5470"/>
</svg>`;
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());
}

module.exports = {
  WIDTH,
  HEIGHT,
  renderShareCardPng,
  renderIconPng,
  verseFontSize,
};
