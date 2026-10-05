/**
 * Client-side guided intelligence for God's Promises search.
 * No external AI API — intent detection, clarifying follow-ups, synonym expand + rank.
 */
(function (global) {
  "use strict";

  const STOPWORDS = new Set([
    "i",
    "am",
    "im",
    "i'm",
    "feel",
    "feeling",
    "so",
    "very",
    "really",
    "a",
    "an",
    "the",
    "to",
    "for",
    "with",
    "my",
    "me",
    "help",
    "please",
    "about",
    "and",
    "or",
    "of",
    "in",
    "on",
    "at",
    "is",
    "are",
    "was",
    "been",
    "being",
    "just",
    "like",
    "need",
    "want",
    "some",
    "any",
    "when",
    "how",
    "what",
    "why",
    "who",
    "this",
    "that",
    "it",
    "too",
    "also",
    "struggling",
  ]);

  const BOOK_NAMES = [
    "genesis",
    "exodus",
    "leviticus",
    "numbers",
    "deuteronomy",
    "joshua",
    "judges",
    "ruth",
    "1 samuel",
    "2 samuel",
    "1 kings",
    "2 kings",
    "1 chronicles",
    "2 chronicles",
    "ezra",
    "nehemiah",
    "esther",
    "job",
    "psalms",
    "psalm",
    "proverbs",
    "ecclesiastes",
    "song of solomon",
    "isaiah",
    "jeremiah",
    "lamentations",
    "ezekiel",
    "daniel",
    "hosea",
    "joel",
    "amos",
    "obadiah",
    "jonah",
    "micah",
    "nahum",
    "habakkuk",
    "zephaniah",
    "haggai",
    "zechariah",
    "malachi",
    "matthew",
    "mark",
    "luke",
    "john",
    "acts",
    "romans",
    "1 corinthians",
    "2 corinthians",
    "galatians",
    "ephesians",
    "philippians",
    "colossians",
    "1 thessalonians",
    "2 thessalonians",
    "1 timothy",
    "2 timothy",
    "titus",
    "philemon",
    "hebrews",
    "james",
    "1 peter",
    "2 peter",
    "1 john",
    "2 john",
    "3 john",
    "jude",
    "revelation",
  ];

  /** Intent id → detection keywords (matched as whole words / phrases in normalized query) */
  const INTENT_KEYWORDS = {
    stressed: [
      "stressed",
      "stress",
      "overwhelmed",
      "overwhelm",
      "pressure",
      "pressured",
      "burned out",
      "burnt out",
      "burnout",
    ],
    lonely: [
      "lonely",
      "alone",
      "abandoned",
      "isolation",
      "isolated",
      "forsaken",
      "left out",
    ],
    anxious: [
      "anxious",
      "anxiety",
      "worry",
      "worried",
      "worries",
      "fear",
      "afraid",
      "scared",
      "fearful",
      "nervous",
      "panic",
      "uneasy",
    ],
    sad: [
      "sad",
      "depressed",
      "depression",
      "grieving",
      "grief",
      "heartbroken",
      "heart broken",
      "mourning",
      "sorrow",
      "sorrowful",
      "down",
      "cry",
      "crying",
    ],
    angry: [
      "angry",
      "anger",
      "mad",
      "bitter",
      "bitterness",
      "resentful",
      "resentment",
      "furious",
      "rage",
      "irritated",
    ],
    guilty: [
      "guilty",
      "guilt",
      "ashamed",
      "shame",
      "regret",
      "regretting",
      "condemned",
    ],
    hopeless: [
      "hopeless",
      "despair",
      "desperate",
      "give up",
      "giving up",
      "no hope",
      "pointless",
    ],
    weary: [
      "weary",
      "tired",
      "exhausted",
      "exhaustion",
      "fatigued",
      "worn out",
      "drained",
      "burned out",
      "burnt out",
      "burnout",
    ],
    confused: [
      "confused",
      "lost",
      "directionless",
      "uncertain",
      "unsure",
      "dont know",
      "don't know",
      "no direction",
    ],
    happy: [
      "happy",
      "grateful",
      "joyful",
      "joy",
      "thankful",
      "blessed",
      "rejoicing",
      "delighted",
    ],
    loved: ["loved", "unloved", "rejected", "rejection", "unwanted", "accepted"],
    unloved: ["unloved", "rejected", "rejection", "unwanted"],
    pain: [
      "pain",
      "hurt",
      "hurting",
      "suffering",
      "suffer",
      "sufferings",
      "ache",
      "aching",
      "agony",
      "in pain",
    ],
    sick: [
      "sick",
      "illness",
      "sickness",
      "disease",
      "diseases",
      "unwell",
    ],
    jealous: [
      "jealous",
      "jealousy",
      "envy",
      "envious",
    ],
    betrayal: [
      "betrayal",
      "betrayed",
      "betrayed me",
      "backstabbed",
    ],
    failure: [
      "failure",
      "failed",
      "failing",
      "fail",
      "defeat",
      "defeated",
    ],
  };

  /** Map detected intent → catalog feeling tag(s) */
  const INTENT_TO_FEELINGS = {
    stressed: ["anxious", "weary"],
    lonely: ["lonely"],
    anxious: ["anxious", "afraid"],
    sad: ["sad"],
    angry: ["angry", "bitter"],
    guilty: ["guilty"],
    hopeless: ["hopeless"],
    weary: ["weary"],
    confused: ["confused"],
    happy: ["happy", "grateful"],
    loved: ["loved"],
    unloved: ["lonely", "sad"],
    pain: ["sad", "weary"],
    sick: ["weary", "afraid"],
    jealous: ["bitter", "angry"],
    betrayal: ["sad", "lonely"],
    failure: ["hopeless", "guilty"],
  };

  /** Synonym expansion for matching (intent / feeling word → terms to OR-match) */
  const SYNONYM_EXPAND = {
    stressed: [
      "stressed",
      "stress",
      "overwhelmed",
      "overwhelm",
      "pressure",
      "anxious",
      "anxiety",
      "worried",
      "worry",
      "weary",
      "tired",
      "exhausted",
      "rest",
      "peace",
      "strength",
    ],
    stress: [
      "stressed",
      "stress",
      "overwhelmed",
      "anxious",
      "anxiety",
      "worry",
      "weary",
      "peace",
      "strength",
    ],
    overwhelmed: [
      "overwhelmed",
      "overwhelm",
      "stressed",
      "stress",
      "anxious",
      "weary",
      "exhausted",
    ],
    lonely: [
      "lonely",
      "alone",
      "abandoned",
      "presence",
      "comfort",
      "forsaken",
      "with you",
    ],
    alone: ["lonely", "alone", "abandoned", "presence", "comfort"],
    anxious: [
      "anxious",
      "anxiety",
      "worried",
      "worry",
      "fear",
      "afraid",
      "peace",
      "rest",
      "nervous",
      "stressed",
    ],
    worry: ["worry", "worried", "anxious", "anxiety", "fear", "peace"],
    worried: ["worried", "worry", "anxious", "anxiety", "fear", "peace"],
    fear: ["fear", "afraid", "scared", "anxious", "courage", "peace"],
    afraid: ["afraid", "fear", "scared", "anxious", "courage"],
    scared: ["scared", "afraid", "fear", "anxious"],
    sad: [
      "sad",
      "sorrow",
      "grief",
      "grieving",
      "comfort",
      "hope",
      "heartbroken",
      "mourning",
    ],
    depressed: ["sad", "depressed", "hopeless", "comfort", "hope", "grief"],
    grieving: ["grief", "grieving", "sad", "comfort", "mourning", "sorrow"],
    heartbroken: ["heartbroken", "sad", "grief", "comfort", "broken"],
    angry: ["angry", "anger", "mad", "bitter", "peace", "forgiveness"],
    mad: ["mad", "angry", "anger", "bitter"],
    bitter: ["bitter", "bitterness", "angry", "resentful", "forgiveness"],
    resentful: ["resentful", "bitter", "angry", "forgiveness"],
    guilty: ["guilty", "guilt", "ashamed", "shame", "forgiveness", "mercy"],
    ashamed: ["ashamed", "shame", "guilty", "forgiveness", "mercy"],
    hopeless: [
      "hopeless",
      "despair",
      "hope",
      "hopeful",
      "future",
      "encouraged",
    ],
    despair: ["despair", "hopeless", "hope", "hopeful"],
    weary: [
      "weary",
      "tired",
      "exhausted",
      "rest",
      "strength",
      "renew",
      "burned",
    ],
    tired: ["tired", "weary", "exhausted", "rest", "strength"],
    exhausted: ["exhausted", "weary", "tired", "rest", "strength"],
    burnout: [
      "burnout",
      "burned",
      "burnt",
      "weary",
      "tired",
      "exhausted",
      "rest",
      "strength",
      "stressed",
      "stress",
      "overwhelmed",
      "anxious",
    ],
    burned: [
      "burned",
      "burnt",
      "burnout",
      "weary",
      "tired",
      "exhausted",
      "rest",
      "strength",
      "stressed",
      "overwhelmed",
    ],
    burnt: [
      "burnt",
      "burned",
      "burnout",
      "weary",
      "tired",
      "exhausted",
      "rest",
      "strength",
      "stressed",
    ],
    hope: ["hope", "hopeful", "future", "encourage", "despair", "hopeless"],
    forgiveness: [
      "forgiveness",
      "forgive",
      "forgiven",
      "mercy",
      "guilt",
      "guilty",
      "shame",
      "cleanse",
    ],
    peace: ["peace", "peaceful", "rest", "calm", "anxiety", "anxious", "worry"],
    confused: [
      "confused",
      "lost",
      "guidance",
      "wisdom",
      "direction",
      "uncertain",
    ],
    lost: ["lost", "confused", "guidance", "found", "direction"],
    happy: ["happy", "joy", "joyful", "glad", "rejoice", "grateful"],
    grateful: ["grateful", "thankful", "thank", "blessing", "joy"],
    joyful: ["joyful", "joy", "happy", "rejoice", "glad"],
    loved: ["loved", "love", "accepted", "cherished", "belong"],
    unloved: ["unloved", "rejected", "love", "accepted", "lonely"],
    rejected: ["rejected", "rejection", "unloved", "love", "accepted"],

    pain: [
      "pain",
      "hurt",
      "hurting",
      "suffering",
      "suffer",
      "sufferings",
      "ache",
      "agony",
      "grief",
      "sorrow",
      "comfort",
      "brokenhearted",
      "wounds",
      "wounded",
      "crushed",
      "tears",
      "healing",
    ],
    hurt: [
      "hurt",
      "hurting",
      "pain",
      "suffering",
      "grief",
      "comfort",
      "brokenhearted",
      "wounds",
      "healing",
    ],
    hurting: ["hurting", "hurt", "pain", "suffering", "grief", "comfort"],
    suffering: [
      "suffering",
      "sufferings",
      "suffer",
      "pain",
      "hurt",
      "grief",
      "comfort",
      "sorrow",
      "hope",
    ],
    suffer: ["suffer", "suffering", "sufferings", "pain", "hurt", "grief", "comfort"],
    sick: [
      "sick",
      "illness",
      "sickness",
      "disease",
      "diseases",
      "healing",
      "heal",
      "heals",
      "health",
      "wounds",
    ],
    illness: ["illness", "sick", "sickness", "disease", "healing", "heal", "health"],
    sickness: ["sickness", "sick", "illness", "disease", "healing", "heal"],
    disease: ["disease", "diseases", "sick", "illness", "healing", "heal"],
    jealous: ["jealous", "jealousy", "envy", "envious", "bitter", "anger", "peace"],
    jealousy: ["jealousy", "jealous", "envy", "bitter", "peace"],
    envy: ["envy", "envious", "jealous", "jealousy", "bitter"],
    envious: ["envious", "envy", "jealous", "bitter"],
    betrayal: [
      "betrayal",
      "betrayed",
      "rejected",
      "rejection",
      "abandoned",
      "love",
      "faithfulness",
      "presence",
      "comfort",
    ],
    betrayed: ["betrayed", "betrayal", "rejected", "abandoned", "love", "comfort", "presence"],
    failure: [
      "failure",
      "failed",
      "fail",
      "failing",
      "defeat",
      "defeated",
      "hope",
      "strength",
      "future",
      "restore",
    ],
    failed: ["failed", "failure", "fail", "defeat", "hope", "strength"],
    fail: ["fail", "failure", "failed", "hope", "strength", "faithful"],
  };

  const FOLLOW_UPS = {
    stressed: {
      question: "What's weighing on you most?",
      options: [
        {
          id: "work",
          label: "Work or school pressure",
          themes: ["guidance", "strength", "peace", "provision"],
          feelings: ["anxious", "weary"],
          boostTerms: ["work", "labor", "strength", "rest", "peace", "wisdom"],
        },
        {
          id: "family",
          label: "Family or relationships",
          themes: ["presence", "comfort", "peace", "faithfulness"],
          feelings: ["anxious", "lonely"],
          boostTerms: ["family", "love", "peace", "presence", "comfort"],
        },
        {
          id: "money",
          label: "Money or provision",
          themes: ["provision", "faithfulness"],
          feelings: ["anxious", "afraid"],
          boostTerms: [
            "provision",
            "provide",
            "need",
            "supply",
            "care",
            "faithfulness",
          ],
        },
        {
          id: "health",
          label: "Health or the future",
          themes: ["hope", "healing", "protection", "peace"],
          feelings: ["anxious", "afraid", "hopeful"],
          boostTerms: [
            "healing",
            "health",
            "future",
            "hope",
            "protection",
            "peace",
          ],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["peace", "strength", "presence"],
          feelings: ["anxious", "weary"],
          boostTerms: ["peace", "rest", "strength", "comfort"],
          openText: true,
        },
      ],
    },
    lonely: {
      question: "What kind of loneliness are you carrying?",
      options: [
        {
          id: "friends",
          label: "Missing friends or community",
          themes: ["presence", "comfort", "love"],
          feelings: ["lonely"],
          boostTerms: ["presence", "with you", "friend", "love", "comfort"],
        },
        {
          id: "family",
          label: "Family distance",
          themes: ["presence", "faithfulness", "comfort"],
          feelings: ["lonely", "sad"],
          boostTerms: ["family", "presence", "faithfulness", "comfort"],
        },
        {
          id: "god",
          label: "Feeling far from God",
          themes: ["presence", "faithfulness", "love"],
          feelings: ["lonely", "hopeless"],
          boostTerms: ["near", "presence", "with you", "never leave", "love"],
        },
        {
          id: "rejected",
          label: "Feeling rejected or left out",
          themes: ["love", "identity", "comfort"],
          feelings: ["lonely", "sad"],
          boostTerms: ["accepted", "love", "chosen", "belong", "comfort"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["presence", "comfort"],
          feelings: ["lonely"],
          boostTerms: ["presence", "comfort", "alone"],
          openText: true,
        },
      ],
    },
    anxious: {
      question: "What's fueling the worry?",
      options: [
        {
          id: "future",
          label: "The future or unknowns",
          themes: ["hope", "peace", "protection", "guidance"],
          feelings: ["anxious", "afraid"],
          boostTerms: ["future", "hope", "peace", "fear not", "tomorrow"],
        },
        {
          id: "control",
          label: "Things I can't control",
          themes: ["peace", "trust", "faithfulness", "strength"],
          feelings: ["anxious"],
          boostTerms: ["peace", "rest", "trust", "still", "sovereign"],
        },
        {
          id: "people",
          label: "People or conflict",
          themes: ["peace", "presence", "protection"],
          feelings: ["anxious", "afraid"],
          boostTerms: ["peace", "protection", "enemies", "deliver"],
        },
        {
          id: "health",
          label: "Health or safety",
          themes: ["healing", "protection", "peace"],
          feelings: ["anxious", "afraid"],
          boostTerms: ["healing", "protection", "safe", "peace"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["peace", "hope"],
          feelings: ["anxious"],
          boostTerms: ["peace", "anxiety", "worry", "rest"],
          openText: true,
        },
      ],
    },
    sad: {
      question: "What's behind the sadness?",
      options: [
        {
          id: "loss",
          label: "Loss or grief",
          themes: ["comfort", "hope", "presence"],
          feelings: ["sad"],
          boostTerms: ["comfort", "mourn", "grief", "tears", "hope"],
        },
        {
          id: "heartbreak",
          label: "Heartbreak or disappointment",
          themes: ["comfort", "healing", "hope", "new-beginning"],
          feelings: ["sad", "hopeless"],
          boostTerms: ["heal", "broken", "comfort", "hope", "restore"],
        },
        {
          id: "loneliness",
          label: "Feeling alone in it",
          themes: ["presence", "comfort", "love"],
          feelings: ["sad", "lonely"],
          boostTerms: ["presence", "with you", "comfort", "near"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["comfort", "hope"],
          feelings: ["sad"],
          boostTerms: ["comfort", "hope", "joy"],
          openText: true,
        },
      ],
    },
    angry: {
      question: "Where is the anger pointed?",
      options: [
        {
          id: "injustice",
          label: "Injustice or unfairness",
          themes: ["justice", "hope", "peace"],
          feelings: ["angry", "bitter"],
          boostTerms: ["justice", "vindicate", "righteous", "peace"],
        },
        {
          id: "person",
          label: "Someone who hurt me",
          themes: ["forgiveness", "peace", "love"],
          feelings: ["angry", "bitter"],
          boostTerms: ["forgive", "forgiveness", "peace", "mercy"],
        },
        {
          id: "myself",
          label: "Myself",
          themes: ["forgiveness", "mercy", "new-beginning"],
          feelings: ["angry", "guilty"],
          boostTerms: ["mercy", "forgive", "new", "grace"],
        },
        {
          id: "god",
          label: "Questions toward God",
          themes: ["presence", "faithfulness", "hope"],
          feelings: ["angry", "confused"],
          boostTerms: ["faithfulness", "near", "understand", "hope"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["peace", "forgiveness"],
          feelings: ["angry"],
          boostTerms: ["peace", "slow to anger", "patience"],
          openText: true,
        },
      ],
    },
    guilty: {
      question: "What kind of guilt are you carrying?",
      options: [
        {
          id: "past",
          label: "Something from the past",
          themes: ["forgiveness", "mercy", "new-beginning"],
          feelings: ["guilty"],
          boostTerms: ["forgive", "cleanse", "blot", "mercy", "new"],
        },
        {
          id: "shame",
          label: "Shame about who I am",
          themes: ["identity", "love", "forgiveness"],
          feelings: ["guilty"],
          boostTerms: ["identity", "loved", "accepted", "clean", "mercy"],
        },
        {
          id: "ongoing",
          label: "An ongoing struggle",
          themes: ["forgiveness", "strength", "spirit"],
          feelings: ["guilty", "hopeless"],
          boostTerms: ["strength", "overcome", "mercy", "grace", "spirit"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["forgiveness", "mercy"],
          feelings: ["guilty"],
          boostTerms: ["forgiveness", "mercy", "grace"],
          openText: true,
        },
      ],
    },
    hopeless: {
      question: "Where does the hopelessness land?",
      options: [
        {
          id: "future",
          label: "The future feels dark",
          themes: ["hope", "future", "faithfulness"],
          feelings: ["hopeless", "afraid"],
          boostTerms: ["hope", "future", "plans", "good", "encourage"],
        },
        {
          id: "change",
          label: "Nothing seems to change",
          themes: ["restoration", "hope", "endurance", "faithfulness"],
          feelings: ["hopeless", "weary"],
          boostTerms: ["restore", "renew", "wait", "endurance", "faithful"],
        },
        {
          id: "purpose",
          label: "I can't see purpose",
          themes: ["calling", "identity", "hope", "guidance"],
          feelings: ["hopeless", "confused"],
          boostTerms: ["purpose", "calling", "plan", "hope", "identity"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["hope", "comfort"],
          feelings: ["hopeless"],
          boostTerms: ["hope", "light", "encourage"],
          openText: true,
        },
      ],
    },
    weary: {
      question: "What's wearing you out?",
      options: [
        {
          id: "work",
          label: "Work or responsibility",
          themes: ["rest", "strength", "provision"],
          feelings: ["weary"],
          boostTerms: ["rest", "yoke", "strength", "labor", "renew"],
        },
        {
          id: "caring",
          label: "Caring for others",
          themes: ["strength", "comfort", "presence"],
          feelings: ["weary", "lonely"],
          boostTerms: ["strength", "carry", "comfort", "help"],
        },
        {
          id: "waiting",
          label: "Waiting on an answer",
          themes: ["hope", "endurance", "faithfulness", "peace"],
          feelings: ["weary", "hopeful"],
          boostTerms: ["wait", "patience", "endurance", "renew", "hope"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["rest", "strength"],
          feelings: ["weary"],
          boostTerms: ["rest", "strength", "renew"],
          openText: true,
        },
      ],
    },
    confused: {
      question: "What are you unsure about?",
      options: [
        {
          id: "direction",
          label: "Next steps or direction",
          themes: ["guidance", "wisdom", "calling"],
          feelings: ["confused"],
          boostTerms: ["guide", "path", "wisdom", "lead", "direction"],
        },
        {
          id: "decision",
          label: "A hard decision",
          themes: ["wisdom", "guidance", "peace"],
          feelings: ["confused", "anxious"],
          boostTerms: ["wisdom", "discern", "peace", "counsel"],
        },
        {
          id: "faith",
          label: "My faith or beliefs",
          themes: ["truth", "faithfulness", "presence"],
          feelings: ["confused", "afraid"],
          boostTerms: ["truth", "faith", "believe", "trust", "word"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["guidance", "wisdom"],
          feelings: ["confused"],
          boostTerms: ["guidance", "wisdom", "light"],
          openText: true,
        },
      ],
    },
    happy: {
      question: "What would you like to lean into?",
      options: [
        {
          id: "gratitude",
          label: "Gratitude and praise",
          themes: ["joy", "blessing", "faithfulness"],
          feelings: ["grateful", "happy"],
          boostTerms: ["thank", "praise", "joy", "bless", "grateful"],
        },
        {
          id: "share",
          label: "Sharing joy with others",
          themes: ["joy", "love", "blessing"],
          feelings: ["happy", "loved"],
          boostTerms: ["joy", "love", "bless", "rejoice"],
        },
        {
          id: "remember",
          label: "Remembering God's faithfulness",
          themes: ["faithfulness", "reminder", "hope"],
          feelings: ["grateful", "hopeful"],
          boostTerms: ["faithful", "remember", "covenant", "good"],
        },
        {
          id: "other",
          label: "Just show me promises",
          themes: ["joy", "blessing"],
          feelings: ["happy", "grateful"],
          boostTerms: ["joy", "blessing", "glad"],
        },
      ],
    },
    loved: {
      question: "What would help most right now?",
      options: [
        {
          id: "belong",
          label: "Belonging and acceptance",
          themes: ["love", "identity", "presence"],
          feelings: ["loved"],
          boostTerms: ["love", "accepted", "chosen", "belong", "child"],
        },
        {
          id: "worth",
          label: "Knowing my worth",
          themes: ["identity", "love", "calling"],
          feelings: ["loved", "hopeful"],
          boostTerms: ["identity", "precious", "loved", "value", "image"],
        },
        {
          id: "rejected",
          label: "Healing from rejection",
          themes: ["love", "comfort", "healing", "identity"],
          feelings: ["lonely", "sad"],
          boostTerms: ["love", "comfort", "heal", "accepted", "never leave"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["love", "presence"],
          feelings: ["loved"],
          boostTerms: ["love", "presence"],
          openText: true,
        },
      ],
    },

    pain: {
      question: "What kind of pain are you carrying?",
      options: [
        {
          id: "physical",
          label: "Physical pain or illness",
          themes: ["healing", "comfort", "presence"],
          feelings: ["weary", "sad"],
          boostTerms: ["healing", "heal", "comfort", "strength", "pain"],
        },
        {
          id: "emotional",
          label: "Emotional or heart pain",
          themes: ["comfort", "hope", "healing"],
          feelings: ["sad", "hopeless"],
          boostTerms: ["comfort", "brokenhearted", "heal", "hope", "tears"],
        },
        {
          id: "loss",
          label: "Loss or suffering",
          themes: ["comfort", "hope", "presence"],
          feelings: ["sad", "weary"],
          boostTerms: ["comfort", "suffering", "hope", "glory", "presence"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["comfort", "hope"],
          feelings: ["sad"],
          boostTerms: ["comfort", "hope", "pain"],
          openText: true,
        },
      ],
    },
    sick: {
      question: "What would help most right now?",
      options: [
        {
          id: "healing",
          label: "Prayers for healing",
          themes: ["healing", "hope", "presence"],
          feelings: ["weary", "afraid"],
          boostTerms: ["healing", "heal", "health", "restore", "strength"],
        },
        {
          id: "peace",
          label: "Peace while I wait",
          themes: ["peace", "comfort", "presence"],
          feelings: ["anxious", "afraid"],
          boostTerms: ["peace", "comfort", "presence", "strength"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["healing", "comfort"],
          feelings: ["weary"],
          boostTerms: ["healing", "comfort", "hope"],
          openText: true,
        },
      ],
    },
    jealous: {
      question: "Where is the jealousy pointed?",
      options: [
        {
          id: "others",
          label: "Comparing myself to others",
          themes: ["contentment", "peace", "identity"],
          feelings: ["bitter", "angry"],
          boostTerms: ["peace", "content", "enough", "blessing", "identity"],
        },
        {
          id: "anger",
          label: "It is turning into anger",
          themes: ["peace", "forgiveness", "wisdom"],
          feelings: ["angry", "bitter"],
          boostTerms: ["peace", "anger", "patience", "wisdom"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["peace", "love"],
          feelings: ["bitter"],
          boostTerms: ["peace", "love", "content"],
          openText: true,
        },
      ],
    },
    betrayal: {
      question: "What would help most after betrayal?",
      options: [
        {
          id: "comfort",
          label: "Comfort and presence",
          themes: ["comfort", "presence", "love"],
          feelings: ["sad", "lonely"],
          boostTerms: ["comfort", "presence", "never leave", "love"],
        },
        {
          id: "trust",
          label: "Learning to trust again",
          themes: ["faithfulness", "love", "healing"],
          feelings: ["afraid", "lonely"],
          boostTerms: ["faithful", "trust", "love", "heal"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["comfort", "love"],
          feelings: ["sad"],
          boostTerms: ["comfort", "love", "presence"],
          openText: true,
        },
      ],
    },
    failure: {
      question: "Where does the sense of failure land?",
      options: [
        {
          id: "future",
          label: "Fear about the future",
          themes: ["hope", "future", "faithfulness"],
          feelings: ["hopeless", "afraid"],
          boostTerms: ["hope", "future", "plans", "good"],
        },
        {
          id: "strength",
          label: "I need strength to keep going",
          themes: ["strength", "hope", "endurance"],
          feelings: ["weary", "hopeless"],
          boostTerms: ["strength", "renew", "endure", "hope"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["hope", "restoration"],
          feelings: ["hopeless"],
          boostTerms: ["hope", "restore", "new"],
          openText: true,
        },
      ],
    },
    unloved: {
      question: "What would help most right now?",
      options: [
        {
          id: "belong",
          label: "Belonging and acceptance",
          themes: ["love", "identity", "presence"],
          feelings: ["lonely", "sad"],
          boostTerms: ["love", "accepted", "chosen", "belong"],
        },
        {
          id: "rejected",
          label: "Healing from rejection",
          themes: ["love", "comfort", "healing"],
          feelings: ["lonely", "sad"],
          boostTerms: ["love", "comfort", "heal", "accepted"],
        },
        {
          id: "other",
          label: "Something else",
          themes: ["love", "comfort"],
          feelings: ["lonely"],
          boostTerms: ["love", "comfort", "presence"],
          openText: true,
        },
      ],
    },
  };

  // Alias weary burnout overlap onto stressed follow-up when "stressed" keywords hit first
  FOLLOW_UPS.burned = FOLLOW_UPS.weary;

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['']/g, "'");
  }

  function tokenize(q) {
    return normalize(q)
      .split(/[^a-z0-9+-]+/)
      .filter(Boolean);
  }

  function stripStopwords(tokens) {
    return tokens.filter((t) => !STOPWORDS.has(t) && t.length > 1);
  }

  function looksLikeScriptureRef(q) {
    const n = normalize(q).trim();
    if (!n) return false;
    // e.g. John 3:16, 1 John 4:8, Ps 23, Genesis 1
    if (/\d+\s*:\s*\d+/.test(n)) return true;
    for (const book of BOOK_NAMES) {
      const escaped = book.replace(/\s+/g, "\\s+");
      const re = new RegExp(
        "(?:^|\\b)" + escaped + "\\s+\\d+",
        "i"
      );
      if (re.test(n)) return true;
    }
    return false;
  }

  function isOnlyBookName(q) {
    const n = normalize(q).trim().replace(/\s+/g, " ");
    return BOOK_NAMES.includes(n);
  }

  function detectStatementPattern(q) {
    const n = normalize(q);
    return (
      /\bi\s+am\b/.test(n) ||
      /\bi'?m\b/.test(n) ||
      /\bi\s+feel\b/.test(n) ||
      /\bfeeling\b/.test(n) ||
      /\bhelp\s+with\b/.test(n) ||
      /\bstruggling\s+with\b/.test(n) ||
      /\bfeeling\s+/.test(n)
    );
  }

  function findIntentMatches(q) {
    const n = " " + normalize(q).replace(/[^a-z0-9'\s+-]+/g, " ") + " ";
    const hits = [];
    for (const [intentId, keywords] of Object.entries(INTENT_KEYWORDS)) {
      for (const kw of keywords) {
        const needle = " " + kw + " ";
        if (n.includes(needle)) {
          hits.push({ intentId, keyword: kw, len: kw.length });
          break;
        }
      }
    }
    // Prefer longer / more specific matches; stressed before weary if both from burnout
    hits.sort((a, b) => b.len - a.len);
    return hits;
  }

  /**
   * Decide whether to show a clarifying follow-up for this query.
   * @returns {{ intentId: string, keyword: string, feelings: string[], followUp: object }|null}
   */
  function detectIntent(query, opts) {
    opts = opts || {};
    const q = String(query || "").trim();
    if (!q) return null;
    if (looksLikeScriptureRef(q)) return null;
    if (isOnlyBookName(q)) return null;

    const themes = opts.knownThemes || [];
    const n = normalize(q).trim();
    if (themes.includes(n) && !detectStatementPattern(q)) {
      // Exact theme word alone — skip guide
      return null;
    }

    const hits = findIntentMatches(q);
    if (!hits.length) return null;

    const primary = hits[0];
    // Single known feeling word: still OK to show light follow-up for rich feelings
    const richSingles = new Set([
      "stressed",
      "anxious",
      "lonely",
      "sad",
      "angry",
      "hopeless",
      "weary",
      "confused",
      "guilty",
      "afraid",
      "scared",
      "worried",
      "overwhelmed",
      "pain",
      "hurt",
      "suffering",
      "sick",
      "jealous",
      "betrayed",
      "failure",
    ]);
    const tokens = stripStopwords(tokenize(q));
    const isSingleFeeling =
      tokens.length === 1 &&
      (richSingles.has(tokens[0]) || INTENT_KEYWORDS[primary.intentId]);

    const isStatement = detectStatementPattern(q);
    if (!isStatement && !isSingleFeeling && tokens.length === 1) {
      // Plain theme-ish single word that isn't a rich feeling — no guide
      const knownFeelings = opts.knownFeelings || [];
      if (!knownFeelings.includes(tokens[0]) && !richSingles.has(tokens[0])) {
        return null;
      }
    }

    const followUp = FOLLOW_UPS[primary.intentId];
    if (!followUp) return null;

    return {
      intentId: primary.intentId,
      keyword: primary.keyword,
      feelings: INTENT_TO_FEELINGS[primary.intentId] || [],
      followUp: followUp,
      label: intentLabel(primary.intentId),
    };
  }

  function intentLabel(intentId) {
    const labels = {
      stressed: "stress",
      lonely: "loneliness",
      anxious: "anxiety",
      sad: "sadness",
      angry: "anger",
      guilty: "guilt",
      hopeless: "hopelessness",
      weary: "weariness",
      confused: "confusion",
      happy: "joy",
      loved: "being loved",
      unloved: "feeling unloved",
      pain: "pain",
      sick: "illness",
      jealous: "jealousy",
      betrayal: "betrayal",
      failure: "failure",
    };
    return labels[intentId] || intentId;
  }

  function expandSynonyms(word) {
    const n = normalize(word);
    const list = SYNONYM_EXPAND[n];
    if (list) return list.slice();
    return [n];
  }

  /**
   * Build a search plan from raw query + optional clarification.
   * @param {string} query
   * @param {object|null} clarification - { intentId, optionId, option, freeText, skipped }
   * @returns {object} plan used by app.js matching/ranking
   */
  function buildSearchPlan(query, clarification, opts) {
    const rawTokens = tokenize(query);
    const contentTokens = stripStopwords(rawTokens);

    let intent = detectIntent(query, opts);
    // Feeling hits even when the clarifying guide is suppressed (exact theme word, etc.)
    const silentHits = !intent ? findIntentMatches(query) : [];
    const rankingIntentId = intent
      ? intent.intentId
      : silentHits.length
        ? silentHits[0].intentId
        : null;
    const rankingKeyword = intent
      ? intent.keyword
      : silentHits.length
        ? silentHits[0].keyword
        : null;

    let orGroups = []; // each group: array of synonym terms — match if ANY hits
    let andTokens = []; // remaining content words (hard filter when no feeling OR groups)
    let softFeelings = [];
    let boostThemes = [];
    let boostFeelings = [];
    let boostTerms = [];
    let statusParts = [];

    // Expand feeling/theme-like content tokens into OR groups; other tokens stay AND
    const feelingish = new Set(Object.keys(SYNONYM_EXPAND));
    const intentKeywords = rankingIntentId
      ? INTENT_KEYWORDS[rankingIntentId] || []
      : [];
    for (const tok of contentTokens) {
      const intentTok = intentKeywords.some(
        (k) => k === tok || k.split(/\s+/)[0] === tok
      );
      if (feelingish.has(tok) || intentTok) {
        orGroups.push(expandSynonyms(tok));
      } else if (tok.length > 1) {
        andTokens.push(tok);
      }
    }

    // Ensure full feeling synonym OR coverage from intent / silent feeling hit
    // (e.g. "left out" may only expand the token "left" — merge lonely synonyms too)
    if (rankingIntentId) {
      const base = INTENT_TO_FEELINGS[rankingIntentId] || [];
      const expanded = expandSynonyms(rankingKeyword || rankingIntentId);
      for (const s of expandSynonyms(rankingIntentId)) {
        if (!expanded.includes(s)) expanded.push(s);
      }
      for (const f of base) {
        for (const s of expandSynonyms(f)) {
          if (!expanded.includes(s)) expanded.push(s);
        }
      }
      if (orGroups.length === 0) {
        orGroups.push(expanded);
      } else {
        const g = orGroups[0];
        for (const s of expanded) {
          if (!g.includes(s)) g.push(s);
        }
      }
    }

    if (intent) {
      softFeelings = (INTENT_TO_FEELINGS[intent.intentId] || []).slice();
      statusParts.push(intent.label);
    } else if (rankingIntentId) {
      softFeelings = (INTENT_TO_FEELINGS[rankingIntentId] || []).slice();
    }

    if (clarification && clarification.option) {
      const opt = clarification.option;
      softFeelings = (opt.feelings || softFeelings).slice();
      boostThemes = (opt.themes || []).slice();
      boostFeelings = (opt.feelings || []).slice();
      boostTerms = (opt.boostTerms || []).slice();
      statusParts.push(opt.label.toLowerCase());

      // Clarification boost terms help ranking; do not hard-filter
      if (boostTerms.length) {
        // keep as boostTerms only (already set) — avoid AND/OR filter tighten
      }

      if (clarification.freeText) {
        const extra = stripStopwords(tokenize(clarification.freeText));
        for (const t of extra) {
          if (feelingish.has(t)) orGroups.push(expandSynonyms(t));
          else boostTerms.push(t); // free-text context is soft
        }
        if (clarification.freeText.trim()) {
          statusParts.push('"' + clarification.freeText.trim().slice(0, 40) + '"');
        }
      }
    } else if (clarification && clarification.skipped && intent) {
      statusParts.push("all angles");
    }

    // Deduplicate andTokens that already appear in orGroups
    const orFlat = new Set(orGroups.flat().map(normalize));
    andTokens = andTokens.filter((t) => !orFlat.has(normalize(t)));

    // When a feeling/synonym OR group is active, demote leftover content words
    // (e.g. "work" in "stress at work") to soft boosts — hard AND was dropping
    // popular topical verses that never mention the context word.
    if (orGroups.length > 0 && andTokens.length > 0) {
      boostTerms = boostTerms.concat(andTokens);
      andTokens = [];
    }

    // Dedupe boostTerms
    const seenBoost = new Set();
    boostTerms = boostTerms.filter((t) => {
      const n = normalize(t);
      if (!n || seenBoost.has(n)) return false;
      seenBoost.add(n);
      return true;
    });

    return {
      intent: intent,
      rankingIntentId: rankingIntentId,
      orGroups: orGroups,
      andTokens: andTokens,
      softFeelings: softFeelings,
      boostThemes: boostThemes,
      boostFeelings: boostFeelings,
      boostTerms: boostTerms,
      statusLabel: statusParts.length
        ? "Showing promises for " + statusParts.join(" · ")
        : "",
      contentTokens: contentTokens,
    };
  }

  /**
   * Score a promise against a search plan (higher = better rank).
   */
  function scorePromise(p, plan) {
    if (!plan) return 0;
    let score = 0;
    const feelings = p.feelings || [];
    const themes = p.themes || [];
    const terms = (p.searchTerms || []).map(normalize);
    const hay = normalize(
      [
        p.reference,
        p.book,
        p.promise,
        p.text,
        ...(themes || []),
        ...(feelings || []),
        ...(p.searchTerms || []),
      ].join(" ")
    );

    for (const f of plan.boostFeelings || []) {
      if (feelings.includes(f)) score += 12;
    }
    for (const f of plan.softFeelings || []) {
      if (feelings.includes(f)) score += 6;
    }
    for (const t of plan.boostThemes || []) {
      if (themes.includes(t)) score += 10;
    }
    for (const term of plan.boostTerms || []) {
      const nt = normalize(term);
      if (terms.some((x) => x.includes(nt)) || hay.includes(nt)) score += 3;
    }
    // Prefer entries that hit primary feeling synonyms in searchTerms
    for (const group of plan.orGroups || []) {
      for (const syn of group) {
        if (feelings.includes(syn) || terms.includes(syn) || hay.includes(syn)) {
          score += 2;
          break;
        }
      }
    }
    return score;
  }

  /**
   * Does this indexed item match the plan?
   * OR within each synonym group; AND across remaining content tokens.
   * If plan has orGroups and no andTokens, matching any orGroup is enough
   * (when smart intent is active). Without orGroups, fall back to andTokens only.
   */
  function matchesPlan(hay, plan) {
    if (!plan) return true;
    for (const tok of plan.andTokens || []) {
      if (!hay.includes(tok)) return false;
    }
    const groups = plan.orGroups || [];
    if (groups.length === 0) return true;
    // Require at least one group to match (feeling synonym OR).
    // If multiple groups (base feeling + clarification boost), prefer any-of:
    // match if ANY group hits — clarification boosts ranking, not hard-filter.
    for (const group of groups) {
      if (group.some((syn) => hay.includes(normalize(syn)))) return true;
    }
    return false;
  }

  /**
   * Render the guide panel HTML (caller inserts into #smart-guide).
   */
  function renderGuideHtml(detection, escapeHtml) {
    const esc = escapeHtml || ((s) => String(s));
    const fu = detection.followUp;
    const chips = fu.options
      .map(
        (o) =>
          `<button type="button" class="smart-chip" data-option-id="${esc(o.id)}">${esc(o.label)}</button>`
      )
      .join("");

    return `
      <div class="smart-guide-inner">
        <button type="button" class="smart-guide-dismiss" id="smart-guide-dismiss" aria-label="Dismiss guide">×</button>
        <p class="smart-guide-question">${esc(fu.question)}</p>
        <div class="smart-chips" role="group" aria-label="Clarifying options">${chips}</div>
        <div class="smart-freetext-row">
          <label class="sr-only" for="smart-freetext">Or tell me in a few words</label>
          <input type="text" id="smart-freetext" class="smart-freetext" placeholder="Or tell me in a few words…" maxlength="120" autocomplete="off" />
          <button type="button" class="smart-apply" id="smart-apply">Apply</button>
        </div>
        <p class="smart-guide-actions">
          <button type="button" class="smart-skip" id="smart-skip">Just show me promises</button>
        </p>
      </div>`;
  }

  function renderStatusHtml(plan, escapeHtml) {
    const esc = escapeHtml || ((s) => String(s));
    if (!plan || !plan.statusLabel) return "";
    return `
      <div class="smart-status">
        <span class="smart-status-text">${esc(plan.statusLabel)}</span>
        <button type="button" class="smart-clear-guide" id="smart-clear-guide">Clear guide</button>
      </div>`;
  }

  function getOption(intentId, optionId) {
    const fu = FOLLOW_UPS[intentId];
    if (!fu) return null;
    return fu.options.find((o) => o.id === optionId) || null;
  }

  global.GodsPromisesSmartSearch = {
    detectIntent: detectIntent,
    buildSearchPlan: buildSearchPlan,
    scorePromise: scorePromise,
    matchesPlan: matchesPlan,
    renderGuideHtml: renderGuideHtml,
    renderStatusHtml: renderStatusHtml,
    getOption: getOption,
    stripStopwords: stripStopwords,
    tokenize: tokenize,
    expandSynonyms: expandSynonyms,
    looksLikeScriptureRef: looksLikeScriptureRef,
    STOPWORDS: STOPWORDS,
    INTENT_TO_FEELINGS: INTENT_TO_FEELINGS,
  };
})(typeof window !== "undefined" ? window : globalThis);
