#!/usr/bin/env python3
"""Rewrite promise/context fields for comforting, beginner-clear tone.

Durable workflow:
  1. Hand / batch rewrites live in scripts/comfort_work/rewrites.json
     Shape: { "<id>": {"promise": "...", "context": "..."} }  (context optional)
  2. Run this script to merge into promises.json + regenerate promises-data.js
  3. Progress tracked in scripts/comfort_work/progress.json

Also includes an auto-softener for any ids still missing from rewrites.json,
so you can resume / fill gaps — but prefer human batch entries for quality.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = Path(__file__).resolve().parent / "comfort_work"
REWRITES_PATH = WORK / "rewrites.json"
PROGRESS_PATH = WORK / "progress.json"
JSON_PATH = ROOT / "promises.json"
JS_PATH = ROOT / "promises-data.js"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_rewrites(rewrites: dict) -> None:
    REWRITES_PATH.write_text(
        json.dumps(rewrites, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def soft_vocab(s: str) -> str:
    """Light vocabulary softening — not a full rewrite."""
    reps = [
        (r"\bhumanity\b", "people"),
        (r"\bHumankind\b", "People"),
        (r"\bhumankind\b", "people"),
        (r"\bfruitfulness\b", "growth and new life"),
        (r"\bdominion over\b", "care for"),
        (r"\bentrusts them with\b", "gives them a place to"),
        (r"\biniquity\b", "sin"),
        (r"\btransgression(s)?\b", "wrong(s)"),
        (r"\bprecepts\b", "teachings"),
        (r"\bstatutes\b", "ways"),
        (r"\bordinances\b", "ways"),
        (r"\bBehold,\s*", ""),
        (r"\bthe LORD’s\b", "God's"),
        (r"\bThe LORD’s\b", "God's"),
        (r"\bthe LORD\b", "the Lord"),
        (r"\bThe LORD\b", "The Lord"),
        (r"\bYahweh\b", "God"),
        (r"\bransomed\b", "rescued"),
        (r"\banointed\b", "chosen one"),
        (r"\bcovenant\b", "faithful promise"),
        (r"\bCovenant\b", "Faithful promise"),
    ]
    out = s
    for pat, repl in reps:
        out = re.sub(pat, repl, out)
    # clean doubled spaces / awkward bits from removals
    out = re.sub(r"\s{2,}", " ", out).strip()
    return out


def auto_rewrite_promise(promise: str, text: str, feelings: list) -> str:
    """Fallback auto rewriter — used only when no hand rewrite exists."""
    s = promise.strip()
    # Prefer hand quality; this is a last-resort softener + framing
    s = soft_vocab(s)

    # First-person divine speech without framing
    if re.match(r'^[“"]?I\b', s) or s.startswith("I will") or s.startswith("I am") or s.startswith("I’ll"):
        body = s
        # strip leading quote marks for reframing
        body = body.lstrip("“\"'").rstrip("”\"'")
        if body.lower().startswith("i will"):
            body = "he will" + body[6:]
        elif body.lower().startswith("i am"):
            body = "he is" + body[4:]
        elif body.lower().startswith("i've") or body.lower().startswith("i have"):
            body = "he has" + body.split(" ", 1)[1][4:] if False else re.sub(r'^[Ii] have\b', 'he has', body)
            body = re.sub(r'^[Ii]’ve\b', 'he has', body)
            body = re.sub(r'^[Ii] have\b', 'he has', body)
        else:
            body = re.sub(r'^[Ii]\b', 'he', body)
        s = f"God says {body}"
        if not s.endswith("."):
            s += "."
        # fix "God says he will" capitalization mid
        s = s[0].upper() + s[1:]

    # The Lord is attributes
    if re.match(r'^(The Lord|God) is\b', s) and "," in s:
        s = f"God promises to be your safe place. {s} When you turn to him, you can rest in who he is."

    # Lead with God promises when missing warm framing
    starters = (
        "God promises", "God assures", "Here God", "God says", "God will",
        "God tells", "God gives", "God blesses", "God provides", "God cares",
        "God hears", "God sees", "God invites", "God welcomes", "God offers",
        "God reminds", "God comforts", "God protects", "God stays", "God keeps",
        "With God", "In Christ", "Jesus", "The Lord promises", "The Lord assures",
    )
    if not s.startswith(starters) and "you" not in s.lower()[:40]:
        # gentle frame without inventing content
        if s.startswith("God ") or s.startswith("The Lord "):
            pass
        elif feelings and any(f in feelings for f in ("afraid", "anxious", "lonely", "hopeless", "weary", "sad")):
            s = f"Here is comfort from God: {s[0].lower() + s[1:] if s[0].isupper() else s}"

    # Length guard — keep 1-3 sentences feel
    if len(s) > 320:
        # keep first two sentences if possible
        parts = re.split(r'(?<=[.!?])\s+', s)
        if len(parts) > 2:
            s = " ".join(parts[:2])

    return s.strip()


def soft_context(context: str) -> str:
    if not context:
        return context
    c = soft_vocab(context.strip())
    # Keep short — one sentence
    if len(c) > 160:
        c = c.split(".")[0].strip() + "."
    # Soften stiff openers
    c = re.sub(r'^Torah sweetness\.?$', 'A song about how good God’s teaching is.', c)
    c = re.sub(r'^Royal prayer before battle\.?$', 'A prayer for help before a fight.', c)
    c = re.sub(r'^Reflection on God’s character\.?$', 'A quiet thought about who God is.', c)
    return c


def merge_and_write(use_auto_fallback: bool = True) -> dict:
    WORK.mkdir(parents=True, exist_ok=True)
    data = load_json(JSON_PATH)
    rewrites = load_json(REWRITES_PATH) if REWRITES_PATH.exists() else {}

    hand = 0
    auto = 0
    context_soft = 0
    unchanged_text = 0

    for p in data["promises"]:
        pid = p["id"]
        old_text = p["text"]
        if pid in rewrites:
            entry = rewrites[pid]
            if "promise" in entry and entry["promise"].strip():
                p["promise"] = entry["promise"].strip()
                hand += 1
            if "context" in entry and entry["context"] is not None:
                p["context"] = entry["context"].strip()
                context_soft += 1
            elif use_auto_fallback:
                new_c = soft_context(p.get("context") or "")
                if new_c != p.get("context"):
                    p["context"] = new_c
                    context_soft += 1
        elif use_auto_fallback:
            p["promise"] = auto_rewrite_promise(
                p["promise"], p.get("text") or "", p.get("feelings") or []
            )
            new_c = soft_context(p.get("context") or "")
            if new_c != (p.get("context") or ""):
                p["context"] = new_c
                context_soft += 1
            auto += 1
        assert p["text"] == old_text, f"text mutated for {pid}"
        unchanged_text += 1

    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    js = (
        "/* Auto-generated from promises.json — World English Bible (public domain) */\n"
        "window.GODS_PROMISES_DATA = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n"
    )
    JS_PATH.write_text(js, encoding="utf-8")

    progress = {
        "total": len(data["promises"]),
        "hand_rewrites_applied": hand,
        "auto_fallback_applied": auto,
        "contexts_touched": context_soft,
        "texts_unchanged": unchanged_text,
        "rewrite_map_size": len(rewrites),
    }
    PROGRESS_PATH.write_text(json.dumps(progress, indent=2) + "\n", encoding="utf-8")
    return progress


def add_batch(batch: dict) -> int:
    WORK.mkdir(parents=True, exist_ok=True)
    rewrites = load_json(REWRITES_PATH) if REWRITES_PATH.exists() else {}
    rewrites.update(batch)
    save_rewrites(rewrites)
    return len(rewrites)


def status() -> None:
    data = load_json(JSON_PATH)
    rewrites = load_json(REWRITES_PATH) if REWRITES_PATH.exists() else {}
    missing = [p["id"] for p in data["promises"] if p["id"] not in rewrites]
    print(f"Total promises: {len(data['promises'])}")
    print(f"Hand rewrite map: {len(rewrites)}")
    print(f"Missing from map: {len(missing)}")
    if missing[:10]:
        print("Next missing:", ", ".join(missing[:10]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["status", "apply", "apply-hand-only"])
    args = ap.parse_args()
    if args.cmd == "status":
        status()
    elif args.cmd == "apply":
        prog = merge_and_write(use_auto_fallback=True)
        print(json.dumps(prog, indent=2))
    elif args.cmd == "apply-hand-only":
        prog = merge_and_write(use_auto_fallback=False)
        print(json.dumps(prog, indent=2))


if __name__ == "__main__":
    main()
