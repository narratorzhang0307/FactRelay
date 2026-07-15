# Signals dated editions

Signals is a date-bounded discovery layer, not a truth oracle. A topic Agent scans public news sources, deterministic Skills constrain the date window and remove duplicates, and GonkaRouter ranks up to five consequential candidates. Each candidate is still an unverified claim until the user sends it through FactRelay.

## Why dated snapshots exist

A cold news scan may spend tens of seconds on upstream retrieval and inference. Repeating that work for every topic switch creates avoidable latency and can produce slightly different editions for the same date. A validated snapshot makes a completed daily edition reproducible:

1. generate all eight topic editions through the normal live path;
2. retain the original sources, bilingual claim text, Gonka request ID, model, and trace;
3. reject incomplete or malformed editions;
4. compute a SHA-256 content hash for every topic file;
5. compile the eight editions into an immutable runtime module.

The runtime lookup order is:

```text
dated snapshot -> process memory -> live public scan + Gonka ranking
```

A snapshot hit returns `cacheHit: true` and `cacheLayer: "snapshot"`. A process-memory hit returns `cacheLayer: "memory"`; a newly generated edition returns `cacheLayer: "runtime"`.

## Snapshot contract

Every topic file must satisfy all of these checks before it can be compiled:

- `mode` is `live`;
- topic and selected UTC date match the requested edition;
- one to five signal cards are present;
- a Gonka request ID is present;
- the trace contains a completed `GonkaRouter` step;
- every card has English and Chinese headline, claim, and significance text;
- every card retains a public source URL.

The compiler adds snapshot metadata with the date, original generation time, signal count, and source-file hash. The API returns a fresh structured clone so one request cannot mutate later responses.

## Build or refresh a date

Collect the eight live JSON responses in one directory, named `ai.json`, `technology.json`, `finance.json`, `climate.json`, `science.json`, `health.json`, `culture.json`, and `policy.json`. Then run:

```bash
npm run signals:snapshot -- YYYY-MM-DD INPUT_DIR server/signal-snapshot.mjs
```

The command fails closed if any receipt, trace, bilingual field, source URL, topic, or date is missing. Run `npm run verify` after rebuilding the module.

## Client behavior

After the first snapshot response, the Signals UI quietly fetches the seven sibling topics for the same date into an in-browser memory map. Subsequent topic changes can therefore swap cards without hiding the current deck. A manual refresh keeps the visible cards on screen while the request is in flight.

The UI labels precomputed data `PRELOADED · 已预载`. It still displays the original Gonka receipt, source dates, and edition date. Importance remains a news-priority score and is never presented as a Truth Score.

## Current bundled edition

The repository bundles the UTC edition for `2026-07-15`: eight topic Agents and 37 bilingual cards. The snapshot is product data only; it contains no API keys or private user information.
