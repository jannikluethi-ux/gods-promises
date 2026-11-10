/**
 * Curated scripture connections for His Promise Daily search.
 * Supplement texts are verbatim World English Bible, copied from scripts/web_index.json.
 * Catalog passages are referenced by book and verse span; the engine uses the catalog's text.
 */
(function (global) {
  "use strict";

  function s(id, book, chapter, verseStart, verseEnd, text) {
    return {
      id: id,
      book: book,
      chapter: chapter,
      verseStart: verseStart,
      verseEnd: verseEnd,
      text: text,
      supplement: true,
    };
  }

  const SUPPLEMENTS = {
    "deu-8-18": s(
      "disc-deu-8-18",
      "Deuteronomy",
      8,
      17,
      18,
      "and lest you say in your heart, “My power and the might of my hand has gotten me this wealth.” But you shall remember the LORD your God, for it is he who gives you power to get wealth, that he may establish his covenant which he swore to your fathers, as it is today."
    ),
    "2ch-1-12": s(
      "disc-2ch-1-12",
      "2 Chronicles",
      1,
      11,
      12,
      "God said to Solomon, “Because this was in your heart, and you have not asked riches, wealth, honor, or the life of those who hate you, nor yet have you asked for long life; but have asked for wisdom and knowledge for yourself, that you may judge my people, over whom I have made you king, therefore wisdom and knowledge is granted to you. I will give you riches, wealth, and honor, such as none of the kings have had who have been before you, and none after you will have.”"
    ),
    "pro-22-7": s(
      "disc-pro-22-7",
      "Proverbs",
      22,
      7,
      7,
      "The rich rule over the poor. The borrower is servant to the lender."
    ),
    "2co-8-9": s(
      "disc-2co-8-9",
      "2 Corinthians",
      8,
      9,
      9,
      "For you know the grace of our Lord Jesus Christ, that though he was rich, yet for your sakes he became poor, that you through his poverty might become rich."
    ),
    "pro-23-4": s(
      "disc-pro-23-4",
      "Proverbs",
      23,
      4,
      5,
      "Don’t weary yourself to be rich. In your wisdom, show restraint. Why do you set your eyes on that which is not? For it certainly sprouts wings like an eagle and flies in the sky."
    ),
    "luk-12-15": s(
      "disc-luk-12-15",
      "Luke",
      12,
      15,
      15,
      "He said to them, “Beware! Keep yourselves from covetousness, for a man’s life doesn’t consist of the abundance of the things which he possesses.”"
    ),
    "mat-6-19": s(
      "disc-mat-6-19",
      "Matthew",
      6,
      19,
      21,
      "“Don’t lay up treasures for yourselves on the earth, where moth and rust consume, and where thieves break through and steal; but lay up for yourselves treasures in heaven, where neither moth nor rust consume, and where thieves don’t break through and steal; for where your treasure is, there your heart will be also."
    ),
    "ecc-5-10": s(
      "disc-ecc-5-10",
      "Ecclesiastes",
      5,
      10,
      10,
      "He who loves silver shall not be satisfied with silver, nor he who loves abundance, with increase. This also is vanity."
    ),
    "pro-13-11": s(
      "disc-pro-13-11",
      "Proverbs",
      13,
      11,
      11,
      "Wealth gained dishonestly dwindles away, but he who gathers by hand makes it grow."
    ),
    "col-3-23": s(
      "disc-col-3-23",
      "Colossians",
      3,
      23,
      24,
      "And whatever you do, work heartily, as for the Lord and not for men, knowing that from the Lord you will receive the reward of the inheritance; for you serve the Lord Christ."
    ),
    "pro-14-23": s(
      "disc-pro-14-23",
      "Proverbs",
      14,
      23,
      23,
      "In all hard work there is profit, but the talk of the lips leads only to poverty."
    ),
    "pro-21-5": s(
      "disc-pro-21-5",
      "Proverbs",
      21,
      5,
      5,
      "The plans of the diligent surely lead to profit; and everyone who is hasty surely rushes to poverty."
    ),
    "1ti-6-9": s(
      "disc-1ti-6-9",
      "1 Timothy",
      6,
      9,
      10,
      "But those who are determined to be rich fall into a temptation, a snare, and many foolish and harmful lusts, such as drown men in ruin and destruction. For the love of money is a root of all kinds of evil. Some have been led astray from the faith in their greed, and have pierced themselves through with many sorrows."
    ),
    "eph-5-25": s(
      "disc-eph-5-25",
      "Ephesians",
      5,
      25,
      27,
      "Husbands, love your wives, even as Christ also loved the assembly and gave himself up for her, that he might sanctify her, having cleansed her by the washing of water with the word, that he might present the assembly to himself gloriously, not having spot or wrinkle or any such thing, but that she should be holy and without defect."
    ),
    "eph-5-28": s(
      "disc-eph-5-28",
      "Ephesians",
      5,
      28,
      28,
      "Even so husbands also ought to love their own wives as their own bodies. He who loves his own wife loves himself."
    ),
    "gen-2-24": s(
      "disc-gen-2-24",
      "Genesis",
      2,
      24,
      24,
      "Therefore a man will leave his father and his mother, and will join with his wife, and they will be one flesh."
    ),
    "eph-6-4": s(
      "disc-eph-6-4",
      "Ephesians",
      6,
      4,
      4,
      "You fathers, don’t provoke your children to wrath, but nurture them in the discipline and instruction of the Lord."
    ),
    "col-3-21": s(
      "disc-col-3-21",
      "Colossians",
      3,
      21,
      21,
      "Fathers, don’t provoke your children, so that they won’t be discouraged."
    ),
    "mat-18-21": s(
      "disc-mat-18-21",
      "Matthew",
      18,
      21,
      22,
      "Then Peter came and said to him, “Lord, how often shall my brother sin against me, and I forgive him? Until seven times?” Jesus said to him, “I don’t tell you until seven times, but, until seventy times seven."
    ),
    "mrk-9-24": s(
      "disc-mrk-9-24",
      "Mark",
      9,
      24,
      24,
      "Immediately the father of the child cried out with tears, “I believe. Help my unbelief!”"
    ),
  };

  function link(key, concept, angle, role, directness, direct, related, why, aliases) {
    const span = SUPPLEMENTS[key];
    return {
      key: key,
      concept: concept,
      angle: angle,
      role: role,
      directness: directness,
      direct: direct,
      related: related,
      why: why,
      aliases: aliases || [],
      book: span ? span.book : key.book,
      chapter: span ? span.chapter : key.chapter,
      verseStart: span ? span.verseStart : key.verseStart,
      verseEnd: span ? span.verseEnd : key.verseEnd,
      supplementId: span ? span.id : null,
    };
  }

  function cat(book, chapter, verseStart, verseEnd, concept, angle, role, directness, direct, related, why, aliases) {
    return {
      concept: concept,
      angle: angle,
      role: role,
      directness: directness,
      direct: direct,
      related: related,
      why: why,
      aliases: aliases || [],
      book: book,
      chapter: chapter,
      verseStart: verseStart,
      verseEnd: verseEnd,
      supplementId: null,
    };
  }

  const LINKS = [
    link("deu-8-18", "wealth", "source", "principle", 98, ["desire", "work", "blessing"], ["worry", "stewardship", "ethics", "contentment"], "Moses is speaking to Israel in the land, inside the covenant sworn to their fathers. He warns them not to say their own power produced their wealth: the Lord gives the ability to gain it. This is not a promise that faithful Christians will become wealthy.", ["power to get wealth", "gives you power", "gives the power to get wealth"]),
    cat("Proverbs", 10, 22, 22, "wealth", "blessing", "principle", 94, ["desire", "blessing", "work"], ["worry", "contentment"], "A proverb: the Lord’s blessing is what brings wealth, and it does not add the sorrow that crooked gain brings. It is a principle about the source of wealth, not a formula that guarantees riches."),
    cat("1 Chronicles", 29, 11, 12, "wealth", "source", "principle", 93, ["desire", "blessing"], ["stewardship", "ethics"], "David says riches and honor come from God, and God rules over all. This is praise about God’s ownership, spoken as offerings are given, not a promise that a person will be made rich."),
    cat("Ecclesiastes", 5, 19, 20, "wealth", "gift", "principle", 90, ["desire", "contentment", "work"], ["blessing"], "Ecclesiastes calls riches, and the power to enjoy them and one’s labor, a gift of God. The point is grateful enjoyment of what God gives, not a command to pursue more."),
    cat("Matthew", 6, 31, 34, "wealth", "provision", "promise", 88, ["worry", "desire", "work", "blessing"], ["contentment", "stewardship"], "Jesus promises that the Father knows what you need and will add food, drink, and clothing when you seek his kingdom first. The promise is care for needs, not a pledge of wealth."),
    cat("Philippians", 4, 19, 19, "wealth", "provision", "promise", 86, ["worry", "contentment"], ["desire", "stewardship"], "Paul tells a church that had given generously that God will supply their need. It is a promise of provision for need, in the setting of their gift, not a promise of riches."),
    link("2ch-1-12", "wealth", "wisdom", "related", 84, ["work", "blessing"], ["desire", "ethics", "stewardship"], "This gift of riches was made to Solomon, after he asked for wisdom to judge Israel rather than for wealth. It is not a pattern that God will enrich every believer who asks.", ["wisdom and knowledge", "have not asked riches"]),
    cat("Deuteronomy", 28, 11, 12, "wealth", "covenant", "principle", 76, ["work", "blessing"], ["desire", "worry"], "These are covenant blessings of rain, work, and lending, spoken to Israel in the land if they obeyed the covenant. They are not a general promise that every believer will become a lender to nations."),
    link("pro-14-23", "wealth", "work", "instruction", 86, ["work", "desire", "stewardship"], ["worry"], "A proverb pairing hard work with profit and empty talk with poverty. It teaches diligence; it does not promise a particular income."),
    link("pro-21-5", "wealth", "work", "instruction", 84, ["work", "desire"], ["stewardship"], "Diligent plans tend toward profit, and haste toward poverty. This is wisdom about how work is done, not a guarantee of wealth."),
    link("col-3-23", "wealth", "work", "instruction", 88, ["work"], ["desire", "stewardship"], "Paul tells bondservants to work for the Lord. The reward he names is the inheritance from the Lord, not a larger paycheck."),
    cat("Proverbs", 16, 3, 3, "wealth", "work", "instruction", 80, ["work"], ["desire", "guidance"], "Commit your work to the Lord and your plans are established. This is about entrusting work to God, not about God owing you success."),
    link("pro-13-11", "wealth", "work", "principle", 82, ["work", "stewardship", "ethics"], ["desire"], "Dishonest wealth shrinks; what is gathered by steady work grows. The proverb judges how wealth is gained."),
    link("pro-22-7", "wealth", "debt", "principle", 80, ["stewardship", "worry"], ["desire", "ethics"], "A proverb about power and debt: the borrower becomes servant to the lender. It describes the weight of debt; it does not bless borrowing."),
    cat("Proverbs", 11, 24, 25, "wealth", "generosity", "principle", 86, ["stewardship"], ["desire", "blessing", "contentment"], "Generosity and stinginess are set side by side. Scattering can lead to increase, and withholding more than is right can lead to poverty. It is a proverb about an open hand."),
    cat("2 Corinthians", 9, 6, 8, "wealth", "generosity", "instruction", 84, ["stewardship", "blessing"], ["desire", "worry"], "Paul is teaching cheerful giving. God is able to make grace abound so they can abound in every good work. The aim is generosity, not personal enrichment."),
    cat("1 Timothy", 6, 6, 8, "wealth", "contentment", "instruction", 95, ["contentment", "ethics"], ["desire", "worry", "stewardship"], "Godliness with contentment is great gain. Paul says we brought nothing in and can carry nothing out, and that food and clothing are enough. Wanting to be rich is not the gain he praises."),
    cat("Philippians", 4, 11, 13, "wealth", "contentment", "instruction", 92, ["contentment", "worry"], ["desire", "work"], "Paul has learned to be content with little or much. “I can do all things” here means Christ’s strength for every financial circumstance, not a promise of success."),
    cat("Hebrews", 13, 5, 6, "wealth", "contentment", "instruction", 90, ["contentment", "worry"], ["desire", "ethics"], "Keep free from the love of money and be content, because God has said he will never leave you. The promise is God’s presence, not a larger balance."),
    cat("1 Timothy", 6, 17, 19, "wealth", "stewardship", "instruction", 91, ["stewardship", "ethics", "contentment"], ["desire", "blessing"], "Paul tells the rich not to be arrogant or to hope in uncertain riches, but in God who provides, and to be rich in good works and ready to share. Hope is relocated from wealth to God."),
    link("1ti-6-9", "wealth", "greed", "instruction", 96, ["ethics"], ["desire", "stewardship", "contentment"], "Those who are determined to be rich fall into a snare, and the love of money is a root of all kinds of evil. Scripture warns about the desire itself; it does not say that having money is automatically wrong."),
    link("luk-12-15", "wealth", "greed", "instruction", 93, ["ethics"], ["desire", "stewardship", "contentment"], "Jesus says to watch out for covetousness: life does not consist in how much you possess. A wish to be rich is answered here by a warning, not by a method."),
    link("pro-23-4", "wealth", "greed", "instruction", 90, ["ethics"], ["desire", "work", "contentment"], "Don’t wear yourself out to become rich. Wisdom here is restraint, because wealth can vanish. This corrects the wish; it does not fulfill it."),
    link("ecc-5-10", "wealth", "greed", "principle", 88, ["ethics"], ["desire", "contentment"], "Whoever loves silver is not satisfied with silver. The Teacher calls the love of increase vanity. More money does not settle the heart."),
    link("mat-6-19", "wealth", "spiritual", "instruction", 87, ["ethics", "stewardship", "contentment"], ["desire"], "Jesus contrasts treasure on earth, which decays, with treasure in heaven. He is redirecting the heart, not promising earthly wealth."),
    link("2co-8-9", "wealth", "spiritual", "related", 76, [], ["ethics", "desire", "stewardship", "blessing", "contentment"], "Paul says Christ was rich and became poor so that we might become rich. In this chapter “rich” means the grace of generosity and sharing in Christ, not a promise of financial wealth.", ["became poor", "through his poverty"]),
    cat("Malachi", 3, 10, 11, "wealth", "generosity", "related", 68, ["stewardship"], ["blessing", "desire"], "God tells post-exile Israel to bring the full tithe into the temple storehouse and speaks of opening the windows of heaven. That promise belongs to that covenant and that storehouse. It is not a personal investment plan for Christians."),

    cat("James", 1, 19, 20, "composure", "control", "instruction", 97, ["anger", "frustrated", "emotions"], ["patience", "peace", "strength", "waiting"], "James says to be quick to hear, slow to speak, and slow to anger, because human anger does not produce God’s righteousness. This speaks to frustration and a short temper as something to restrain."),
    cat("Psalms", 37, 7, 8, "composure", "patience", "instruction", 96, ["patience", "frustrated", "anger", "waiting", "emotions"], ["peace", "strength"], "The psalm says to rest and wait patiently, and to cease from anger and wrath. Fretting is tied to evil. It addresses impatience and anger together."),
    cat("Proverbs", 15, 1, 1, "composure", "control", "instruction", 86, ["anger", "frustrated", "emotions"], ["patience", "peace"], "A gentle answer turns away wrath. This is practical wisdom for a sharp temper, not a promise that the other person will change."),
    cat("Ephesians", 4, 26, 27, "composure", "control", "instruction", 88, ["anger", "frustrated", "emotions"], ["patience"], "Paul says to be angry and not sin, and not to let the sun go down on anger. Anger is not denied; it is bounded so it does not become a foothold."),
    cat("Ephesians", 4, 32, 32, "composure", "control", "instruction", 80, ["anger", "emotions"], ["frustrated", "forgiveness"], "Put away bitterness and anger, and be kind and forgiving as God in Christ forgave you. The instruction is to replace anger, not merely to feel calmer."),
    cat("Galatians", 5, 22, 23, "composure", "control", "principle", 84, ["emotions", "frustrated", "patience"], ["anger", "peace"], "The fruit of the Spirit includes patience, gentleness, and self-control. These are produced by the Spirit, not by trying harder in your own strength alone."),
    cat("John", 14, 27, 27, "composure", "peace", "promise", 98, ["peace"], ["rest", "strength", "frustrated"], "On the night before the cross, Jesus tells the disciples he leaves his own peace with them, not peace as the world gives, and says not to let the heart be troubled or afraid. The promise is his peace in the midst of trouble, not the removal of it."),
    cat("Isaiah", 26, 3, 4, "composure", "peace", "promise", 97, ["peace"], ["rest", "strength", "frustrated", "anger"], "Isaiah says God keeps in peace the mind that stays on him, because it trusts. The promise is a steadied mind, not control of every feeling, and it sits in a song about the city that trusts the Lord."),
    cat("Philippians", 4, 6, 7, "composure", "peace", "promise", 90, ["peace"], ["rest", "strength", "frustrated", "anger", "waiting", "emotions", "patience"], "Paul says not to be anxious, but to bring requests to God, and promises that God’s peace will guard heart and mind. The promise is peace, not the removal of the problem, and not a general verse for every kind of tiredness."),
    cat("Matthew", 11, 28, 30, "composure", "rest", "promise", 98, ["rest"], ["peace", "strength", "frustrated", "anger", "emotions", "patience", "waiting"], "Jesus invites people who are weary and burdened to come to him, and promises rest for the soul. His yoke is easy and his burden light. This is rest, not a promise that the work disappears or that waiting will be short."),
    cat("Isaiah", 40, 28, 31, "composure", "rest", "promise", 97, ["rest", "strength", "waiting"], ["peace", "frustrated", "patience"], "Isaiah says even youths faint, and that those who wait for the Lord renew their strength: they run and walk and do not faint. The promise is renewed strength for the weary, not a promise that you will never feel tired."),
    cat("2 Corinthians", 4, 16, 18, "composure", "strength", "encouragement", 93, ["strength", "rest"], ["peace", "frustrated"], "Paul says he does not lose heart: the outer person is wasting away and the inner person is renewed daily. He calls the affliction light only by comparison with eternal glory. This is help to continue, not a claim that the suffering feels light today."),
    cat("Galatians", 6, 7, 9, "composure", "strength", "instruction", 94, ["strength"], ["rest", "patience", "waiting"], "Paul says a person reaps what they sow, and then: do not grow weary in doing good, for in due season we will reap if we do not give up. The harvest is promised in its season. It is not a promise of quick relief or of wealth."),
    cat("Philippians", 4, 11, 13, "composure", "strength", "encouragement", 91, ["strength"], ["rest", "peace", "frustrated"], "“I can do all things through Christ” comes after Paul says he has learned contentment in hunger and in abundance. Christ strengthens him for those circumstances. It is not a promise of success, wealth, or the end of exhaustion."),
    cat("1 Peter", 5, 6, 7, "composure", "peace", "encouragement", 86, [], ["peace", "rest", "strength", "frustrated", "waiting", "anger", "patience", "emotions"], "Cast your anxiety on God because he cares for you. The comfort is his care, after a call to humble yourself under his hand. It belongs with anxiety more than with physical exhaustion."),
    cat("Isaiah", 41, 8, 10, "composure", "strength", "encouragement", 80, [], ["strength", "peace", "rest", "frustrated", "waiting", "patience", "anger", "emotions"], "Spoken to Israel, God’s servant: do not fear, for I am with you; I will strengthen, help, and uphold you. The church receives God’s presence in Christ. This is not a promise that every Christian will be spared weakness or made prosperous."),

    cat("Philippians", 4, 6, 7, "fear", "anxiety", "promise", 97, ["anxiety", "future"], ["presence"], "Bring what you fear to God in prayer. The promise is that his peace will guard your heart and thoughts, not that the future will turn out as you planned."),
    cat("Isaiah", 41, 8, 10, "fear", "presence", "encouragement", 88, ["anxiety", "future", "presence"], [], "Spoken to Israel, God’s servant: do not fear, for I am with you; I will strengthen and uphold you. Christians receive God’s presence in Christ. It is not a promise that the feared event will not happen, or that God will make the hearer wealthy or strong in every earthly way."),
    cat("1 Peter", 5, 6, 7, "fear", "anxiety", "encouragement", 92, ["anxiety", "future"], ["presence"], "Throw your worries onto God because he cares for you. Fear is met with his care, under his mighty hand."),
    cat("Matthew", 6, 25, 34, "fear", "future", "promise", 90, ["future", "anxiety"], ["presence"], "Jesus says not to worry about tomorrow; the Father already knows what you need. The passage answers fear of the future with trust, one day at a time."),
    cat("Psalms", 23, 1, 4, "fear", "presence", "encouragement", 86, ["future", "presence", "anxiety"], [], "The Lord is the shepherd who walks with his people through the valley. The comfort is his presence, not a life without dark valleys."),
    cat("Joshua", 1, 8, 9, "fear", "presence", "encouragement", 80, ["future", "presence"], ["anxiety"], "God commissions Joshua to lead Israel into the land and tells him to be strong, because the Lord is with him. The words belong to that task. They are not a general promise of success for every decision."),

    link("eph-5-25", "marriage", "love", "instruction", 96, ["marriage"], ["conflict"], "Paul tells husbands to love their wives as Christ loved the church and gave himself up for her, so that she would be holy. The aim is Christlike love and sanctification, not a promise that feelings will always be easy.", ["husbands", "wives"]),
    link("eph-5-28", "marriage", "love", "instruction", 90, ["marriage"], ["conflict"], "Husbands are to love their wives as their own bodies. The instruction ties care for a spouse to how a person cares for himself."),
    link("gen-2-24", "marriage", "union", "principle", 88, ["marriage"], [], "Marriage is described as leaving father and mother and becoming one flesh. This is the shape of the covenant, not advice for a particular fight."),
    cat("1 Corinthians", 13, 4, 8, "marriage", "love", "instruction", 92, ["marriage", "conflict"], [], "Love is patient and kind, not irritable or resentful, and it bears and endures. Paul is describing love’s character. It applies in marriage because marriage lives on that love; it is not only a wedding text."),
    cat("Colossians", 3, 12, 15, "marriage", "peace", "instruction", 84, ["conflict", "marriage"], [], "Put on compassion, patience, and forgiveness, and let the peace of Christ rule. This is how people in Christ’s body treat each other, including a husband and wife."),

    cat("Proverbs", 22, 6, 6, "parenting", "nurture", "principle", 90, ["parenting", "impatient"], ["children"], "Train a child in the way he should go. This is a proverb about formation over time, not a guarantee that a method will control a child’s future."),
    link("eph-6-4", "parenting", "gentleness", "instruction", 96, ["impatient", "parenting"], ["children"], "Fathers are told not to provoke their children to anger, but to bring them up in the Lord’s discipline and instruction. Impatience that wounds a child is exactly what this forbids."),
    link("col-3-21", "parenting", "gentleness", "instruction", 94, ["impatient", "parenting"], [], "Do not provoke your children, or they become discouraged. The instruction protects the child from a parent’s harshness."),
    cat("Psalms", 127, 3, 5, "parenting", "gift", "principle", 82, ["children", "parenting"], ["impatient"], "Children are called a heritage from the Lord. The psalm treats them as a gift, which is a different note from techniques for managing them."),
    cat("Galatians", 5, 22, 23, "parenting", "gentleness", "principle", 80, ["impatient"], ["parenting"], "Patience, kindness, and gentleness are fruit of the Spirit. They are the character a parent needs when a child is slow or difficult."),

    link("mat-18-21", "forgiveness", "mercy", "instruction", 97, ["forgive"], ["reconcile"], "Peter asks how often to forgive. Jesus answers seventy times seven. The point is that forgiveness is not a small quota."),
    cat("Matthew", 6, 14, 15, "forgiveness", "mercy", "instruction", 94, ["forgive", "reconcile"], [], "Jesus ties forgiving others to the forgiveness we ask from the Father. This is instruction about releasing a debt, not a claim that trust must be restored instantly."),
    cat("Ephesians", 4, 32, 32, "forgiveness", "mercy", "instruction", 93, ["forgive", "reconcile"], [], "Forgive one another, as God in Christ forgave you. The pattern is God’s forgiveness, which is mercy rather than waiting until the other person deserves it."),
    cat("Colossians", 3, 12, 15, "forgiveness", "mercy", "instruction", 88, ["forgive", "reconcile"], [], "Bear with one another and forgive, as the Lord forgave you. Forgiveness sits beside patience and love, not in place of them."),

    cat("Isaiah", 41, 8, 10, "loneliness", "presence", "encouragement", 90, ["alone"], [], "Spoken to Israel, the servant God chose: I am with you; I will not cast you off. The comfort for loneliness is God’s presence. It was not said to promise human company on demand, or prosperity."),
    cat("Psalms", 27, 10, 10, "loneliness", "presence", "encouragement", 90, ["alone"], [], "Even if father and mother forsake, the Lord will take you up. The psalm names abandonment and answers it with God’s care."),
    cat("Matthew", 28, 18, 20, "loneliness", "presence", "promise", 92, ["alone"], [], "Jesus promises to be with his disciples always, to the end of the age. The promise is his ongoing presence, given with the commission."),
    cat("Deuteronomy", 31, 6, 6, "loneliness", "presence", "encouragement", 84, ["alone"], [], "Moses tells Israel, as they are about to enter the land, not to fear, because the Lord goes with them and will not forsake them. The words are for that people and that crossing. The comfort they still give is God’s presence, not a promise of an easy life."),
    cat("Hebrews", 13, 5, 6, "loneliness", "presence", "promise", 88, ["alone"], [], "God has said he will never leave you or forsake you. The writer uses that promise so the reader can refuse the love of money and also the fear of being abandoned."),

    cat("Psalms", 34, 15, 18, "grief", "comfort", "promise", 97, ["grief"], [], "The Lord is near to the brokenhearted and saves the crushed in spirit. This is a promise of nearness in grief, not an explanation that erases the loss."),
    cat("Revelation", 21, 3, 4, "grief", "hope", "promise", 92, ["grief"], [], "God will wipe away tears, and death and mourning will be no more. This is a future promise about the new creation, not a claim that grief ends today."),
    cat("2 Corinthians", 1, 3, 4, "grief", "comfort", "encouragement", 90, ["grief"], ["hardship"], "The Father of mercies comforts us in affliction so that we can comfort others. Comfort is given inside suffering, and then shared."),
    cat("Psalms", 23, 1, 4, "grief", "presence", "encouragement", 84, ["grief"], [], "The shepherd walks through the valley of the shadow of death with his people. The psalm does not deny the valley."),

    cat("1 Corinthians", 10, 13, 13, "temptation", "way", "promise", 96, ["temptation"], [], "No temptation has seized you except what is common, and God is faithful to provide a way out so you can endure it. The promise is a way through, not the absence of temptation."),
    cat("Hebrews", 2, 17, 18, "temptation", "help", "encouragement", 90, ["temptation"], [], "Because Jesus suffered when he was tempted, he is able to help those who are tempted. Help comes from his sympathy, not from pretending the pull is small."),
    cat("James", 1, 12, 12, "temptation", "endure", "encouragement", 84, ["temptation"], [], "The person who endures temptation is called blessed and is promised the crown of life. Endurance is honored; giving in is not."),
    cat("Galatians", 5, 16, 18, "temptation", "spirit", "instruction", 88, ["temptation"], ["addiction"], "Walk by the Spirit and you will not carry out the desire of the flesh. The instruction is to live by the Spirit, not merely to tighten willpower."),
    cat("Romans", 6, 14, 14, "temptation", "grace", "promise", 82, ["temptation", "addiction"], [], "Sin will not have dominion over you, because you are under grace. This is a promise about sin’s rule being broken, not a claim that desire disappears overnight."),

    cat("John", 8, 34, 36, "addiction", "freedom", "promise", 94, ["addiction"], ["temptation"], "Everyone who sins is a slave to sin, and the Son sets people free. Freedom is Christ’s work, not a technique."),
    cat("1 John", 1, 8, 9, "addiction", "confess", "promise", 90, ["addiction"], ["temptation"], "If we confess our sins, God is faithful to forgive and cleanse. This is for people who have failed again, not only for people who have already stopped."),
    cat("Philippians", 4, 11, 13, "addiction", "strength", "encouragement", 82, ["addiction"], [], "Christ strengthens Paul for every circumstance. Read beside a craving, it is strength to live without what enslaves, not a slogan of success."),
    cat("Romans", 6, 14, 14, "addiction", "grace", "promise", 88, ["addiction"], ["temptation"], "Sin shall not be your master, because you are under grace. The promise addresses mastery, which is what addiction claims."),

    cat("Ephesians", 2, 8, 10, "purpose", "calling", "principle", 94, ["purpose"], [], "You are saved by grace, and you are God’s workmanship, created in Christ for good works he prepared. Purpose here is God’s prepared work, not a career ranking."),
    cat("Jeremiah", 29, 10, 11, "purpose", "hope", "related", 70, ["purpose"], ["guidance"], "God tells Judah in Babylon that after seventy years he will bring them back, and that his plans for them are for welfare and a future. That promise was made to those exiles. It is not a promise that every Christian’s personal plans will succeed."),
    cat("Psalms", 138, 7, 8, "purpose", "calling", "encouragement", 84, ["purpose"], [], "The Lord will fulfill his purpose for me. The psalmist rests purpose in God’s completing work."),
    cat("Romans", 8, 28, 28, "purpose", "hope", "promise", 88, ["purpose", "hardship"], ["faith"], "God works all things for good for those who love him and are called according to his purpose. The good is tied to his purpose, not to every plan we prefer."),

    cat("Hebrews", 11, 1, 1, "faith", "trust", "principle", 90, ["faith", "doubt"], [], "Faith is confidence in what is hoped for and assurance about what is not seen. The chapter then shows faith as trusting God when the outcome is still unseen."),
    cat("2 Timothy", 2, 11, 13, "faith", "trust", "promise", 88, ["faith", "doubt"], [], "If we are faithless, he remains faithful, for he cannot deny himself. The promise is God’s faithfulness when ours fails. It is not permission to stay away."),
    link("mrk-9-24", "faith", "doubt", "encouragement", 96, ["doubt", "faith"], [], "A father says, “I believe. Help my unbelief.” Scripture includes a prayer that admits doubt and asks for help. Doubt does not have to be hidden before God will hear."),

    link("mrk-9-24", "doubt", "honest", "encouragement", 97, ["doubt"], ["faith"], "The father’s prayer holds belief and unbelief in the same sentence and asks Jesus for help. Doubt can be brought to Jesus rather than solved before you pray."),
    cat("2 Timothy", 2, 11, 13, "doubt", "faithful", "promise", 86, ["doubt", "faith"], [], "Christ remains faithful even when we are faithless. The ground of trust is his character, not the steadiness of our feelings."),
    cat("James", 1, 5, 6, "doubt", "ask", "instruction", 80, ["doubt"], ["guidance", "faith"], "Ask God for wisdom. James also warns against a double mind that does not expect God to answer. The invitation to ask still stands."),

    cat("1 Thessalonians", 5, 16, 18, "gratitude", "thanks", "instruction", 95, ["thanks"], [], "Rejoice always, pray without ceasing, give thanks in everything, for this is God’s will in Christ. Thanks is commanded in every circumstance, not only when life is easy."),
    cat("Psalms", 103, 1, 5, "gratitude", "thanks", "encouragement", 88, ["thanks"], [], "The psalm lists what God has done — forgiveness, healing, steadfast love — and calls the soul to bless him. Gratitude here remembers concrete kindness."),
    cat("Philippians", 4, 4, 5, "gratitude", "joy", "instruction", 84, ["thanks"], [], "Rejoice in the Lord always. The joy Paul commands is in the Lord, and he writes it from prison. It is not a demand to feel happy about pain."),

    cat("James", 5, 13, 16, "health", "pray", "promise", 94, ["sick"], [], "James tells the sick to call the elders of the church and pray, and says the prayer of faith will save the sick and the Lord will raise him up. That stated result belongs with confession and the church’s prayer. It is not a guarantee that every disease ends, and it is not a promise of wealth."),
    cat("Psalms", 103, 1, 5, "health", "heal", "encouragement", 86, ["sick"], [], "The psalm blesses the Lord who forgives and heals diseases. It is praise for who God is, spoken in general, not a timetable for one illness."),
    cat("Isaiah", 53, 4, 6, "health", "bear", "related", 82, ["sick"], [], "The servant bears our griefs and sorrows and is wounded for our transgressions. The passage is about the servant’s suffering for sin. Christians have read healing here; the text itself centers on bearing iniquity."),
    cat("3 John", 1, 2, 2, "health", "wish", "encouragement", 78, ["sick"], [], "John prays that Gaius may prosper in health as his soul prospers. It is a prayer for a friend, not a doctrine that God always grants physical health."),
    cat("Matthew", 11, 28, 30, "health", "rest", "promise", 80, ["sick"], [], "Jesus offers rest to the weary. For someone ill or exhausted, the promise is rest in him, not a diagnosis."),

    cat("Romans", 8, 28, 28, "hardship", "purpose", "promise", 92, ["hard"], ["grief"], "In suffering, Paul says God works things for good according to his purpose for those who love him. The promise does not say the hardship itself is good."),
    cat("2 Corinthians", 4, 7, 9, "hardship", "endure", "encouragement", 90, ["hard"], [], "We are afflicted but not crushed, perplexed but not driven to despair. Paul describes endurance in weakness, with the treasure in jars of clay."),
    cat("Psalms", 34, 15, 18, "hardship", "near", "promise", 94, ["hard", "grief"], [], "The Lord is near the brokenhearted. Hard circumstances are met with nearness, not with a denial that the heart is crushed."),
    cat("Isaiah", 41, 8, 10, "hardship", "strength", "encouragement", 84, ["hard"], [], "Spoken to Israel: do not fear, for I am with you; I will strengthen and uphold you. In hardship the comfort is God’s help. It is not a promise that the hard season will be short or profitable."),
    cat("Psalms", 23, 1, 4, "hardship", "presence", "encouragement", 84, ["hard"], [], "The shepherd’s rod and staff comfort in the valley. The psalm expects a valley and promises company in it."),

    cat("Proverbs", 3, 5, 6, "guidance", "trust", "instruction", 97, ["decision", "guidance"], [], "Trust the Lord with all your heart and do not lean on your own understanding; he will make your paths straight. This is a call to trust him in decisions, not a map of the next step."),
    cat("James", 1, 5, 6, "guidance", "ask", "promise", 94, ["decision", "guidance"], ["doubt"], "If you lack wisdom, ask God, who gives generously. The promise is wisdom given to those who ask, with a warning not to ask while refusing to trust him."),
    cat("Psalms", 32, 7, 8, "guidance", "lead", "promise", 88, ["decision", "guidance"], [], "God says he will instruct and teach the way you should go, and counsel you with his eye. Guidance is personal counsel, spoken in a psalm of confession."),
    cat("Isaiah", 30, 19, 21, "guidance", "lead", "promise", 86, ["guidance", "decision"], [], "Your ears will hear a word behind you: this is the way, walk in it. The promise sits in a call to repent and wait for the Lord, not in a demand for instant direction."),
  ];

  const CONCEPTS = {
    wealth: {
      label: "wealth",
      signals: ["wish i was rich", "want to be rich", "become wealthy", "become rich", "financially independent", "financial blessing", "financial blessings", "more money", "get wealth", "power to get wealth", "handle money", "love of money", "losing my money", "lost my money", "bless my work", "content with what i have", "pay my bills", "financially", "financial", "finances", "wealthy", "wealth", "riches", "rich", "money", "prosperity", "prosper", "stewardship", "debt", "broke", "bills"],
      weights: { "wish i was rich": 8, "want to be rich": 8, "become wealthy": 8, "become rich": 8, "power to get wealth": 9, "get wealth": 7, "financial blessing": 7, "financial blessings": 7, "handle money": 8, "love of money": 7, "losing my money": 8, "lost my money": 8, "more money": 6, "financially independent": 7, "bless my work": 5, "content with what i have": 6, "pay my bills": 7, financially: 5, financial: 5, finances: 5, wealthy: 5, wealth: 5, riches: 5, rich: 5, money: 5, prosperity: 4, prosper: 3, debt: 4, broke: 3, bills: 5 },
      intentions: [
        { id: "worry", when: ["worried", "worry", "anxious", "afraid", "struggling", "struggle", "losing", "lost my", "can't afford", "cannot afford", "in debt", "bills"], heading: "Provision when money is tight", intro: "These passages speak to need, debt, and the fear of not having enough. They promise God’s care for needs, and they also teach contentment. They do not promise that the worry will be solved by becoming rich." },
        { id: "contentment", when: ["content", "satisfied", "enough", "what i have"], heading: "Contentment and trust", intro: "Scripture treats contentment as gain, and it grounds that in God’s presence rather than in having more. These passages teach that directly." },
        { id: "ethics", when: ["wrong", "sinful", "greedy", "should i", "is it wrong", "is it ok", "love of money", "covet"], heading: "Riches, desire, and the heart", intro: "Wanting to be rich is not answered with a simple yes. These passages warn about the love of money and point hope toward God, while still saying that God is the giver of whatever wealth people have." },
        { id: "stewardship", when: ["handle", "manage", "spend", "steward", "generosity", "give", "tithe"], heading: "Stewardship and generosity", intro: "These passages are about how money is held: debt, honest work, open hands, and not trusting riches. They instruct more than they promise." },
        { id: "work", when: ["work", "job", "career", "business", "labor", "diligent"], heading: "Work, wisdom, and God’s blessing", intro: "Scripture connects diligence and committing work to the Lord with fruit, and it also shows God as the one who gives the ability to gain. Wisdom is honored above the request for riches." },
        { id: "desire", when: [], heading: "Financial prosperity and stewardship", intro: "A wish to be rich touches several different things Scripture actually says: God as the giver of the ability to gain wealth, blessing and enjoyment as gifts, provision for needs, diligence, and clear warnings about greed. None of these is a promise that God will make you rich. Passages that use the word “rich” in another sense are kept with the related perspectives." },
      ],
    },
    composure: {
      label: "patience",
      signals: ["frustrated", "frustration", "losing my patience", "my patience", "impatient", "impatience", "angry too easily", "too easily", "cannot control my emotions", "control my emotions", "calm down", "calm mind", "peace in my mind", "overwhelmed", "exhausted", "worn out", "tired of waiting", "keep going", "strength to continue", "strength to keep", "self-control", "self control", "persevere", "patience", "angry", "anger", "temper", "waiting", "calm", "peace", "strength", "weary"],
      weights: { "losing my patience": 8, "my patience": 6, "angry too easily": 8, "control my emotions": 8, "peace in my mind": 9, "calm mind": 8, "tired of waiting": 7, "keep going": 6, "strength to continue": 8, "strength to keep": 7, "calm down": 7, frustrated: 7, frustration: 6, impatient: 6, impatience: 6, overwhelmed: 7, exhausted: 7, "worn out": 7, weary: 6, persevere: 6, patience: 5, angry: 5, anger: 5, waiting: 4, calm: 5, peace: 5, strength: 5, temper: 5 },
      intentions: [
        { id: "anger", when: ["angry", "anger", "temper", "too easily", "wrath"], heading: "Patience and self-control", intro: "These passages treat a hot temper as something to slow down and put away. They instruct more than they soothe: be slow to anger, cease from wrath, and answer gently." },
        { id: "patience", when: ["patience", "impatient", "impatience", "tired of waiting"], heading: "Patience while you wait", intro: "Waiting is addressed directly: be still before the Lord, cease from fretting, and do not grow weary of doing good. The harvest, where one is promised, is in its season. These are not verses about falling asleep or about a quiet mind in the abstract." },
        { id: "rest", when: ["exhausted", "overwhelmed", "worn out", "weary", "burned out", "tired"], heading: "Rest for the weary", intro: "Exhaustion is met by Jesus’ invitation to the weary and by Isaiah’s words to people who faint. The promise is rest and renewed strength. It is not the same as a prayer for an anxious mind, and it does not say the load will vanish before you come." },
        { id: "peace", when: ["peace", "calm", "mind"], heading: "Peace of mind", intro: "These passages are about a heart that is not troubled: the peace Jesus gives, and the mind God keeps in peace when it trusts him. They are not a prescription for physical exhaustion, and they do not promise that the trouble itself disappears." },
        { id: "strength", when: ["strength", "keep going", "continue", "persevere"], heading: "Strength to continue", intro: "These passages are about not giving up: renewed strength for those who wait, not growing weary in doing good, the inner person renewed day by day, and Christ’s strength in every circumstance. They are not a promise that you will feel rested, or that you will succeed." },
        { id: "emotions", when: ["emotions", "control my"], heading: "Patience and self-control", intro: "Scripture does not tell you to suppress every feeling. It does call for self-control, a slow anger, and the Spirit’s fruit when emotions run ahead of you." },
        { id: "frustrated", when: [], heading: "Patience and self-control", intro: "Frustration sits between anger and impatience. These passages say to be slow to anger and to cease from wrath. Peace and rest are nearby, but they are not offered as if frustration were the same thing as exhaustion or as a request for a quiet mind." },
      ],
    },
    fear: {
      label: "fear",
      signals: ["afraid of the future", "the future", "anxious", "anxiety", "afraid", "scared", "fear", "worried", "worrying", "worry", "panic"],
      weights: { "afraid of the future": 8, "the future": 4, anxious: 6, anxiety: 6, afraid: 6, scared: 5, fear: 5, worried: 4, worrying: 5, worry: 4, panic: 5 },
      intentions: [
        { id: "future", when: ["future", "tomorrow"], heading: "Trust for what you cannot see", intro: "Fear of the future is met by God’s presence and by Jesus’ words about tomorrow. The promise is care and peace, not a preview of how everything will turn out." },
        { id: "anxiety", when: [], heading: "Peace instead of anxiety", intro: "These passages tell an anxious person to bring the worry to God and promise his peace and presence. They do not shame the fear, and they do not promise that the feared thing will not happen." },
      ],
    },
    marriage: {
      label: "marriage",
      signals: ["stronger marriage", "my marriage", "marriage", "married", "spouse", "husband", "wife", "wedding"],
      weights: { "stronger marriage": 8, "my marriage": 7, marriage: 6, married: 4, spouse: 5, husband: 3, wife: 3 },
      intentions: [
        { id: "conflict", when: ["fight", "conflict", "arguing", "divorce", "hurt me"], heading: "Love and peace in a hard marriage", intro: "Where a relationship is strained, Scripture talks about patience, forgiveness, and love that is not irritable. These are commands about how to love, not a promise that the other person will change." },
        { id: "marriage", when: [], heading: "Marriage and faithful love", intro: "These passages describe marriage as one flesh and tell husbands and wives to love with Christ’s kind of love. God’s love for his people is a different subject and is not offered here as if it were marriage advice." },
      ],
    },
    parenting: {
      label: "parenting",
      signals: ["impatient with my children", "my children", "my child", "parenting", "children", "kids", "father", "mother"],
      weights: { "impatient with my children": 9, "my children": 6, "my child": 6, parenting: 6, children: 3, kids: 3 },
      intentions: [
        { id: "impatient", when: ["impatient", "angry", "frustrated", "yell", "provoke"], heading: "Patience and gentleness with children", intro: "Scripture speaks to parents who are sharp with their children: do not provoke them, and grow patience and gentleness. Training a child is a long work, not a promise that a method will control them." },
        { id: "parenting", when: [], heading: "Parents and children", intro: "These passages treat children as a gift and tell parents to nurture them without provoking them. They instruct the parent more than they promise a particular outcome in the child." },
      ],
    },
    forgiveness: {
      label: "forgiveness",
      signals: ["can't forgive", "cannot forgive", "won't forgive", "forgive them", "forgive him", "forgive her", "forgiveness", "forgive", "reconcile", "resentment"],
      weights: { "can't forgive": 8, "cannot forgive": 8, "forgive them": 7, "forgive him": 7, "forgive her": 7, forgiveness: 6, forgive: 6, resentment: 4, reconcile: 4 },
      intentions: [
        { id: "forgive", when: [], heading: "Forgiveness and reconciliation", intro: "These passages command forgiveness and tie it to the mercy God has shown. They do not say that trust is restored in the same moment, or that the harm did not matter." },
      ],
    },
    loneliness: {
      label: "loneliness",
      signals: ["feel alone", "all alone", "lonely", "loneliness", "abandoned", "no one", "by myself"],
      weights: { "feel alone": 7, "all alone": 7, lonely: 6, loneliness: 6, abandoned: 5, "no one": 3, "by myself": 4 },
      intentions: [
        { id: "alone", when: [], heading: "God’s presence when you feel alone", intro: "Loneliness is answered here by promises that God does not leave his people. That is presence, not a promise that human friendship will arrive on a schedule." },
      ],
    },
    grief: {
      label: "grief",
      signals: ["grieving", "grief", "mourning", "bereaved", "died", "death of", "loss of", "lost someone"],
      weights: { grieving: 7, grief: 6, mourning: 6, bereaved: 6, died: 4, "lost someone": 7 },
      intentions: [
        { id: "grief", when: [], heading: "Comfort in grief", intro: "These passages promise that God is near the brokenhearted, and one of them looks ahead to a day when mourning ends. They do not tell you to stop grieving." },
      ],
    },
    temptation: {
      label: "temptation",
      signals: ["temptation", "tempted", "giving in", "keep sinning", "fall into sin"],
      weights: { temptation: 7, tempted: 6, "giving in": 6, "keep sinning": 5 },
      intentions: [
        { id: "temptation", when: [], heading: "Help in temptation", intro: "Scripture says temptation is common, that God gives a way to endure it, and that Christ helps those who are tempted. The promise is help and a way through, not a life with no desire." },
      ],
    },
    addiction: {
      label: "addiction",
      signals: ["addiction", "addicted", "enslaved", "can't stop", "cannot stop", "free from"],
      weights: { addiction: 8, addicted: 7, enslaved: 5, "can't stop": 5, "cannot stop": 5, "free from": 4 },
      intentions: [
        { id: "addiction", when: [], heading: "Freedom from what enslaves", intro: "These passages speak about sin’s mastery and about the Son setting people free, including people who have failed again. They promise a broken dominion, not an easy overnight change." },
      ],
    },
    purpose: {
      label: "purpose",
      signals: ["my purpose", "purpose", "calling", "why am i here", "what am i here"],
      weights: { "my purpose": 8, purpose: 6, calling: 4, "why am i here": 7 },
      intentions: [
        { id: "purpose", when: [], heading: "Purpose and God’s work", intro: "Purpose in these passages is God’s workmanship and his plans, including words first spoken to exiles. They are not a ranking of careers or a promise that every personal ambition is God’s plan." },
      ],
    },
    faith: {
      label: "faith",
      signals: ["have faith", "my faith", "struggling to believe", "struggling to have faith", "little faith", "faith"],
      weights: { "struggling to have faith": 8, "struggling to believe": 8, "have faith": 5, "my faith": 5, "little faith": 6, faith: 3 },
      intentions: [
        { id: "faith", when: [], heading: "Faith when it feels thin", intro: "Faith here is trust in what is still unseen, and God’s faithfulness when ours wavers. A weak faith can be brought to him; these passages do not demand a feeling of certainty first." },
      ],
    },
    doubt: {
      label: "doubt",
      signals: ["doubts", "doubt", "unbelief", "not sure god", "hard to believe"],
      weights: { doubts: 7, doubt: 6, unbelief: 7, "hard to believe": 6 },
      intentions: [
        { id: "doubt", when: [], heading: "Doubt brought to God", intro: "Scripture includes a prayer that admits unbelief and asks for help, and it says Christ stays faithful when we are not. Doubt is not treated as something you must solve before you pray." },
      ],
    },
    gratitude: {
      label: "gratitude",
      signals: ["grateful", "gratitude", "thankful", "thanksgiving", "give thanks"],
      weights: { grateful: 6, gratitude: 6, thankful: 6, thanksgiving: 5, "give thanks": 6 },
      intentions: [
        { id: "thanks", when: [], heading: "Thanksgiving", intro: "These passages call for thanks in every circumstance and for remembering what God has done. Joy is in the Lord; it is not a demand to call painful things good." },
      ],
    },
    health: {
      label: "health",
      signals: ["i am sick", "i'm sick", "illness", "disease", "healing", "diagnosed", "sick", "cancer", "health"],
      weights: { "i am sick": 8, "i'm sick": 8, illness: 6, disease: 5, healing: 4, diagnosed: 5, sick: 5, cancer: 5, health: 3 },
      intentions: [
        { id: "sick", when: [], heading: "Prayer and care in illness", intro: "James tells the sick to ask for prayer. Other passages praise God as healer or pray for a friend’s health. None of them is a promise that every illness will end, and Isaiah 53 is about the servant bearing sin, which is easy to misread as a guarantee of physical healing." },
      ],
    },
    hardship: {
      label: "hardship",
      signals: ["hard time", "hard times", "difficult", "suffering", "going through", "afflicted", "overwhelmed by life"],
      weights: { "hard time": 7, "hard times": 7, difficult: 4, suffering: 5, afflicted: 5, "going through": 3 },
      intentions: [
        { id: "hard", when: [], heading: "Help in a hard season", intro: "These passages promise God’s nearness and that he works for good according to his purpose. They do not call the hardship itself good, and they do not promise it will be short." },
      ],
    },
    guidance: {
      label: "guidance",
      signals: ["guidance", "a decision", "decide", "which way", "direction", "discern", "wisdom for", "don't know what to do", "do not know what to do"],
      weights: { guidance: 6, "a decision": 7, decide: 4, direction: 4, discern: 5, "which way": 5, "don't know what to do": 7, "do not know what to do": 7 },
      intentions: [
        { id: "decision", when: [], heading: "Wisdom and decision-making", intro: "These passages tell you to trust the Lord rather than your own understanding, and to ask him for wisdom. They promise guidance. They do not hand you the decision already made." },
      ],
    },
  };

  global.GodsPromisesDiscoveryData = {
    SUPPLEMENTS: SUPPLEMENTS,
    LINKS: LINKS,
    CONCEPTS: CONCEPTS,
  };
})(typeof window !== "undefined" ? window : globalThis);
