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
