#!/usr/bin/env python3
"""v6: comforting beginner-clear rewrites for all promises. No formulaic prefixes."""
from __future__ import annotations
import json, re
from pathlib import Path

WORK = Path(__file__).resolve().parent
SOURCE = json.loads((WORK / "source.json").read_text(encoding="utf-8"))

def soft(s: str) -> str:
    reps = [
        (r"\bhumanity\b", "people"),
        (r"\bhumankind\b", "people"),
        (r"\bfruitfulness\b", "growth"),
        (r"\bdominion over\b", "care for"),
        (r"\biniquities\b", "sins"),
        (r"\biniquity\b", "sin"),
        (r"\btransgressions\b", "wrongs"),
        (r"\btransgression\b", "wrong"),
        (r"\bprecepts\b", "teachings"),
        (r"\bstatutes\b", "ways"),
        (r"\bordinances\b", "instructions"),
        (r"\bBehold,?\s*", ""),
        (r"\bYahweh(?:’s|'s)?\b", "God"),
        (r"\bransomed\b", "rescued"),
        (r"\bhis anointed\b", "his chosen one"),
        (r"\bthe anointed\b", "his chosen one"),
        (r"\bthe LORD’s\b", "God's"),
        (r"\bThe LORD’s\b", "God's"),
        (r"\bthe LORD\b", "the Lord"),
        (r"\bThe LORD\b", "the Lord"),
        (r"\bLORD\b", "Lord"),
        (r"\boffspring\b", "children"),
        (r"\bforevermore\b", "forever"),
        (r"\binward parts\b", "heart"),
        (r"\bloving kindness\b", "faithful love"),
        (r"\bLoving kindness\b", "Faithful love"),
        (r"\ba covenant\b", "a lasting promise"),
        (r"\bmy covenant\b", "my lasting promise"),
        (r"\bhis covenant\b", "his lasting promise"),
        (r"\bthe covenant\b", "the lasting promise"),
        (r"\bCovenant\b", "Lasting promise"),
        (r"\bcovenant\b", "lasting promise"),
    ]
    out = s
    for pat, repl in reps:
        out = re.sub(pat, repl, out)
    out = re.sub(r"\s{2,}", " ", out)
    out = re.sub(r"\s+([,.;:!?])", r"\1", out)
    return out.strip()

def period(s: str) -> str:
    s = s.strip()
    return s if not s or s[-1] in ".!?" else s + "."

def strip_q(s: str) -> str:
    return s.strip().strip("“”\"'")

def limit_len(s: str, max_chars: int = 320) -> str:
    parts = re.split(r"(?<=[.!?])\s+", s.strip())
    if len(parts) > 3:
        s = " ".join(parts[:3])
    if len(s) > max_chars:
        parts = re.split(r"(?<=[.!?])\s+", s)
        s = " ".join(parts[:2]) if len(parts) >= 2 else s[: max_chars - 3].rsplit(" ", 1)[0] + "."
    return s.strip()

# Famous / awkward / listy hand rewrites (promise, optional context)
HAND: dict[str, tuple[str, str | None]] = {
    "gen-1-28": ("God blesses people and gives them a good place in his world—to grow, care for creation, and live under his kindness.", "Spoken at creation, after God made people in his image."),
    "gen-1-29": ("God promises to provide what people need. He gives plants and fruit from the earth as food.", "God’s kind provision in the world he made."),
    "gen-3-15": ("God promises that evil will not win forever. One day the woman’s child will crush the serpent’s head—even though it will cost him pain.", "God’s words to the serpent after the fall in Eden."),
    "gen-8-21": ("God promises he will never again curse the ground as he did, or destroy every living thing the way he did in the flood.", "After the flood, when Noah offered worship to God."),
    "gen-8-22": ("God promises that as long as the earth remains, seasons, day, and night will keep going. You can trust the steady rhythms he made.", "God’s quiet decision after the flood to keep the world stable for life."),
    "gen-9-9-11": ("God makes a lasting promise to Noah, his family, and every living creature: never again will a flood wipe out all life on the earth.", None),
    "gen-9-12-16": ("God gives the rainbow as a sign of his promise. When he sees it, he remembers his word—never again will a flood destroy all life.", None),
    "gen-12-2-3": ("God promises to bless Abram, make him into a great people, and bring blessing to all families on earth through him.", "God calls Abram to leave home for a land God will show him."),
    "gen-15-1": ("God tells Abram not to be afraid. He himself will be Abram’s shield and his very great reward.", None),
    "gen-16-10": ("God’s angel promises lonely Hagar that her children will become too many to count. She is not forgotten.", None),
    "gen-21-17-18": ("God hears the boy crying and tells Hagar not to be afraid. He promises to make Ishmael a great nation.", None),
    "gen-26-24": ("God tells Isaac not to be afraid. He is with him, will bless him, and will multiply his children for Abraham’s sake.", None),
    "gen-28-13-15": ("God promises Jacob the land and countless children, blessing for all families through him, and his own presence—to watch over him, bring him home, and keep every word.", None),
    "gen-46-3-4": ("God tells Jacob not to be afraid to go to Egypt. He will make him a great nation there, go with him, and bring him home again.", None),
    "exo-3-12": ("God promises Moses, “I will certainly be with you.” His presence is the sign that God has sent him.", None),
    "exo-3-14": ("God tells Moses his name: “I AM WHO I AM.” He is the living God who sends help to his people.", None),
    "exo-4-12": ("God tells Moses to go, and promises to be with his mouth and teach him what to say.", None),
    "exo-6-2-8": ("God promises to free his people from slavery, take them as his own, and bring them into the land he swore to give them. He will be their God.", None),
    "exo-12-13": ("God promises that when he sees the blood, he will pass over that home. The plague of destruction will not touch them.", None),
    "exo-14-13-14": ("God tells his people not to be afraid. Stand still and see him save you—he will fight for you.", None),
    "exo-15-2": ("God is your strength and your song. He becomes your salvation—the God you can praise.", None),
    "exo-15-26": ("God promises that when his people listen and walk in his ways, he watches over them as the Lord who heals.", None),
    "exo-16-4": ("God promises to rain bread from heaven each day—enough for the day—so his people can learn to trust him.", None),
    "exo-19-4-6": ("God reminds Israel he carried them on eagles’ wings to himself. If they listen and keep his promise, they will be his treasured people—a kingdom of priests and a holy nation.", None),
    "exo-20-5-6": ("God is deeply serious about loyalty—and he shows faithful love to thousands of those who love him and keep his ways.", None),
    "exo-23-20-22": ("God promises to send an angel ahead to guard the way and bring his people to the place he prepared. When they listen, he stands against their enemies.", None),
    "exo-23-25-26": ("God promises to care for those who follow him—providing what they need and watching over their lives with his blessing.", None),
    "exo-29-45-46": ("God promises to live among his people and be their God. They will know he is the Lord who brought them out of Egypt.", None),
    "exo-33-14": ("God promises, “My presence will go with you, and I will give you rest.” You are not left to walk alone.", None),
    "exo-33-17": ("God tells Moses he will do what he asked—because Moses has found favor, and God knows him by name.", None),
    "exo-33-19": ("God promises to let all his goodness pass before Moses and to show mercy as he chooses. His goodness is real and free.", None),
    "exo-34-6-7": ("God shows who he is: merciful and gracious, slow to anger, full of faithful love and truth. He forgives sin—and he is also just.", None),
    "exo-34-10": ("God makes a lasting promise: before his people he will do wonders never seen before on the earth.", None),
    "lev-26-3-6": ("God promises that when his people walk in his ways, he gives rain, harvest, and peace. They can lie down without fear.", None),
    "lev-26-9-12": ("God promises to look on his people with favor, make them fruitful, and keep his lasting promise. He will live among them and be their God.", None),
    "lev-26-13": ("God reminds his people: he brought them out of Egypt so they would not be slaves. He broke their yoke and made them walk upright.", None),
    "lev-26-40-42": ("If people confess their sin and humble their hearts, God promises to remember his lasting promise with Abraham, Isaac, and Jacob—and remember the land.", None),
    "lev-26-44-45": ("Even in an enemy’s land, God will not reject his people to destroy them or break his lasting promise. He is still the Lord who remembers.", None),
    "num-6-24-26": ("God promises his blessing over you: he will keep you, look on you with kindness, and give you peace.", None),
    "num-14-20-21": ("God says he has pardoned as Moses asked. And as surely as he lives, the whole earth will be filled with his glory.", None),
    "num-21-8-9": ("God provides a way to live: anyone bitten who looks at the bronze serpent on the pole will live.", None),
    "num-23-19-20": ("God is not like people who break their word. What he has said, he will do. You can trust his promise.", None),
    "num-24-17": ("God promises a coming ruler: a star out of Jacob, a scepter rising out of Israel—not yet, but surely.", None),
    "deu-1-29-31": ("Do not be terrified. God goes before you and will fight for you—just as he did in Egypt and in the wilderness, carrying you like a father carries his child.", None),
    "deu-4-29-31": ("If you seek God with all your heart and soul, you will find him. He is merciful—he will not fail you, destroy you, or forget his lasting promise.", None),
    "deu-7-9": ("Know that the Lord your God is God—the faithful God who keeps his lasting promise and faithful love for a thousand generations of those who love him.", None),
    "deu-20-1-4": ("When you face a bigger army, do not be afraid. God is with you. He goes with you to fight for you and to save you.", None),
    "deu-31-6": ("Be strong and courageous. Do not be afraid—God goes with you. He will not fail you or leave you.", None),
    "deu-31-8": ("God himself goes before you. He will be with you. He will not fail you or leave you. Do not be afraid or discouraged.", None),
    "deu-32-36": ("God will judge his people and have compassion on his servants when he sees their strength is gone.", None),
    "deu-32-39": ("God alone is God. He is the one who wounds and heals, who puts to death and makes alive. No one can deliver from his hand.", None),
    "deu-33-12": ("The beloved of the Lord will live in safety beside him. God covers him all day long and carries him close.", None),
    "deu-33-26-27": ("There is no one like God, who comes to help you. The eternal God is your home, and underneath you are his everlasting arms.", None),
    "jos-1-3-5": ("God promises every place Joshua’s foot treads. No one will be able to stand against him. As God was with Moses, so he will be with Joshua—he will not fail or leave him.", None),
    "jos-1-8-9": ("God tells Joshua to be strong and courageous. Do not be afraid—the Lord your God is with you wherever you go.", None),
    "psa-18-1-3": ("God promises to be your safe place. When you call on him, he is like a strong rock and shield who protects and rescues you.", "David’s song after God rescued him from Saul."),
    "psa-23-1-4": ("God is your shepherd—you lack nothing. He leads you to rest and peace, restores your soul, and walks with you even through the darkest valley.", None),
    "psa-46-1-3": ("God is your refuge and strength, a very present help in trouble. Even if the earth shakes, you can find safety in him.", None),
    "isa-41-8-10": ("God says, “Don’t be afraid, for I am with you.” He will strengthen you, help you, and hold you up with his righteous hand.", None),
    "isa-43-18-19": ("God says not to cling only to the past. He is doing something new—even making a way in the wilderness and rivers in the desert.", None),
    "isa-49-8-10": ("God answers in a time of favor and keeps his people. He guides them to springs of water. They will not hunger or thirst, and the heat will not strike them.", None),
    "isa-51-12": ("God himself promises to comfort you. You do not need to live in fear of people who are only passing away.", None),
    "jer-29-10-11": ("God promises to keep his good word and bring his people home. He has plans for their welfare—plans for hope and a future, not for harm.", None),
    "jer-29-12-14": ("God promises that when you call and pray, he will listen. When you seek him with all your heart, you will find him—and he will bring you back from captivity.", None),
    "jer-31-31-34": ("God promises a new lasting promise: he will write his ways on people’s hearts, be their God, and forgive their sin—remembering it no more.", None),
    "jer-32-37-41": ("God promises to gather his people, let them live in safety, give them one heart to fear him, and make an everlasting promise to do them good.", None),
    "jer-39-17-18": ("God promises to rescue you in the day of trouble. You will not be handed over to those you fear. Because you trust him, your life will be spared as a prize.", None),
    "ezk-36-9-11": ("God is for you. He promises to turn toward you again, make the land fruitful, multiply people, and do good to you as in earlier days.", None),
    "ezk-36-26-28": ("God promises a new heart and a new spirit. He will remove the hard heart of stone, give a heart of flesh, put his Spirit in you, and be your God.", None),
    "ezk-37-12-14": ("God promises to open the graves of his people, bring them home, and put his Spirit in them so they will live—and know that he is the Lord.", None),
    "hos-6-1-3": ("Come, let’s return to the Lord. He has torn, but he will heal. He will bind us up, restore us, and come to us like the spring rains.", None),
    "zep-3-16-17": ("Do not be afraid. The Lord your God is in your midst—a mighty one who saves. He will rejoice over you with joy and quiet you with his love.", None),
    "zep-3-19-20": ("God promises to deal with oppressors, save the lame, gather the outcast, and change shame into praise. He will bring you home and restore your fortunes.", None),
    "mat-10-28-31": ("Do not fear people who can only harm the body. You are precious to your Father—more than many sparrows. Even the hairs of your head are all counted.", None),
    "mat-11-28-30": ("Jesus invites you to come to him when you are tired and weighed down. He promises rest for your soul. His way is gentle, and his burden is light.", None),
    "mat-28-18-20": ("Jesus has all authority in heaven and on earth. He sends his followers to make disciples—and promises, “I am with you always, to the end of the age.”", None),
    "luk-1-30-33": ("The angel tells Mary not to be afraid—she has found favor with God. She will bear a son, Jesus, who will reign forever on David’s throne.", None),
    "luk-2-10-11": ("Do not be afraid—this is good news of great joy for all people. A Savior has been born: Christ the Lord.", None),
    "jhn-3-16-17": ("God loved the world so much that he gave his one and only Son, so that everyone who believes in him will not be lost but have eternal life.", None),
    "jhn-14-27": ("Jesus gives you his peace—not like the world’s peace. Do not let your heart be troubled or afraid.", None),
    "act-2-21": ("God promises that everyone who calls on the name of the Lord will be saved.", None),
    "rom-8-28": ("God promises that he works all things together for good for those who love him and are called according to his purpose.", None),
    "rom-8-38-39": ("Nothing can separate you from God’s love in Christ Jesus—not death, life, angels, powers, or anything else in all creation.", None),
    "2co-1-3-4": ("God is the Father of mercies and God of all comfort. He comforts you in every trouble so you can comfort others.", None),
    "2co-4-7-9": ("We carry God’s treasure in fragile jars of clay, so the power is clearly his. We may be pressed and confused, but we are not crushed, forsaken, or destroyed.", None),
    "gal-4-4-7": ("When the time was right, God sent his Son so we could be adopted as his children. You are no longer a slave but a child—and if a child, then an heir through God.", None),
    "eph-1-3-6": ("God has blessed us in Christ with every spiritual blessing. In love he chose us to be holy and adopted us as his children, to the praise of his glorious grace.", None),
    "eph-2-4-7": ("But God, rich in mercy and great in love, made us alive with Christ even when we were dead in sins. By grace you have been saved—and he shows the riches of his kindness forever.", None),
    "eph-3-16-19": ("God strengthens you with power through his Spirit in your inner person, so Christ may live in your heart by faith—and you may know his love that surpasses knowledge.", None),
    "php-4-6-7": ("God invites you not to stay stuck in worry. Bring everything to him in prayer with thanks—and his peace will guard your heart and mind in Christ Jesus.", None),
    "php-4-19": ("God promises to supply every need of yours according to his riches in glory in Christ Jesus.", None),
    "2ti-1-9-10": ("God saved us and called us with a holy calling—not because of our works, but because of his own purpose and grace given in Christ Jesus.", None),
    "2ti-3-15-17": ("The holy Scriptures can make you wise for salvation through faith in Christ Jesus. All Scripture is God-breathed and useful—so you may be complete and equipped for every good work.", None),
    "tit-2-11-14": ("God’s grace has appeared, bringing salvation for all people. It trains us to live upright lives while we wait for our great God and Savior Jesus Christ, who gave himself to redeem us.", None),
    "tit-3-4-7": ("When God’s kindness and love appeared, he saved us—not by our works of righteousness, but by his mercy—through the washing of new birth and renewal by the Holy Spirit.", None),
    "phm-1-4-7": ("Paul thanks God for Philemon’s love and faith. The hearts of the saints have been refreshed through him—a picture of how love builds up God’s people.", None),
    "heb-2-14-15": ("Jesus shared our flesh and blood so that through death he might break the power of the devil and free those who lived in fear of death.", None),
    "heb-6-17-19": ("God wanted the heirs of the promise to be sure, so he confirmed it with an oath. We have this hope as a strong and steady anchor for the soul.", None),
    "heb-10-19-22": ("Because of Jesus’ blood, we have boldness to enter God’s holy presence. So draw near with a true heart, in full assurance of faith.", None),
    "heb-12-1-2": ("Surrounded by so many witnesses, let us run with endurance the race set before us, looking to Jesus—the one who begins and finishes our faith.", None),
    "heb-13-5-6": ("God promises, “I will never leave you or forsake you.” So you can say with confidence that the Lord is your helper.", None),
    "heb-13-20-21": ("The God of peace, who raised the great Shepherd Jesus, will equip you with everything good to do his will—working in you what pleases him.", None),
    "1pe-5-6-7": ("God cares for you. Humble yourself under his hand, and cast all your worries on him—he holds you.", None),
    "1jn-1-8-9": ("If we confess our sins, God is faithful and just to forgive us and to cleanse us from all wrong.", None),
    "rev-21-3-4": ("God promises to live with his people. He will wipe away every tear. Death, pain, and crying will be gone forever.", None),
    "rev-22-17": ("The Spirit and the church say, “Come!” If you are thirsty, come. God offers the water of life freely to anyone who wants it.", None),
}

CTX_STUBS = {
    "Torah sweetness.": "A song about how good God’s teaching is.",
    "Royal prayer before battle.": "A prayer asking God for help before a battle.",
    "Reflection on God’s character.": "A quiet thought about who God is.",
    "Name character.": "God tells Moses what he is like.",
    "Gospel announcement.": "Good news is announced.",
    "Watchmen’s joy.": "Joy for those watching for God’s help.",
    "Enduring salvation.": "God’s rescue lasts.",
    "Echo of ch. 35.": "A hopeful promise repeated.",
    "Divine comforter vs human fear.": "God comforts people who fear other people.",
    "Ascension commission.": "Jesus’ words before he returned to heaven.",
    "Pentecost / Joel.": "Peter explains the Spirit’s coming with Joel’s words.",
    "Call and be saved.": "Anyone who calls on the Lord can be saved.",
    "Forgiveness, Spirit, far off.": "Forgiveness and the Spirit are offered widely.",
    "Refreshing and restoration.": "Turning back to God brings refreshment.",
    "Coming quickly with reward.": "Jesus is coming, and he brings reward.",
    "Right to tree of life; enter city.": "A welcome into God’s city and life.",
    "Root of David; Bright Morning Star.": "Jesus names who he is.",
    "Come; take water of life freely.": "An open invitation to come to God.",
    "I am coming quickly.": "Jesus promises he is coming soon.",
    "Covenant blessings.": "Blessings promised when people walk with God.",
    "God walks among.": "God promises to be close to his people.",
    "Broken yoke.": "God frees his people from slavery.",
    "Confession and remembered covenant.": "When people turn back, God remembers his promise.",
    "Covenant not broken in exile.": "Even in hard places, God will not abandon his promise.",
    "Aaronic blessing.": "The priestly blessing God gave for his people.",
    "Guidance to rest.": "God leads his people toward rest.",
    "Pardon granted.": "God forgives in answer to prayer.",
    "Bronze serpent (Jesus cites).": "God provides a way to live—later pointed to by Jesus.",
    "Balaam’s oracle on God’s fidelity.": "Even Balaam must say God keeps his word.",
    "Nearness in prayer.": "God is near when his people call.",
    "Exile hope preview.": "Hope for people far from home.",
    "Decalogue mercy line.": "In the Ten Commandments, God also speaks of mercy.",
    "God’s yearning for their good.": "God longs for his people’s good.",
    "Wilderness provision summary.": "Looking back on God’s care in the wilderness.",
    "Moses recounts Kadesh failure.": "Moses reminds the people how God fought for them.",
    "Star and scepter.": "A promise of a coming ruler.",
    "Blessing vision.": "A vision of blessing for God’s people.",
    "Presence and kingship.": "God is with his people as their King.",
    "Goodness proclaimed.": "God shows his goodness and mercy.",
    "Favor and known by name.": "God knows his servant by name.",
    "Shema.": "Israel’s core call to love the one true God.",
    "Chosen in love.": "God chose his people because he loves them.",
    "Faithful covenant keeper.": "God is faithful to keep his promises.",
    "Blessing cascade.": "Blessings that flow from walking with God.",
    "Health blessing.": "God’s care for his people’s well-being.",
    "Remembered care.": "A reminder of how God cared in hard places.",
    "Good land description.": "God brings his people into a good land.",
    "Good at the end.": "God’s hard path was meant for their good in the end.",
    "God goes before.": "God goes ahead of his people.",
    "Requirement for good.": "What God asks is for his people’s good.",
    "Justice and love for stranger.": "God loves justice and cares for outsiders.",
    "Land under God’s eye.": "God watches over the land with care.",
    "Word in heart; long days.": "Keeping God’s words close brings lasting life.",
    "Binary choice.": "God sets a clear choice before his people.",
    "Rest ahead.": "God promises rest still ahead.",
    "Blessing and generosity.": "God’s blessing frees his people to be generous.",
    "Prophet like Moses.": "God promises to raise up a prophet like Moses.",
    "War presence.": "God is with his people even in battle.",
    "Curse to blessing.": "God turns a curse into a blessing because he loves.",
    "God walks in camp.": "God is present among his people to save them.",
    "New covenant promise.": "God promises a new, heart-deep relationship.",
    "Sins remembered no more.": "God promises to forget sins he has forgiven.",
    "Pillar; God’s name written.": "A lasting place with God, marked by his name.",
}


def rewrite_context(c: str | None) -> str:
    c = (c or "").strip()
    if not c:
        return c
    if c in CTX_STUBS:
        return CTX_STUBS[c]
    c2 = soft(c)
    if c2 in CTX_STUBS:
        return CTX_STUBS[c2]
    if len(c2) > 155:
        c2 = c2.split(".")[0].strip() + "."
    return period(c2)


def has_i_speech(s: str) -> bool:
    return bool(
        re.search(
            r"\bI will\b|\bI am\b|\bI’ll\b|\bI have\b|\bI’m\b|\bI send\b|\bI bore\b|"
            r"\bI make\b|\bI set\b|\bI give\b|\bI put\b|\bI see\b|\bwhen I see\b|"
            r"\bI answer\b|\bI answered\b|\bMy presence\b",
            s,
        )
    )


def convert_i_speech(s: str) -> str:
    raw = strip_q(s)
    if re.match(r"^I(?:['’]ll| will)\b", raw, re.I):
        rest = soft(re.sub(r"^I(?:['’]ll| will)\b\s*", "", raw, flags=re.I))
        return period(f"God says he will {rest}")
    if re.match(r"^I am\b", raw, re.I):
        rest = soft(re.sub(r"^I am\b\s*", "", raw, flags=re.I))
        if re.search(r"\bwith you\b", rest, re.I):
            return period(f"God promises to be {rest}. You are not alone")
        return period(f"God says he is {rest}")
    if re.match(r"^My presence will go with you", raw, re.I):
        return "God promises, “My presence will go with you, and I will give you rest.” You are not left to walk alone."

    body = soft(raw)
    # Careful replacements — avoid breaking intentional quotes later
    body = re.sub(r"\bI will\b", "he will", body)
    body = re.sub(r"\bI’ll\b", "he will", body)
    body = re.sub(r"\bI am\b", "he is", body)
    body = re.sub(r"\bI’m\b", "he is", body)
    body = re.sub(r"\bI have\b", "he has", body)
    body = re.sub(r"\bI’ve\b", "he has", body)
    body = re.sub(r"\bI send\b", "he sends", body)
    body = re.sub(r"\bI bore\b", "he carried", body)
    body = re.sub(r"\bI make\b", "he makes", body)
    body = re.sub(r"\bI set\b", "he sets", body)
    body = re.sub(r"\bI give\b", "he gives", body)
    body = re.sub(r"\bI put\b", "he puts", body)
    body = re.sub(r"\bI see\b", "he sees", body)
    body = re.sub(r"\bwhen I see\b", "when he sees", body)
    body = re.sub(r"\bI answered\b", "he answered", body)
    body = re.sub(r"\bI answer\b", "he answers", body)
    # only replace possessive my when it looks divine in these converted lines
    body = re.sub(r"\bmy (lasting promise|Spirit|people|name|face|servant|angel|glory|law|ways)\b", r"his \1", body, flags=re.I)

    if re.match(r"^(God |Jesus |Here |The Lord )", body):
        return period(body)
    # Frame conditional / imperative openings gently
    if re.match(r"^(If |When |Don’t |Do not |Honor |Remember |Serve |Come |Blessed |Whoever |From |These |Know |Hear |Love |Be |Oh |At |In )", body, re.I):
        return period(f"God promises that {body[0].lower() + body[1:]}")
    return period(f"God promises that {body[0].lower() + body[1:]}")


def rewrite_promise(before: str, pid: str) -> str:
    if pid in HAND:
        return HAND[pid][0]
    s = before.strip()

    if re.match(r"^(The LORD|The Lord|God) is\b", s) and s.count(",") >= 2:
        return (
            "God promises to be your safe place. When you call on him, "
            "he is like a strong rock and shield who protects and rescues you."
        )
    if re.match(r"^(The LORD|The Lord) bless you", s):
        return HAND["num-6-24-26"][0]
    if re.match(r"^Come to me,", s, re.I):
        return HAND["mat-11-28-30"][0]
    if re.match(r"^Serve (the LORD|the Lord|God)\b", s, re.I):
        return HAND["exo-23-25-26"][0]
    if re.match(r"^We know that all things work together", s, re.I):
        return HAND["rom-8-28"][0]
    if re.match(r"^In nothing be anxious", s, re.I):
        return HAND["php-4-6-7"][0]
    if re.match(r"^Don’t be afraid, for I am with you", s, re.I) or re.match(r"^Don’t be afraid, for I am with you", soft(s), re.I):
        return HAND["isa-41-8-10"][0]

    if has_i_speech(s) or re.match(r'^[“"]?I\b', s):
        return limit_len(convert_i_speech(s))

    if re.match(r"^Don’t be (terrified|afraid|scared|dismayed)", s, re.I):
        body = soft(s)
        return period(f"God’s word to anxious hearts: {body[0].lower() + body[1:]}")

    if re.match(r"^(Whoever|Everyone who|Anyone who|He who)\b", s):
        body = soft(re.sub(r"^He who\b", "Anyone who", s))
        return period(f"God promises that {body[0].lower() + body[1:]}")

    if re.match(r"^Blessed are\b", s, re.I):
        return period(f"God promises a real blessing: {soft(s[0].lower() + s[1:])}")

    s2 = soft(s)
    s2 = re.sub(r"^God commits\b", "God promises", s2)
    s2 = re.sub(r"^God establishes a lasting promise\b", "God makes a lasting promise", s2)
    s2 = re.sub(r"^God establishes\b", "God sets in place", s2)
    s2 = re.sub(r"^God foretells\b", "God tells ahead of time about", s2)
    s2 = re.sub(r"^God renames\b", "God gives a new name to", s2)
    s2 = re.sub(r"^God swears to\b", "God seriously promises to", s2)
    s2 = re.sub(r"^God swears\b", "God makes a serious promise", s2)
    s2 = re.sub(r"^God pledges\b", "God promises", s2)
    s2 = re.sub(r"^God decrees\b", "God promises", s2)
    s2 = re.sub(r"^God covenants to\b", "God promises to", s2)
    s2 = re.sub(
        r"^As long as the earth remains, God will\b",
        "God promises that as long as the earth remains, he will",
        s2,
    )
    if re.match(r"^The Lord\b", s2) and re.search(r"\byou\b", s2, re.I):
        s2 = "God" + s2[8:]
    return period(limit_len(s2))


def main():
    rewrites = {}
    changed = 0
    for e in SOURCE:
        pid = e["id"]
        before = e["promise"]
        if pid in HAND:
            pr, cx_override = HAND[pid]
            cx = cx_override if cx_override is not None else rewrite_context(e.get("context"))
        else:
            pr = rewrite_promise(before, pid)
            cx = rewrite_context(e.get("context"))
        pr = pr.replace("lasting promise promise", "lasting promise")
        pr = re.sub(r"\s{2,}", " ", pr).strip()
        pr = limit_len(pr)
        if pr != before:
            changed += 1
        rewrites[pid] = {
            "promise": pr,
            "context": cx,
            "_before_promise": before,
            "_before_context": e.get("context") or "",
        }

    (WORK / "rewrites.json").write_text(
        json.dumps(rewrites, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # QA
    bad_prefix = sum(
        1
        for v in rewrites.values()
        if v["promise"].startswith("Here God assures you")
        or v["promise"].startswith("God’s promise brings comfort")
    )
    still_i = [
        pid
        for pid, v in rewrites.items()
        if re.match(r'^[“"]?I\b', v["promise"])
        and "God promises," not in v["promise"]
        and "God says" not in v["promise"]
    ]
    stiff = [
        pid
        for pid, v in rewrites.items()
        if any(w in v["promise"].lower() for w in ("iniquity", "dominion over", "fruitfulness", "behold,"))
    ]
    long = [pid for pid, v in rewrites.items() if len(v["promise"]) > 320]
    print(
        json.dumps(
            {
                "total": len(rewrites),
                "changed": changed,
                "hand": len(HAND),
                "bad_prefix": bad_prefix,
                "still_i": len(still_i),
                "still_i_sample": still_i[:10],
                "stiff": stiff,
                "long": long[:15],
                "long_count": len(long),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
