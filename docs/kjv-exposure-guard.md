# King James exposure guard

`scripts/check_kjv_exposure.py` fails the build when King James verse text is committed or copied into the public site output. It does not decide copyright. It stops a copy of the text from shipping by accident.

The fingerprint file `scripts/kjv_exposure_fingerprints.json` stores hashes only:

- SHA-256 of the pinned upstream download, of the normalized 31,102-verse index, and of the 1,188-passage file
- the git blob ids of those two committed files from the closed pull request that added them
- 16-hex SHA-256 prefixes of normalized verses and passages, after removing hashes that also match the World English Bible catalog

A file fails the check when any of these is true:

- its SHA-256 or git blob id is one of the known files
- three or more of its sentences or JSON strings match the distinctive verse hashes
- it contains 40 or more archaic tokens (`thou`, `thee`, `thy`, `thine`, `ye`, `hath`, `saith`, `unto`)
- a gzip, zip, or tar member, or a base64 blob inside the file, fails the same checks

Short citations, book names, and the World English Bible catalog stay under those lines. The guard passes on `main` and on this branch. It fails on a renamed copy, a gzip, a zip, a base64 file, and a JavaScript file that embeds the passage JSON. Those plants are made in a temporary directory and are not committed.

## Where it runs

- `.github/workflows/kjv-exposure.yml` on every pull request and every push
- the same command at the start of the other GitHub workflows
- the Vercel build, once on the git checkout and again on `dist` after the site is built

The generated file `api/_lib/kjv-spans.generated.json` is gitignored and is not part of `dist`. The second build step is what keeps it out of the public bundle. The serverless function may read it. A request for that file as a static URL must 404.

## Updating the rules

After a deliberate change to the pinned source, download that file locally, build the normalized index and the passage file in a temporary directory, and regenerate the hashes:

```bash
python3 scripts/check_kjv_exposure.py --generate /tmp/kjv_index.json /tmp/kjv-spans.json --exclude-root .
```

Review the diff of `scripts/kjv_exposure_fingerprints.json` and commit the hash file only. Do not commit the source download or the passage file. Do not lower `TOKEN_LIMIT` or `VERSE_HITS` to make a failing tree pass.
