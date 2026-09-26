"""Synonyms injected into searchTerms from feelings tags."""
FEELING_SYNONYMS = {
    "angry": ["anger", "rage", "furious", "mad", "resentful", "wrath", "irritated"],
    "anxious": ["anxiety", "worried", "worry", "nervous", "uneasy", "stressed", "overwhelmed", "panic"],
    "afraid": ["fear", "fearful", "scared", "terrified", "dread", "frightened", "alarmed"],
    "lonely": ["alone", "abandoned", "isolated", "forsaken", "forgotten", "rejected", "left out"],
    "sad": ["sorrow", "grief", "grieving", "mourning", "heartbroken", "tears", "cry", "depressed"],
    "guilty": ["guilt", "shame", "ashamed", "condemned", "regret", "remorse", "unworthy"],
    "hopeless": ["despair", "despairing", "discouraged", "defeated", "no hope", "give up", "darkness"],
    "weary": ["tired", "exhausted", "burned out", "fatigue", "worn out", "burdened", "heavy laden"],
    "happy": ["joy", "joyful", "glad", "delight", "cheerful", "rejoice"],
    "grateful": ["thankful", "thanksgiving", "gratitude", "praise", "appreciate"],
    "peaceful": ["peace", "calm", "rest", "still", "quiet", "serene", "content"],
    "hopeful": ["hope", "expectant", "confident", "looking forward", "assurance"],
    "loved": ["love", "beloved", "cherished", "accepted", "valued", "precious", "wanted"],
    "confused": ["confusion", "uncertain", "lost", "unclear", "doubt", "bewildered", "direction"],
    "bitter": ["bitterness", "resentment", "hurt", "offense", "unforgiving", "hard heart"],
    "jealous": ["jealousy", "envy", "envious", "covet", "comparison", "insecure"],
}

THEME_VOCAB = [
    "blessing", "calling", "comfort", "compassion", "courage", "covenant",
    "deliverance", "eternal-life", "faithfulness", "fear", "forgiveness",
    "future", "guidance", "healing", "hope", "identity", "joy", "justice",
    "land", "love", "mercy", "nations", "new-beginning", "offspring",
    "peace", "presence", "promise", "protection", "providence", "provision",
    "reminder", "rest", "restoration", "salvation", "strength", "victory",
    "wisdom", "prayer", "repentance", "holiness", "resurrection", "kingdom",
    "spirit", "truth", "humility", "patience", "endurance", "reward",
]

FEELINGS_VOCAB = [
    "angry", "anxious", "afraid", "lonely", "sad", "guilty", "hopeless",
    "weary", "happy", "grateful", "peaceful", "hopeful", "loved",
    "confused", "bitter", "jealous",
]

def enrich_search_terms(feelings, search_terms, extra=None):
    seen = set()
    out = []
    for t in list(search_terms or []) + list(extra or []):
        key = t.lower().strip()
        if key and key not in seen:
            seen.add(key)
            out.append(key)
    for f in feelings or []:
        for syn in FEELING_SYNONYMS.get(f, []):
            key = syn.lower().strip()
            if key not in seen:
                seen.add(key)
                out.append(key)
        if f not in seen:
            seen.add(f)
            out.append(f)
    return out
