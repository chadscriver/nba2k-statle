#!/usr/bin/env python3
"""Task 4: generate the app's player pools from the scraped CSVs.

Replaces the old hand-derived pool.json + add_body_to_pool.py workflow. Reads
data/nba2k26.csv, data/nba2k26_classic.csv, data/badge_categories.json and the
headshots on disk, then writes three pools with the EXACT entry shape the app
expects (n, p, tm, o, hi, ht, ig, c, a, b, img, wt, ws):

  app/src/pool.json          current players, top 10 per team by overall
  app/src/pool_full.json     all current players
  app/src/pool_legends.json  all classic rows; n is era-tagged, tm is the
                             full classic team label

`img` is set only when the headshot file actually exists on disk. As a
safety net the generator self-checks every regenerated current player against
the existing pool.json and fails loudly on any field-level drift.

Run after the scrape + headshots:  python scripts/build_pools.py
"""
import csv
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from twok import SIX, SUBS  # noqa: E402  (single source of truth for ordering)

DATA = os.path.join(ROOT, "data")
CUR_CSV = os.path.join(DATA, "nba2k26.csv")
CLASSIC_CSV = os.path.join(DATA, "nba2k26_classic.csv")
BADGE_CATS = os.path.join(DATA, "badge_categories.json")
HEADSHOTS = os.path.join(ROOT, "app", "public", "headshots")
SRC = os.path.join(ROOT, "app", "src")

ABBR = {
    "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
    "Los Angeles Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP", "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC",
    "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS",
}
TIER_IDX = {"HOF": 0, "Legend": 0, "Gold": 1, "Silver": 2, "Bronze": 3}
# short category key -> full rollup column, used to backfill the rare attribute
# 2K leaves as "--" on a classic card (e.g. Iguodala's Agility).
FULL_CAT = dict(zip(["OUT", "IN", "PLY", "ATH", "DEF", "REB"], SIX))
TOP_N = 10


def slugify(name):
    s = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c))
    s = s.lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _int(v, default=0):
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return default


def make_entry(row, tm, name, badge_cat, have_headshot):
    """Build one pool entry in the exact field order the app expects."""
    e = {}
    e["n"] = name
    e["p"] = row["pos"].split("/")[0].strip()
    e["tm"] = tm
    e["o"] = _int(row["overall"])
    e["hi"] = _int(row["height_in"])
    e["ht"] = row["height"]
    e["ig"] = _int(row["Intangibles"])
    e["c"] = [_int(row[cat]) for cat in SIX]
    e["a"] = {k: [_int((row.get(attr) or "").strip() or row.get(FULL_CAT[k]))
                  for attr in SUBS[k]] for k in SUBS}
    # badge tier counts per category: [HOF, Gold, Silver, Bronze]. The five
    # badge-bearing categories are always present (matching the shipped pool);
    # Athleticism has no badges so it is never included.
    counts = {k: [0, 0, 0, 0] for k in ["OUT", "IN", "PLY", "DEF", "REB"]}
    for col, val in row.items():
        if not col.startswith("badge: ") or val in (None, "-", ""):
            continue
        cat = badge_cat.get(col[len("badge: "):])
        if cat in counts and val in TIER_IDX:
            counts[cat][TIER_IDX[val]] += 1
    e["b"] = counts
    slug = slugify(row["name"])
    if have_headshot(slug):
        e["img"] = f"headshots/{slug}.png"
    wt = (row.get("weight_lbs") or "").strip()
    if wt:
        e["wt"] = _int(wt)
    ws = (row.get("wingspan") or "").strip()
    if ws:
        e["ws"] = ws
    return e


def dump(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)


def main():
    badge_cat = json.load(open(BADGE_CATS)) if os.path.exists(BADGE_CATS) else {}
    headshot_files = {p[:-4] for p in os.listdir(HEADSHOTS) if p.endswith(".png")} \
        if os.path.isdir(HEADSHOTS) else set()
    have = lambda slug: slug in headshot_files

    current = list(csv.DictReader(open(CUR_CSV, newline="", encoding="utf-8")))
    classic = []
    if os.path.exists(CLASSIC_CSV):
        classic = list(csv.DictReader(open(CLASSIC_CSV, newline="", encoding="utf-8")))

    # Players with no current team (free agents / waived) can't be assigned a
    # team abbrev or logo, so they're excluded from the current pools and reported.
    teamless = [r["name"] for r in current if r["team"] not in ABBR]
    current = [r for r in current if r["team"] in ABBR]

    # --- current pools ---
    full = [make_entry(r, ABBR[r["team"]], r["name"], badge_cat, have) for r in current]
    full.sort(key=lambda e: (-e["o"], e["n"]))

    by_team = {}
    for r in current:
        by_team.setdefault(r["team"], []).append(r)
    pool = []
    for team, rs in by_team.items():
        rs = sorted(rs, key=lambda r: (-_int(r["overall"]), r["name"]))[:TOP_N]
        pool += [make_entry(r, ABBR[team], r["name"], badge_cat, have) for r in rs]
    pool.sort(key=lambda e: (-e["o"], e["n"]))

    # --- legends pool ---
    legends = []
    for r in classic:
        name = f"{r['name']} ({r['era_tag']})"
        legends.append(make_entry(r, r["classic_team"], name, badge_cat, have))
    legends.sort(key=lambda e: (-e["o"], e["n"]))

    # --- self-check: regenerated current players must match existing pool.json ---
    POOL_PATH = os.path.join(SRC, "pool.json")
    drift = []
    if os.path.exists(POOL_PATH):
        old = {p["n"]: p for p in json.load(open(POOL_PATH))}
        new_by_name = {e["n"]: e for e in full}
        check = ["n", "p", "tm", "o", "hi", "ht", "ig", "c", "a", "b", "wt", "ws"]
        for name, op in old.items():
            ne = new_by_name.get(name)
            if not ne:
                continue
            for k in check:
                if op.get(k) != ne.get(k):
                    drift.append((name, k, op.get(k), ne.get(k)))
    if drift:
        print(f"!! FIELD DRIFT vs existing pool.json ({len(drift)} fields):")
        for name, k, o, n in drift[:25]:
            print(f"   {name}.{k}: existing={o!r} generated={n!r}")
        raise SystemExit("aborting: generated entries do not match existing pool shape")

    dump(POOL_PATH, pool)
    dump(os.path.join(SRC, "pool_full.json"), full)
    dump(os.path.join(SRC, "pool_legends.json"), legends)

    # --- validation ---
    for fn in ("pool.json", "pool_full.json", "pool_legends.json"):
        json.load(open(os.path.join(SRC, fn)))  # parse check
    pool_img = sum(1 for e in pool if "img" in e)
    leg_img = sum(1 for e in legends if "img" in e)
    print("=== POOLS ===")
    print(f"pool.json        : {len(pool)} entries ({pool_img} with img) — top {TOP_N}/team")
    print(f"pool_full.json   : {len(full)} entries")
    print(f"pool_legends.json: {len(legends)} entries ({leg_img} with img)")
    print(f"distinct legend teams: {len({e['tm'] for e in legends})}")
    if teamless:
        print(f"excluded (no current team): {len(teamless)} -> {', '.join(teamless)}")
    print(f"self-check vs existing pool.json: {'OK (no drift)' if not drift else 'DRIFT'}")


if __name__ == "__main__":
    main()
