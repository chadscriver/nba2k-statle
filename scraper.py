#!/usr/bin/env python3
"""Scrape current NBA player ratings (full detail) from 2kratings.com.

Captures, per player: identity, overall, body (imperial), the 6 category
averages + Intangibles, every individual attribute, and every badge with its
tier (HOF / Gold / Silver / Bronze / Legend, or "-" if not held).

Outputs data/nba2k26.csv and data/nba2k26.json (one wide row per player).
Shared fetching/parsing lives in twok.py (also used by scripts/scrape_classic.py).
Run:  python scraper.py   |   test:  MAX_TEAMS=2 python scraper.py
"""
import csv, json, os
import twok
from twok import BASE, SIX, ROLLUPS, parse_player

TEAMS = ["atlanta-hawks","boston-celtics","brooklyn-nets","charlotte-hornets",
    "chicago-bulls","cleveland-cavaliers","dallas-mavericks","denver-nuggets",
    "detroit-pistons","golden-state-warriors","houston-rockets","indiana-pacers",
    "los-angeles-clippers","los-angeles-lakers","memphis-grizzlies","miami-heat",
    "milwaukee-bucks","minnesota-timberwolves","new-orleans-pelicans","new-york-knicks",
    "oklahoma-city-thunder","orlando-magic","philadelphia-76ers","phoenix-suns",
    "portland-trail-blazers","sacramento-kings","san-antonio-spurs","toronto-raptors",
    "utah-jazz","washington-wizards"]

DELAY     = float(os.environ.get("SCRAPE_DELAY", "0.4"))
MAX_TEAMS = int(os.environ.get("MAX_TEAMS", "0")) or None
MAX_PLAYERS = int(os.environ.get("MAX_PLAYERS", "0")) or None
OUT_DIR = os.environ.get("OUT_DIR", "data")


def roster_slugs(team):
    html = twok.fetch(f"{BASE}/teams/{team}", delay=DELAY)
    return twok.parse_roster(html) if html else []


def main():
    teams = TEAMS[:MAX_TEAMS] if MAX_TEAMS else TEAMS
    print(f"Enumerating {len(teams)} rosters...", flush=True)
    slugs = []
    for t in teams:
        slugs += roster_slugs(t)
    slugs = list(dict.fromkeys(slugs))
    if MAX_PLAYERS: slugs = slugs[:MAX_PLAYERS]
    print(f"{len(slugs)} players to scrape.", flush=True)

    players, fails = [], 0
    attr_order, attr_cat_g = [], {}
    badge_order, badge_cat_g = [], {}
    for i, slug in enumerate(slugs, 1):
        html = twok.fetch(f"{BASE}/{slug}", delay=DELAY)
        p = parse_player(html) if html else None
        if p and p.get("overall") and p.get("_attrs"):
            p["slug"] = slug
            for a, c in p["_attr_cat"].items():
                if a not in attr_cat_g: attr_cat_g[a] = c; attr_order.append(a)
            for b, c in p["_badge_cat"].items():
                if b not in badge_cat_g: badge_cat_g[b] = c; badge_order.append(b)
            players.append(p)
        else:
            fails += 1
        if i % 50 == 0:
            print(f"  {i}/{len(slugs)} | ok={len(players)} fail={fails}", flush=True)

    cat_rank = {c: i for i, c in enumerate(SIX)}
    attr_order.sort(key=lambda a: (cat_rank.get(attr_cat_g[a], 9), a))
    badge_order.sort(key=lambda b: (cat_rank.get(badge_cat_g[b], 9), b))

    cols = (["slug","name","team","pos","overall",
             "height","height_in","weight_lbs","wingspan","wingspan_in"]
            + ROLLUPS + attr_order + [f"badge: {b}" for b in badge_order])

    players.sort(key=lambda r: (-(r["overall"] or 0), r["name"]))
    rows = []
    for p in players:
        row = {k: p.get(k) for k in
               ["slug","name","team","pos","overall","height","height_in",
                "weight_lbs","wingspan","wingspan_in", *ROLLUPS]}
        for a in attr_order: row[a] = p["_attrs"].get(a)
        for b in badge_order: row[f"badge: {b}"] = p["_badges"].get(b, "-")
        rows.append(row)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/nba2k26.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    with open(f"{OUT_DIR}/nba2k26.json", "w") as f:
        json.dump(rows, f, indent=2)
    print(f"DONE: {len(rows)} players, {len(attr_order)} attributes, "
          f"{len(badge_order)} badge columns, {fails} skipped.", flush=True)

if __name__ == "__main__":
    main()
