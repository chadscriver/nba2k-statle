# NBA 2K Statle — ratings data pipeline

Scrapes the **full** current-NBA ratings detail from [2kratings.com](https://www.2kratings.com)
into `data/nba2k26.csv` / `.json`, and refreshes daily via GitHub Actions. The game
backend reads the stored files — it never scrapes at play time.

## What each player row contains (one wide row per player)

- **Identity**: `name`, `slug`, `team`, `pos` (e.g. `PG / SG`)
- **`overall`** — the 2K overall (the regression target)
- **Body, imperial**: `height` (`6'2"`), `height_in`, `weight_lbs`, `wingspan`, `wingspan_in`
- **6 category averages + Intangibles**: `Outside Scoring`, `Inside Scoring`, `Playmaking`, `Athleticism`, `Defense`, `Rebounding`, `Intangibles`
- **Every individual attribute** (~35 cols): `Three-Point Shot`, `Close Shot`, `Driving Dunk`, `Ball Handle`, `Interior Defense`, `Speed`, `Vertical`, … grouped by category
- **Every badge** (one `badge: <Name>` col each): value is the tier the player holds — `HOF`, `Gold`, `Silver`, `Bronze`, `Legend` — or `-` if they don't have it

Roughly 100+ columns once the full league fills in the badge set.

## Run it locally

```bash
pip install -r requirements.txt
python scraper.py                 # full league (~480 players, ~8-10 min)
MAX_TEAMS=2 python scraper.py     # quick test
```

Open `data/nba2k26.csv` in Excel/Sheets directly — no conversion needed.

## Classic teams, headshots, logos & player pools

The current-roster scrape above is one half of the pipeline. The other half adds
**classic teams**, downloads imagery, and generates the JSON pools the game loads.
All page fetching/parsing lives in **`twok.py`** (shared by `scraper.py` and the
classic scraper — one parser, no forks). Pages are cached under `.cache/2kratings/`
so every scrape is **resumable** and only sleeps politely (1.25s) on live requests.

```bash
python scripts/scrape_classic.py    # 1. classic teams  -> data/nba2k26_classic.csv
python scripts/fetch_headshots.py   # 2. player headshots -> app/public/headshots/
python scripts/fetch_logos.py       # 3. team logos       -> app/public/logos/ + teams.json
python scripts/build_pools.py       # 4. pools            -> app/src/pool*.json
```

| Script | What it does | Outputs |
|---|---|---|
| `twok.py` | Shared fetch (cached/resumable) + roster/player/logo parsing | — (imported) |
| `scripts/scrape_classic.py` | Scrapes every 2kratings **Classic Team** (excludes current & all-time). Same column schema as `nba2k26.csv` plus `classic_team, base_team, season, era_tag`; one row per team card (no dedupe across teams) | `data/nba2k26_classic.csv`, `data/classic_teams.json`, `data/badge_categories.json` |
| `scripts/fetch_headshots.py` | Maps every current **and** historic player to an NBA id (nba_api static list, incl. retired) and pulls `cdn.nba.com` headshots. One image per human (no era in slug), skips existing. Multiple-id names are **not guessed** | `app/public/headshots/*.png`, `data/headshot_ambiguous.csv`, `data/headshot_misses.csv` |
| `scripts/fetch_logos.py` | Downloads the **era-correct** logo from each team's own page (Sonics, teal Hornets, etc.), rasterizes SVG→PNG via `qlmanage`; CDN fallback for current teams | `app/public/logos/*.png`, `app/src/teams.json` |
| `scripts/build_pools.py` | Builds the three player pools from the CSVs + headshots on disk. Folds in the weight/wingspan merge (replaces the old `add_body_to_pool.py`). Self-checks every regenerated current player against the shipped `pool.json` and aborts on any field drift | `app/src/pool.json`, `app/src/pool_full.json`, `app/src/pool_legends.json` |
| `scripts/mine_dailies.py` | Mines Daily Gauntlet sets from the normal pool — 8-player sets whose optimal arrangement scores 99, ranked by the gap to the second-best (a "strict" set is one a single misplacement drops below 99). `--samples N` to widen the search (20–40 min default) | `app/src/dailies.json` |

**Pools** (exact entry shape `n, p, tm, o, hi, ht, ig, c, a, b, img, wt, ws`):
`pool.json` = current top-10-per-team; `pool_full.json` = all current; `pool_legends.json`
= all classic rows, with `n` era-tagged (`Michael Jordan ('96)`) and `tm` the full
classic label. `img` is set only when the headshot file actually exists on disk.

`app/src/teams.json` maps every team label used by the pools (current = abbreviation,
classic = full label) to `{ "logo": "logos/<file>", "season": <season|null> }`.

> Historic note: 2K lists some deep-bench classic players with no ratings (`--`), and a
> few share a name with other NBA players. Unrated players are skipped; ambiguous names
> are parked in `headshot_ambiguous.csv` for manual resolution rather than guessed.

## Game modes & client state

The app (`app/`) reads the generated pools and runs entirely client-side.

- **Modes** (segmented control in the header): **Normal** (top 10/team), **Hard**
  (full league, lazy-loaded), **Legends** (classic teams, lazy-loaded), and **Daily**.
  All endless modes share the same rules (two re-rolls). Mode persists to localStorage.
- **Daily Gauntlet**: a fixed 8-player set per day (from `dailies.json`, epoch
  `2026-06-15` = #1). Reveal players one at a time and lock each before the next — no
  spinning, no re-rolls. Score is framed against **par** (the set's best-possible
  overall, recomputed locally). One counting attempt per day, resumable on refresh;
  replays after that are unscored **Practice**.
- **Best-possible / efficiency**: on completion the app brute-forces all 40,320
  arrangements of the locked 8 to show the optimal overall, your efficiency, and a
  "See best build" breakdown.
- **Challenge links** (endless only): every game has a seed; visiting
  `?seed=<seed>&mode=<mode>` replays the exact same roll sequence. "Challenge a friend"
  copies the link.
- **Stats & share**: a Stats modal summarizes the local archive; Share produces an
  emoji-grid result string.

localStorage keys: `statle.mode`, `statle.games` (archive, cap 200), `statle.daily`
(`{ streak, lastDaily, results }`), `statle.dailyInProgress` (resume token).

## Why CSV/JSON and not .xlsx

This is a daily git-committed pipeline. CSV diffs cleanly (you can see exactly which
ratings changed each day); an `.xlsx` is a binary blob that bloats history and diffs
into noise. Excel opens the CSV natively, so you lose nothing.

## Daily automation

`.github/workflows/scrape.yml` runs every day at 09:00 UTC and commits the refreshed
files **only if something changed**. Manual run: repo → Actions → "Daily 2K ratings
scrape" → Run workflow. Enable writes: Settings → Actions → General → Workflow
permissions → "Read and write permissions".

## Tuning

| Env var | Default | Use |
|---|---|---|
| `SCRAPE_DELAY` | `0.4` | seconds between requests |
| `MAX_TEAMS` | all 30 | limit rosters (testing) |
| `MAX_PLAYERS` | all | cap players (testing) |

## Notes / caveats

- 2kratings is server-rendered WordPress, no public API — this parses HTML. Badge
  tiers are read from the badge image filename (`...-hof-badge.png`). If they redesign
  the player page, the selectors in `parse_player()` may need a tweak.
- Badges are highly collinear with the attributes they sit on, so they likely won't
  improve an overall-rating regression — they're here for completeness and for the
  game's specialization layer, not the formula.
- Fine for building/prototyping. If this goes public/commercial, revisit 2kratings'
  terms and the NBA / Take-Two / NBPA likeness + ratings IP.
