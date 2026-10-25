# Explanations

`data/explanations.json` maps each promise id to one short explanation (about 20–40 words) written in original modern English. It replaces the earlier Matthew Henry excerpts and "More" notes.

Every explanation was written by hand for its own passage, after reading public-domain commentary on that verse: Barnes' Notes first, Matthew Henry's Concise Commentary second, and Gill's Exposition or Ellicott's Commentary where Barnes had no verse-level note. No modern copyrighted commentary was used, and no commentary text is quoted.

Opening convention:

- A promise God or Jesus makes to anyone who meets its terms opens "God promises…" or "Jesus promises…".
- A promise made to a particular person or group says who it was for, e.g. "God promised Israel…". Where it fits, it then adds what still applies today.
- Anything else names the speaker and what they are doing, e.g. "David asks God…", "Paul explains…" or "This proverb teaches…". Proverbs are presented as principles, not guarantees.

`sources.json` records, for each id: genre, speaker, audience, the commentaries consulted, the verses they cover, and a fit label. The source matching was automated against cached BibleHub and CrossWire SWORD pages.

- **direct**: a verse-level note exists for the passage.
- **passage-context**: only a section or chapter note exists.
- **insufficient**: no note was found.

Barnes has no Old Testament volume outside Job, Psalms, Isaiah and Daniel. Those other books are labelled "Barnes' Notes (BibleHub compiled OT edition)".
