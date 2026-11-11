/**
 * Feeling and theme studies. Each one reuses passages and why-lines already
 * curated in js/discovery-data.js. The introductions are written for the
 * filter label. They do not change a passage's classification or note.
 */
(function (global) {
  "use strict";

  function one(heading, intro, concept, intention) {
    return {
      heading: heading,
      intro: intro,
      concept: concept,
      intention: intention,
      parts: [{ concept: concept, intention: intention, group: "direct" }],
    };
  }

  function pick(heading, intro, concept, intention, parts) {
    return { heading: heading, intro: intro, concept: concept, intention: intention, parts: parts };
  }

  function part(concept, intention, group, book, chapter) {
    const row = { concept: concept, intention: intention, group: group || "direct" };
    if (book) row.book = book;
    if (chapter) row.chapter = chapter;
    return row;
  }

  const FEELINGS = {
    weary: one(
      "Rest for the weary",
      "Scripture meets exhaustion by inviting the weary to Jesus and by promising renewed strength to people who wait on the Lord. That rest is rest for the soul, and that strength is strength to keep going. Neither says the work will vanish, and neither is a prayer meant only for an anxious mind.",
      "composure",
      "rest"
    ),
    anxious: one(
      "Peace instead of anxiety",
      "Scripture addresses anxiety by telling the anxious person to bring the worry to God in prayer. The promise is his peace and his care. It does not guarantee that the feared thing will not happen, and it does not shame the fear.",
      "fear",
      "anxiety"
    ),
    afraid: one(
      "God with you in fear",
      "When Scripture says “do not fear,” it usually ties that word to God’s presence, not to a forecast that the danger will miss you. Some of these sentences were spoken to Israel for a particular task. The church receives God’s presence in Christ. They are not a promise of safety from every threat, or of prosperity.",
      "fear",
      "anxiety"
    ),
    angry: one(
      "Patience and self-control",
      "A hot temper is treated as something to slow down and put away. These passages instruct: be slow to anger, cease from wrath, and answer gently. They do not say the other person will change, and they do not call the feeling of anger itself the whole of the sin.",
      "composure",
      "anger"
    ),
    lonely: one(
      "God’s presence when you feel alone",
      "Loneliness is met here by promises that God does not forsake his people. Some were first spoken to Israel. The comfort is his presence, not a scheduled arrival of human friendship.",
      "loneliness",
      "alone"
    ),
    sad: one(
      "Comfort in sorrow",
      "These passages sit with sorrow. God is near the brokenhearted, and one text looks ahead to a day when mourning ends. They do not tell you to stop grieving. The end of mourning is a promise about the new creation, not a claim that the sadness lifts today.",
      "grief",
      "grief"
    ),
    guilty: pick(
      "Confession and mercy",
      "Guilt is brought to God by confession, not by repairing your record first. John promises that God is faithful to forgive those who confess. A psalm of praise remembers forgiveness among God’s gifts. Neither is a promise of wealth, and neither says that every consequence disappears.",
      "addiction",
      "addiction",
      [
        part("addiction", "addiction", "direct", "1 John", 1),
        part("gratitude", "thanks", "related", "Psalms", 103),
      ]
    ),
    hopeless: pick(
      "Hope when you cannot see it",
      "Hopelessness is not answered with a promise that tomorrow will feel better. These passages promise God’s nearness and that he works for good according to his purpose, and one looks to a day when death and mourning are gone. They do not call the pain itself good. The end of mourning belongs to the new creation.",
      "hardship",
      "hard",
      [
        part("hardship", "hard", "direct"),
        part("grief", "grief", "related", "Revelation", 21),
      ]
    ),
    happy: one(
      "Joy in the Lord",
      "Joy in these passages is joy in the Lord and thanks for what he has done. Paul tells people to rejoice while he writes from prison. It is not a demand to feel cheerful about pain, or to call a hard thing good.",
      "gratitude",
      "thanks"
    ),
    grateful: one(
      "Thanksgiving",
      "These passages call for thanks in every circumstance and for remembering concrete kindness: forgiveness, healing, and steadfast love. Thanks is God’s will in Christ. It is not reserved for the days that already feel easy.",
      "gratitude",
      "thanks"
    ),
    peaceful: one(
      "Peace of mind",
      "Peace here is the peace Jesus gives, and the mind God keeps in peace when it trusts him. It is peace in the midst of trouble. It is not a promise that the trouble disappears, and it is not a remedy for physical exhaustion.",
      "composure",
      "peace"
    ),
    hopeful: pick(
      "Hope that rests in God",
      "Hope in these passages is confidence in God’s purpose and in what he has promised, including a future when mourning ends. It is not optimism that every plan will succeed. Words first spoken to exiles are not a promise about every Christian’s personal plans.",
      "hardship",
      "hard",
      [
        part("hardship", "hard", "direct"),
        part("faith", "faith", "related"),
        part("grief", "grief", "related", "Revelation", 21),
      ]
    ),
    loved: one(
      "Held by God’s presence",
      "To be loved, in these passages, is to be held by God’s presence: he does not forsake his people. That is his commitment. It is not a promise that you will always feel wanted by other people.",
      "loneliness",
      "alone"
    ),
    confused: one(
      "Wisdom when the way is unclear",
      "Confusion about what to do is met by a call to trust the Lord rather than your own understanding, and by a promise that God gives wisdom to those who ask. The passages promise guidance. They do not hand you the decision already made.",
      "guidance",
      "decision"
    ),
    bitter: one(
      "Putting bitterness down",
      "Bitterness is named with anger as something to put away, and to replace with kindness and forgiveness patterned on God in Christ. These are instructions. They do not say the hurt did not matter, or that trust returns in the same moment.",
      "composure",
      "anger"
    ),
    jealous: one(
      "Envy and the heart",
      "Jealousy of what others have is addressed here as coveting and as the love of money. These passages warn and redirect the heart. They do not promise that you will receive what you envy, and they do not treat wealth as the measure of God’s favor.",
      "wealth",
      "ethics"
    ),
  };

  const THEMES = {
    acceptance: one(
      "Accepted by grace",
      "Acceptance in this passage is God’s grace, not an achievement and not a vote from other people. Ephesians says you are saved by grace and are his workmanship, created in Christ for good works he prepared. It does not say that every person already belongs to Christ, and it does not rank careers.",
      "purpose",
      "purpose"
    ),
    assurance: one(
      "Assurance in God’s faithfulness",
      "Assurance here rests on God’s character. The promise is that he remains faithful even when we are faithless. That is not permission to stay away, and it is not a feeling you must produce before he is faithful.",
      "faith",
      "faith"
    ),
    authority: one(
      "Jesus’ authority and his presence",
      "The authority in view is Jesus’ authority, given with the commission to his disciples and with his promise to be with them. It is not a grant of personal power over other people.",
      "loneliness",
      "alone"
    ),
    blessing: one(
      "Blessing, held in its setting",
      "Blessing in these passages includes God as the giver of ability, gifts of enjoyment, provision for needs, and clear warnings about greed. Deuteronomy’s bounty belongs to Israel’s covenant in the land. None of this is a promise that faithful Christians will become wealthy.",
      "wealth",
      "desire"
    ),
    calling: one(
      "Called to God’s work",
      "Calling here is God’s workmanship and the good works he prepared, not a ranking of jobs. Words about plans that were first spoken to exiles stay in their own setting. They are not a promise that every personal ambition is God’s plan.",
      "purpose",
      "purpose"
    ),
    cleansing: pick(
      "Cleansing by confession",
      "Cleansing here is God’s forgiveness when sin is confessed. John says God is faithful and just to forgive and to cleanse. It is not a ritual you perform to earn a clean record, and it does not say that every earthly consequence ends.",
      "addiction",
      "addiction",
      [part("addiction", "addiction", "direct", "1 John", 1)]
    ),
    comfort: one(
      "Comfort in grief",
      "Comfort here is God’s nearness to the brokenhearted, and the comfort he gives inside affliction so that it can be shared. One passage looks ahead to a day when he will wipe away tears. They do not tell you to stop grieving, and that future day is not a claim that grief ends this afternoon.",
      "grief",
      "grief"
    ),
    compassion: one(
      "Compassion as a way of life",
      "Compassion, patience, and forgiveness are commanded as the way Christ’s people treat one another, patterned on the mercy they have received. They are instructions. They do not promise that tender feelings will arrive first, or that trust is restored instantly.",
      "forgiveness",
      "forgive"
    ),
    courage: one(
      "Courage and God’s presence",
      "Courage is tied to God’s presence, not to a guarantee of success. Joshua was commissioned to lead Israel into the land and told to be strong because the Lord was with him. Those words belong to that task. What still carries is God’s presence, not a general promise that every decision will succeed.",
      "fear",
      "future"
    ),
    covenant: pick(
      "Covenant words, in their setting",
      "A covenant is God’s sworn commitment to particular people. The blessings of rain and lending were spoken to Israel in the land. Jeremiah’s future was spoken to Judah in Babylon after seventy years. Other lines promise that God will not forsake his people. A promise made to Israel is not automatically a promise to every Christian. The note under each verse names the audience.",
      "wealth",
      "work",
      [
        part("wealth", "work", "direct", "Deuteronomy", 28),
        part("purpose", "purpose", "related", "Jeremiah", 29),
        part("loneliness", "alone", "direct", "Hebrews", 13),
        part("fear", "anxiety", "related", "Isaiah", 41),
      ]
    ),
    deliverance: one(
      "Deliverance from sin’s mastery",
      "Deliverance here is God breaking sin’s dominion and giving a way through temptation. Freedom is the Son’s work. It is not a promise that every hardship ends at once, and it is not an easy overnight change.",
      "addiction",
      "addiction"
    ),
    endurance: pick(
      "Strength to keep going",
      "Endurance is strength to continue, and help that does not deny the hard season. Where a harvest is promised, it is in its season, if we do not give up. These passages do not say you will feel rested, or that the season will be short.",
      "composure",
      "strength",
      [part("composure", "strength", "direct"), part("hardship", "hard", "related")]
    ),
    "eternal-life": pick(
      "Life that outlasts death",
      "The passage that looks ahead promises a new creation in which death and mourning are no more. That hope is future. It is not a claim that death has no grief today. Salvation by grace, beside it, is God’s gift, not a wage, and it is not a promise of a long easy life on earth.",
      "grief",
      "grief",
      [
        part("grief", "grief", "direct", "Revelation", 21),
        part("purpose", "purpose", "related", "Ephesians", 2),
      ]
    ),
    faithfulness: one(
      "God’s faithfulness",
      "Faithfulness here is first God’s. He remains faithful even when we are faithless, because he cannot deny himself. A thin faith can be brought to him. These passages do not demand a feeling of certainty first, and they are not permission to walk away.",
      "faith",
      "faith"
    ),
    family: one(
      "Parents and children",
      "Family in these passages is parents and children. Children are called a heritage from the Lord, and parents are told not to provoke them. Training a child is formation over time. It is not a guarantee of how the child will turn out.",
      "parenting",
      "parenting"
    ),
    fear: one(
      "Peace instead of fear",
      "Fear is met by God’s presence and by the invitation to bring it to him in prayer. The promise is his peace and his care. It does not guarantee that the feared event will not happen, and words spoken to Israel are not a promise of prosperity.",
      "fear",
      "anxiety"
    ),
    forgiveness: one(
      "Forgiveness and reconciliation",
      "These passages command forgiveness and tie it to the mercy God has shown in Christ. They are about releasing a debt. They do not say that trust is restored in the same moment, or that the harm did not matter.",
      "forgiveness",
      "forgive"
    ),
    freedom: one(
      "Freedom from what enslaves",
      "Freedom here is the Son setting people free from sin’s mastery, including people who have failed again and confess it. The promise is a broken dominion. It is not a technique, and it is not an easy overnight change.",
      "addiction",
      "addiction"
    ),
    friendship: one(
      "Presence, not a timetable for friends",
      "These passages answer aloneness with God’s presence. They promise that he does not forsake his people. They do not promise that a human friend will arrive on a schedule.",
      "loneliness",
      "alone"
    ),
    future: one(
      "Trust for what you cannot see",
      "The future is met by God’s presence and by Jesus’ words about tomorrow. The promise is care and peace, one day at a time. It is not a preview of how everything will turn out, and Joshua’s commission is not a general promise of success.",
      "fear",
      "future"
    ),
    glory: pick(
      "Glory set beside present weakness",
      "Glory in this passage is future. Paul calls present affliction light only by comparison with eternal glory, and he says the inner person is renewed day by day. He does not claim that the suffering feels light today.",
      "composure",
      "strength",
      [part("composure", "strength", "direct", "2 Corinthians", 4)]
    ),
    grace: pick(
      "Saved by grace",
      "Grace here is how God saves: not by works, so that no one may boast. The same passage says you are his workmanship, created in Christ for good works he prepared. That is not a wage, and it is not a ranking of careers.",
      "purpose",
      "purpose",
      [part("purpose", "purpose", "direct", "Ephesians", 2)]
    ),
    gratitude: one(
      "Thanksgiving",
      "Gratitude in these passages is thanks in every circumstance and a deliberate remembering of what God has done. Joy is in the Lord. It is not a demand to call painful things good.",
      "gratitude",
      "thanks"
    ),
    guidance: one(
      "Wisdom and decision-making",
      "These passages tell you to trust the Lord rather than your own understanding, and to ask him for wisdom. They promise guidance and instruction. They do not hand you the decision already made.",
      "guidance",
      "decision"
    ),
    healing: one(
      "Prayer and care in illness",
      "James tells the sick to call the elders and pray, and he says the prayer of faith will save the sick and the Lord will raise him up. That stated result belongs with confession and the church’s prayer. It is not a guarantee that every disease ends. Praise of God as healer, and John’s prayer for a friend’s health, are not a doctrine that God always grants physical health. Isaiah 53 centers on the servant bearing sin, which is easy to misread as a guarantee of healing.",
      "health",
      "sick"
    ),
    holiness: pick(
      "Set apart in Christ",
      "Holiness in this passage is Christ’s aim for the church: he loved her and gave himself so that she would be holy. The words are also an instruction to husbands. They describe his sanctifying love. They do not say that believers are already finished, and they are not a self-improvement technique.",
      "marriage",
      "marriage",
      [part("marriage", "marriage", "direct", "Ephesians", 5)]
    ),
    hope: pick(
      "Hope that rests in God",
      "Hope here is God’s nearness in a hard season, his purpose for those who love him, and a future day when mourning ends. It is not a promise that every plan will succeed, or that the hard season will be short. The end of mourning is promised for the new creation, not for this afternoon.",
      "hardship",
      "hard",
      [
        part("hardship", "hard", "direct"),
        part("faith", "faith", "related"),
        part("grief", "grief", "related", "Revelation", 21),
      ]
    ),
    humility: pick(
      "Humility under God’s hand",
      "Humility here is bowing under God’s mighty hand and casting anxiety on him because he cares for you. The comfort is his care. It is not self-hatred, and it is not a promise of a later promotion.",
      "fear",
      "anxiety",
      [part("fear", "anxiety", "direct", "1 Peter", 5)]
    ),
    identity: one(
      "Who God says his people are",
      "Identity in this passage is God’s description, not a label you invent: saved by grace, his workmanship, created in Christ for good works he prepared. It is not a promise that every personal ambition is his plan.",
      "purpose",
      "purpose"
    ),
    inheritance: pick(
      "A heritage from the Lord",
      "The inheritance named in this psalm is children, called a heritage from the Lord. That is a gift. It is not the land promise to Abraham, and it is not a guarantee about any particular family.",
      "parenting",
      "parenting",
      [part("parenting", "parenting", "direct", "Psalms", 127)]
    ),
    invitation: pick(
      "Jesus’ invitation to the weary",
      "The invitation is Jesus’ word to people who labor and are burdened: come to him, and he will give rest for the soul. His yoke is easy and his burden light. He does not say the work disappears before you come.",
      "composure",
      "rest",
      [part("composure", "rest", "direct", "Matthew", 11)]
    ),
    joy: one(
      "Joy in the Lord",
      "Joy here is rejoicing in the Lord, including a command written from prison, and thanks for what God has done. It is not a demand to feel happy about pain.",
      "gratitude",
      "thanks"
    ),
    justice: pick(
      "God’s purpose is not our verdict",
      "This app’s curated notes do not contain a separate study of civil justice. The nearest promise is that God works things for good according to his purpose for those who love him. That does not call the hardship itself good, and it is not a timetable for every wrong to be repaid.",
      "hardship",
      "hard",
      [part("hardship", "hard", "related", "Romans", 8)]
    ),
    kingdom: pick(
      "The kingdom, not stored-up wealth",
      "Where these passages speak of what lasts, Jesus sets the kingdom and the Father’s care against anxiety about tomorrow and against treasure that decays. He redirects the heart. He does not promise earthly wealth.",
      "wealth",
      "ethics",
      [
        part("wealth", "ethics", "direct", "Matthew", 6),
        part("fear", "future", "related", "Matthew", 6),
      ]
    ),
    knowledge: one(
      "Wisdom God gives",
      "Knowledge here is wisdom God gives generously to those who ask, not a file you must complete before you may pray. The passages promise guidance. They do not hand you every decision already made.",
      "guidance",
      "decision"
    ),
    land: pick(
      "The land promised to Israel",
      "These words concern the land sworn to Israel. Deuteronomy’s rain, harvest, and lending were covenant blessings in that land if Israel obeyed. Joshua was told to be strong for the task of leading the people in. They are not a promise that Christians will receive territory, and they are not a promise of wealth.",
      "wealth",
      "work",
      [
        part("wealth", "work", "direct", "Deuteronomy", 28),
        part("fear", "future", "related", "Joshua", 1),
      ]
    ),
    life: pick(
      "Life God gives",
      "Life in these passages is life God gives: saved by grace, and set free by the Son from sin’s slavery. It is his gift and his work. It is not a promise of a long or easy earthly life.",
      "purpose",
      "purpose",
      [
        part("purpose", "purpose", "direct", "Ephesians", 2),
        part("addiction", "addiction", "related", "John", 8),
      ]
    ),
    light: pick(
      "Light in a fragile vessel",
      "Light here is the treasure of the gospel carried in weakness. Paul describes people afflicted but not crushed, perplexed but not driven to despair. The passage promises endurance in weakness. It does not promise that the darkness will lift on a schedule.",
      "hardship",
      "hard",
      [part("hardship", "hard", "direct", "2 Corinthians", 4)]
    ),
    love: pick(
      "The character of love",
      "Love in the main passage is patient and kind, not irritable or resentful, and it bears and endures. Paul is describing love’s character. It is not only a wedding text. The instructions to husbands, kept with the related passages, tell them to love as Christ loved the church. They are commands, not a promise that feelings will always be easy.",
      "marriage",
      "marriage",
      [
        part("marriage", "marriage", "direct", "1 Corinthians", 13),
        part("marriage", "conflict", "related", "Colossians", 3),
        part("marriage", "marriage", "related", "Ephesians", 5),
      ]
    ),
    mercy: one(
      "Mercy received and given",
      "Mercy here is the forgiveness God has shown, which these passages then command people to extend. Forgiveness is releasing a debt. It does not say that trust must be restored in the same moment.",
      "forgiveness",
      "forgive"
    ),
    nations: pick(
      "Nations in Israel’s covenant blessing",
      "The line about lending to nations is a covenant blessing spoken to Israel in the land if they obeyed. The note under the verse says it is not a general promise that every believer will become a lender to the nations. It is kept here so that setting is visible.",
      "wealth",
      "work",
      [part("wealth", "work", "direct", "Deuteronomy", 28)]
    ),
    "new-beginning": pick(
      "A beginning God gives",
      "A new beginning, in this passage, is God’s work: you are his workmanship, created in Christ for good works he prepared. It is not a blank page you manufacture, and it does not say the past has no consequences.",
      "purpose",
      "purpose",
      [part("purpose", "purpose", "direct", "Ephesians", 2)]
    ),
    obedience: one(
      "Trust that walks in his way",
      "Obedience here is trusting the Lord with all your heart instead of leaning on your own understanding. The promise is that he will make paths straight, and that he gives wisdom to those who ask. It is not a map of the next step, and it is not a claim that obedience earns salvation.",
      "guidance",
      "decision"
    ),
    offspring: pick(
      "Children as a heritage",
      "The patriarchal promise of offspring and land is not one of the passages already given a full contextual note in this study set. What is here calls children a heritage from the Lord and tells parents not to provoke them. That is a gift and an instruction. It is not the covenant with Abraham, and it is not a guarantee about any particular child.",
      "parenting",
      "parenting",
      [part("parenting", "parenting", "related")]
    ),
    patience: one(
      "Patience while you wait",
      "Patience here is being still before the Lord, ceasing from fretting, and not growing weary of doing good. Where a harvest is promised, it is in its season. These are not verses about falling asleep, and they are not a promise of quick relief.",
      "composure",
      "patience"
    ),
    peace: one(
      "Peace of mind",
      "Peace here is the peace Jesus leaves with his disciples, not peace as the world gives, and the mind God keeps in peace when it trusts him. It is peace in the midst of trouble. It does not promise that the trouble itself disappears.",
      "composure",
      "peace"
    ),
    prayer: pick(
      "Prayer that brings the need to God",
      "Prayer in these passages is how an anxious person brings requests to God, and how the sick ask the church to pray. Philippians promises that God’s peace will guard heart and mind, not that the problem will be removed. James states a result for the prayer of faith. That is not a guarantee that every illness ends, and it is not a promise of wealth.",
      "fear",
      "anxiety",
      [
        part("fear", "anxiety", "direct", "Philippians", 4),
        part("health", "sick", "direct", "James", 5),
        part("fear", "anxiety", "related", "1 Peter", 5),
      ]
    ),
    presence: one(
      "God’s presence with his people",
      "Presence here is the promise that God does not leave or forsake his people, including Jesus’ promise to be with his disciples to the end of the age. Some sentences were first spoken to Israel. The comfort is his presence, not a promise of constant human company or of prosperity.",
      "loneliness",
      "alone"
    ),
    promise: pick(
      "What these promises actually say",
      "The catalog uses “promise” for many different commitments of God. The passages below are not every promise in Scripture. They are three kinds already set in context: God’s faithfulness when ours wavers, guidance for those who ask, and his presence with his people. Each note says what was promised. They do not promise wealth, or that every personal plan will succeed.",
      "faith",
      "faith",
      [
        part("faith", "faith", "direct"),
        part("guidance", "decision", "direct"),
        part("loneliness", "alone", "related"),
      ]
    ),
    protection: one(
      "Protection as presence in the valley",
      "Protection here is God’s presence with his people, including the shepherd who walks through the valley. The psalm expects a dark valley. Isaiah’s “do not fear” was spoken to Israel. Neither passage promises that no harm will come, or that God will make the hearer prosperous.",
      "fear",
      "anxiety"
    ),
    providence: one(
      "God’s care for what you need",
      "Providence here is God caring for needs: contentment in plenty and in hunger, and Jesus’ words about tomorrow. The promise is care, not riches. Covenant blessings of bounty, where they appear, were spoken to Israel in the land.",
      "wealth",
      "worry"
    ),
    provision: one(
      "Provision when resources are thin",
      "Provision is God’s care for needs, including when money is tight and when tomorrow is uncertain. These passages promise that care and they teach contentment. They do not promise that the need will be solved by becoming wealthy.",
      "wealth",
      "worry"
    ),
    reconciliation: one(
      "Reconciliation begins with forgiveness",
      "Reconciliation in these passages starts with forgiving as God in Christ forgave, and with bearing with one another. They are instructions about releasing a debt. They do not say that trust is restored in the same moment, or that the harm did not matter.",
      "forgiveness",
      "forgive"
    ),
    refuge: pick(
      "God as refuge",
      "Refuge here is God himself: the one who hides, instructs, and leads, and the shepherd who stays through the valley. The comfort is his presence and counsel. It is not a promise that trouble will fail to find you.",
      "guidance",
      "decision",
      [
        part("guidance", "decision", "direct", "Psalms", 32),
        part("fear", "anxiety", "related", "Psalms", 23),
      ]
    ),
    reminder: one(
      "Remembering what God has done",
      "Remembering, in these passages, is calling to mind forgiveness, healing, and steadfast love, and giving thanks. It is worship. It is not a technique for forcing a happy mood, and it does not deny present pain.",
      "gratitude",
      "thanks"
    ),
    remnant: pick(
      "A word first spoken to Israel",
      "The nearest contextual note addresses Israel, whom God calls his servant: do not fear, for I am with you. The church receives God’s presence in Christ. This is not a full study of the remnant, and it is not a promise of earthly strength or prosperity.",
      "fear",
      "anxiety",
      [part("fear", "anxiety", "related", "Isaiah", 41)]
    ),
    repentance: pick(
      "Turning back and confessing",
      "Repentance here is turning to God, confessing sin, and waiting for him. John promises forgiveness and cleansing to those who confess. Isaiah’s promise of a voice saying “this is the way” sits inside a call to repent and wait, not inside a demand for instant direction.",
      "addiction",
      "addiction",
      [
        part("addiction", "addiction", "direct", "1 John", 1),
        part("guidance", "decision", "related", "Isaiah", 30),
      ]
    ),
    rest: one(
      "Rest for the weary",
      "Rest is Jesus’ promise to people who are weary and burdened, and Isaiah’s promise of renewed strength for those who wait on the Lord. It is rest for the soul and strength to go on. It does not say the load vanishes before you come, and it is not the same request as a prayer for an anxious mind.",
      "composure",
      "rest"
    ),
    restoration: pick(
      "Restoration in its own story",
      "The plainest restoration promise in this set was spoken to Judah in Babylon: after seventy years God would bring them back, with plans for their welfare. That promise was to those exiles. It is not a promise that every Christian’s loss will be reversed, or that every personal plan will succeed. Nearness to the brokenhearted is a different promise, and it does not erase the loss.",
      "purpose",
      "purpose",
      [
        part("purpose", "purpose", "related", "Jeremiah", 29),
        part("grief", "grief", "direct", "Psalms", 34),
      ]
    ),
    resurrection: pick(
      "Hope beyond death",
      "Resurrection hope, in the passage that looks ahead, is the new creation: God will dwell with his people, and death and mourning will be no more. That promise is future. It is not a claim that death has no grief today. This short set is not a chapter-by-chapter study of the resurrection.",
      "grief",
      "grief",
      [part("grief", "grief", "direct", "Revelation", 21)]
    ),
    reward: pick(
      "A harvest in its season",
      "Where reward is promised here, it is a harvest in due season for not giving up, and the crown of life for the person who endures temptation. The harvest is not quick relief and not wealth. Endurance is honored. The passages do not say the work will feel easy.",
      "composure",
      "strength",
      [
        part("composure", "strength", "direct", "Galatians", 6),
        part("temptation", "temptation", "related", "James", 1),
      ]
    ),
    righteousness: pick(
      "What human anger does not produce",
      "James says human anger does not produce God’s righteousness, and he tells you to be quick to hear and slow to anger. That is instruction about a hot temper. It does not say that restraint will change the other person, and it is not a full study of how God judges.",
      "composure",
      "anger",
      [part("composure", "anger", "direct", "James", 1)]
    ),
    salvation: pick(
      "Salvation by grace",
      "Salvation in this passage is by grace, through faith, and not by works. You are God’s workmanship, created in Christ for good works he prepared. Grace is not a wage. The passage does not rank careers, and it does not treat salvation as something you finish earning.",
      "purpose",
      "purpose",
      [part("purpose", "purpose", "direct", "Ephesians", 2)]
    ),
    satisfaction: one(
      "Contentment, not more silver",
      "Satisfaction here is contentment, which Scripture calls gain, and the Teacher’s warning that whoever loves silver is not satisfied with silver. Contentment is grounded in God’s presence rather than in having more. It is not a promise that you will become rich.",
      "wealth",
      "contentment"
    ),
    sovereignty: pick(
      "God’s purpose in what he allows",
      "God’s rule, in this sentence, is that he works all things for good for those who love him and are called according to his purpose. The good is tied to his purpose. The promise does not say the hardship itself is good, or that every plan we prefer will succeed.",
      "hardship",
      "hard",
      [part("hardship", "hard", "direct", "Romans", 8)]
    ),
    spirit: pick(
      "The Spirit’s fruit and the Spirit’s way",
      "The Spirit’s work here is fruit, including patience, gentleness, and self-control, and a walk in which you do not carry out the desire of the flesh. The fruit is produced by the Spirit, not by trying harder alone. The passages do not say that desire disappears.",
      "composure",
      "emotions",
      [
        part("composure", "emotions", "direct", "Galatians", 5),
        part("temptation", "temptation", "related", "Galatians", 5),
      ]
    ),
    strength: one(
      "Strength to continue",
      "Strength here is renewed strength for those who wait on the Lord, not growing weary in doing good, the inner person renewed day by day, and Christ’s strength in the circumstances Paul names, including hunger and abundance. It is not a promise that you will feel rested, or that you will succeed, or that exhaustion will end.",
      "composure",
      "strength"
    ),
    trust: one(
      "Trust instead of your own reading",
      "Trust in these passages is leaning on the Lord rather than on your own understanding, and asking him for wisdom. They promise guidance. They do not show you the finished decision, and they do not promise that trust produces wealth.",
      "guidance",
      "decision"
    ),
    truth: pick(
      "The truth that sets people free",
      "Truth in this passage is the Son’s word that sets people free from slavery to sin. Freedom is his work. It is not a promise of an easy change overnight, and it is not an essay on every use of the word truth.",
      "addiction",
      "addiction",
      [part("addiction", "addiction", "direct", "John", 8)]
    ),
    unity: pick(
      "Bearing with one another",
      "Unity here is instructed, not assumed: bear with one another, forgive, and let the peace of Christ rule. These are commands for people in Christ’s body. They do not promise that every disagreement ends at once.",
      "forgiveness",
      "forgive",
      [part("forgiveness", "forgive", "direct", "Colossians", 3)]
    ),
    urgency: pick(
      "Help for the temptation in front of you",
      "The nearest note about the moment at hand says temptation is common and God is faithful to provide a way to endure it. That is present help. It is not a claim that every delay is disobedience, and it is not a promise that the desire will vanish.",
      "temptation",
      "temptation",
      [part("temptation", "temptation", "direct", "1 Corinthians", 10)]
    ),
    victory: pick(
      "Victory over sin’s dominion",
      "Victory here is sin losing its right to rule, because you are under grace, and a way through temptation so you can endure it. The promise addresses mastery. It does not say desire disappears overnight, and it is not success in every earthly conflict.",
      "addiction",
      "addiction",
      [
        part("temptation", "temptation", "direct", "Romans", 6),
        part("temptation", "temptation", "direct", "1 Corinthians", 10),
      ]
    ),
    wisdom: one(
      "Wisdom for a decision",
      "Wisdom here is the wisdom God gives to those who ask, and the straight path that comes from trusting him rather than your own understanding. The promise is guidance. It is not the decision handed to you already made.",
      "guidance",
      "decision"
    ),
    witness: pick(
      "Sent, with his presence",
      "Witness here is the commission. Jesus claims all authority, sends his disciples, and promises to be with them always, to the end of the age. The promise is his presence with that sending. It is not a promise that every hearer will respond.",
      "loneliness",
      "alone",
      [part("loneliness", "alone", "direct", "Matthew", 28)]
    ),
    worship: one(
      "Worship that remembers",
      "Worship in these passages is blessing the Lord for forgiveness, healing, and steadfast love, and rejoicing in him. Paul commands that joy from prison. It is not a demand to feel happy about pain.",
      "gratitude",
      "thanks"
    ),
  };

  function forFilters(feeling, theme) {
    const feel = feeling && FEELINGS[feeling];
    const themeStudy = theme && THEMES[theme];
    const base = feel || themeStudy;
    if (!base) return null;
    let query = feel ? "filter:feeling:" + feeling : "filter:theme:" + theme;
    if (feel && themeStudy) query = "filter:feeling:" + feeling + "+theme:" + theme;
    return {
      heading: base.heading,
      intro: base.intro,
      concept: base.concept,
      intention: base.intention,
      parts: base.parts,
      query: query,
    };
  }

  global.GodsPromisesFilterStudies = {
    FEELINGS: FEELINGS,
    THEMES: THEMES,
    forFilters: forFilters,
  };
})(typeof window !== "undefined" ? window : globalThis);
