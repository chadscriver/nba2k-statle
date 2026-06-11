#!/usr/bin/env python3
"""Task 1: scrape 2kratings.com Classic Teams into data/nba2k26_classic.csv.

Reuses twok.py's parser (no fork). Pages are cached (resumable) and live
requests are throttled politely. Emits, alongside the CSV:
  - data/classic_teams.json    team metadata incl the era-correct logo URL
  - data/badge_categories.json  badge name -> short category (for build_pools)

The CSV uses the EXACT column schema of data/nba2k26.csv plus four classic
columns appended: classic_team, base_team, season, era_tag. A player who
appears on multiple classic teams gets one row per team card (no dedupe).

Run from anywhere:  python scripts/scrape_classic.py
"""
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import twok  # noqa: E402
from twok import BASE, ROLLUPS, SHORT_CAT  # noqa: E402

DATA = os.path.join(ROOT, "data")
CUR_CSV = os.path.join(DATA, "nba2k26.csv")
OUT_CSV = os.path.join(DATA, "nba2k26_classic.csv")
TEAMS_JSON = os.path.join(DATA, "classic_teams.json")
BADGE_CATS = os.path.join(DATA, "badge_categories.json")

ID_COLS = ["slug", "name", "team", "pos", "overall",
           "height", "height_in", "weight_lbs", "wingspan", "wingspan_in"]
CLASSIC_COLS = ["classic_team", "base_team", "season", "era_tag"]


def standard_schema():
    with open(CUR_CSV, newline="") as f:
        return next(csv.reader(f))


def classic_team_slugs():
    html = twok.fetch(f"{BASE}/classic-teams")
    if not html:
        raise SystemExit("could not fetch /classic-teams")
    soup = twok.soup_of(html)
    slugs = []
    for a in soup.select("a[href]"):
        m = re.search(r"/teams/((?:19|20)\d{2}-\d{2}-[a-z0-9-]+)$", a.get("href", ""))
        if m:
            slugs.append(m.group(1))
    return list(dict.fromkeys(slugs))


def derive_meta(team_slug, full_label):
    m = re.match(r"^((?:19|20)\d{2})-(\d{2})\s+(.+)$", full_label or "")
    if not m:  # fall back to the slug if the label is unexpected
        season = re.match(r"^((?:19|20)\d{2}-\d{2})", team_slug).group(1)
        base = team_slug[len(season) + 1:].replace("-", " ").title()
        return season, base, "'" + season[-2:], team_slug[len(season) + 1:]
    season = f"{m.group(1)}-{m.group(2)}"
    base_team = m.group(3)
    era_tag = "'" + m.group(2)
    franchise_slug = re.sub(r"^(?:19|20)\d{2}-\d{2}-", "", team_slug)
    return season, base_team, era_tag, franchise_slug


def main():
    schema = standard_schema()
    badge_cols = [c for c in schema if c.startswith("badge: ")]
    known = set(ID_COLS) | set(ROLLUPS)
    attr_cols = [c for c in schema if c not in known and not c.startswith("badge: ")]
    out_cols = schema + CLASSIC_COLS

    team_slugs = classic_team_slugs()
    print(f"Classic teams found: {len(team_slugs)}", flush=True)

    teams_meta, rows, parse_fail = [], [], []
    badge_cat_map = {}
    if os.path.exists(BADGE_CATS):
        badge_cat_map.update(json.load(open(BADGE_CATS)))

    for ti, ts in enumerate(team_slugs, 1):
        html = twok.fetch(f"{BASE}/teams/{ts}")
        if not html:
            print(f"  ! team fetch failed: {ts}", flush=True)
            continue
        label = twok.team_h1(html)
        season, base_team, era_tag, fr = derive_meta(ts, label)
        logo = twok.main_logo_url(html)
        roster = twok.parse_roster(html)
        teams_meta.append({"slug": ts, "label": label, "base_team": base_team,
                           "season": season, "era_tag": era_tag,
                           "franchise_slug": fr, "logo_url": logo,
                           "n_players": len(roster)})
        kept = 0
        for ps in roster:
            phtml = twok.fetch(f"{BASE}/{ps}")
            p = twok.parse_player(phtml) if phtml else None
            if not p or not p.get("overall") or not p.get("_attrs"):
                parse_fail.append(ps)
                continue
            for bn, cat in p["_badge_cat"].items():
                if cat in SHORT_CAT:
                    badge_cat_map[bn] = SHORT_CAT[cat]
            row = {k: p.get(k) for k in [*ID_COLS, *ROLLUPS]}
            row["slug"] = ps
            for a in attr_cols:
                row[a] = p["_attrs"].get(a)
            for bc in badge_cols:
                row[bc] = p["_badges"].get(bc[len("badge: "):], "-")
            row["classic_team"] = label
            row["base_team"] = base_team
            row["season"] = season
            row["era_tag"] = era_tag
            rows.append(row)
            kept += 1
        print(f"  [{ti}/{len(team_slugs)}] {label}: {kept}/{len(roster)} players "
              f"(rows so far {len(rows)})", flush=True)

    badge_cat_map.update(twok.ODDBALL_BADGE_CAT)  # badges whose pill != attribute category

    os.makedirs(DATA, exist_ok=True)
    with open(OUT_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_cols)
        w.writeheader()
        w.writerows(rows)
    json.dump(teams_meta, open(TEAMS_JSON, "w"), indent=2)
    json.dump(dict(sorted(badge_cat_map.items())), open(BADGE_CATS, "w"), indent=2)

    # ---- validation ----
    miss_attr = [r for r in rows if any(r[a] is None for a in attr_cols)]
    zero_badge = [r for r in rows if all(r[bc] == "-" for bc in badge_cols)]
    print("\n=== VALIDATION ===")
    print(f"classic teams written : {len(teams_meta)}")
    print(f"player rows written   : {len(rows)}")
    print(f"unique humans         : {len({r['name'] for r in rows})}")
    print(f"parse failures        : {len(parse_fail)}{(' ' + str(parse_fail[:5])) if parse_fail else ''}")
    print(f"rows missing any attr : {len(miss_attr)}")
    for r in miss_attr[:10]:
        miss = [a for a in attr_cols if r[a] is None]
        print(f"    {r['name']} ({r['classic_team']}): missing {miss}")
    print(f"rows with zero badges : {len(zero_badge)} (informational)")
    print(f"badge->category map   : {len(badge_cat_map)} badges")
    print(f"wrote {OUT_CSV}")


if __name__ == "__main__":
    main()
