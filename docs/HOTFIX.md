# 2K Statle — Hotfix: mobile re-roll row + silhouette purge (frozen spec)

Executor: Claude Code. Frozen decisions; reconcile against current App.jsx.
`npm run build` must pass. Commit and push when both items are done.

## 1. Mobile roll card: re-roll buttons get their own row

Current state (broken): on mobile the re-roll buttons share row 2 with the
pos/height/weight pills and wrap — producing one stretched button next to the
pills and one full-width orphan underneath.

Fix (mobile layout only; desktop untouched):
- Row 2 = pills ONLY (pos · height · weight), no buttons, no flexWrap needed.
- Row 3 = the two re-roll buttons, and nothing else:
  `display: 'flex', gap: 8, marginTop: 8`, each button `flex: 1` with
  identical styling (fontSize 12, padding '7px 8px', content centered).
  Two equal halves, one line of text each, every time. No wrapping.
- When re-rolls aren't available (spinning, or buttons hidden in Daily mode),
  row 3 renders nothing — do not reserve empty space for it.
- Update the mobile .rollzone min-height in index.css to the new three-row
  natural height (~150px) so the sticky card never clips its own content and
  the empty/spinning/rolled states still don't shift the layout.

## 2. Silhouette purge (the "missing pics" root cause)

The NBA CDN serves a byte-identical gray placeholder silhouette (HTTP 200,
image/png) for player IDs with no digitized photo. fetch_headshots.py saved
those as real headshots, so hundreds of legends render as gray ghosts with a
team badge. scripts/prune_silhouettes.py (already written) detects them by
hash clustering and deletes them.

Run, in order, from the repo root:
1. `python3 scripts/prune_silhouettes.py --dry-run` — sanity-check the report:
   the placeholder cluster should be large (likely 150-400 files) and the
   sample names should be obscure legends, NOT current stars. If a cluster
   sample contains a current star, STOP and report instead of deleting.
2. `python3 scripts/prune_silhouettes.py`
3. `python3 scripts/build_pools.py` — pruned players lose their img field; the
   app's existing fallback renders their era team logo as the portrait.
4. Stage everything including deletions (`git add -A`), commit, push.
5. Report the script's printed numbers (placeholder count, real photos
   remaining) back to the user verbatim.

Also add one guard to scripts/fetch_headshots.py so this never recurs: after a
successful download, compare the new file's md5 against a module-level
PLACEHOLDER_MD5 constant — set it to the hash printed by prune_silhouettes.py
— and treat a match as a miss (reason "cdn_placeholder") instead of saving.

## 3. Recover current-player headshots via the live NBA player index

Root cause: nba_api's STATIC players list is frozen at package release time, so
2025-26 rookies and two-way players (most "current" rows in
data/headshot_misses.csv) are absent, and some names differ from NBA's records
("Ron Holland" is listed as "Ronald Holland II"). Their official headshots DO
exist on the same CDN.

In scripts/fetch_headshots.py:
1. First run `pip install -U nba_api` — a newer static list may resolve
   several misses on its own.
2. For current players STILL unmatched after static list + aliases: fetch the
   live index once via nba_api.stats.endpoints.commonallplayers (season
   "2025-26", is_only_current_season=1) and build a second lookup from it.
   Match by normalized full name first; if still unmatched, match by
   (normalized LAST name + team) and accept only when exactly one candidate
   remains — ties or zero stay misses. If stats.nba.com blocks the request,
   discover and use the public player-index JSON that nba.com/players loads
   from the NBA CDN instead.
3. Downloads from these recovered IDs must respect the PLACEHOLDER_MD5 guard
   from section 2 (a rookie ID can still serve the silhouette).
4. Re-run the fetch (existing files are skipped, so only misses download),
   then `python3 scripts/build_pools.py`, and include everything in the same
   commit as sections 1-2.

## Acceptance
- Mobile (390px): both re-roll buttons render as equal-width halves on their
  own row, one line of text each, pills row above them unaffected.
- Legends mode: photo-less legends show the big era team-logo portrait with no
  corner badge; NO gray silhouettes anywhere.
- Current-player rows in data/headshot_misses.csv shrink to true no-photo
  cases only; spot-check that Ron Holland, LJ Cryer, and Norchad Omier render
  real photos in Hard mode.
- Current-player pools unaffected except any current fringe players whose
  files were also placeholders (correct behavior).
