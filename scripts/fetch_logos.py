#!/usr/bin/env python3
"""Task 3: download era-correct team logos and emit app/src/teams.json.

For every current team and every classic team, grab the logo image shown on
that team's OWN 2kratings page (so the Sonics get the Sonics mark, the teal
Hornets get teal, etc.). SVGs are rasterized to PNG via macOS qlmanage.

  current teams  -> app/public/logos/{franchise-slug}.png
  classic teams  -> app/public/logos/{season}-{franchise-slug}.png
  fallback (current only, if the 2kratings image is unusable):
                    https://cdn.nba.com/logos/nba/{teamId}/global/L/logo.svg

app/src/teams.json maps every team label used by the pools (current = abbrev,
classic = full label) to {"logo": "logos/<file>", "season": <season or null>}.

Run after scripts/scrape_classic.py:  python scripts/fetch_logos.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import twok  # noqa: E402

LOGO_DIR = os.path.join(ROOT, "app", "public", "logos")
CLASSIC_TEAMS = os.path.join(ROOT, "data", "classic_teams.json")
TEAMS_JSON = os.path.join(ROOT, "app", "src", "teams.json")
CDN_LOGO = "https://cdn.nba.com/logos/nba/{tid}/global/L/logo.svg"

# (franchise_slug, abbreviation, full_name) — abbreviations are the `tm` values
# the current pools use; matched to data/nba2k26.csv team names.
CURRENT_TEAMS = [
    ("atlanta-hawks", "ATL", "Atlanta Hawks"), ("boston-celtics", "BOS", "Boston Celtics"),
    ("brooklyn-nets", "BKN", "Brooklyn Nets"), ("charlotte-hornets", "CHA", "Charlotte Hornets"),
    ("chicago-bulls", "CHI", "Chicago Bulls"), ("cleveland-cavaliers", "CLE", "Cleveland Cavaliers"),
    ("dallas-mavericks", "DAL", "Dallas Mavericks"), ("denver-nuggets", "DEN", "Denver Nuggets"),
    ("detroit-pistons", "DET", "Detroit Pistons"), ("golden-state-warriors", "GSW", "Golden State Warriors"),
    ("houston-rockets", "HOU", "Houston Rockets"), ("indiana-pacers", "IND", "Indiana Pacers"),
    ("los-angeles-clippers", "LAC", "Los Angeles Clippers"), ("los-angeles-lakers", "LAL", "Los Angeles Lakers"),
    ("memphis-grizzlies", "MEM", "Memphis Grizzlies"), ("miami-heat", "MIA", "Miami Heat"),
    ("milwaukee-bucks", "MIL", "Milwaukee Bucks"), ("minnesota-timberwolves", "MIN", "Minnesota Timberwolves"),
    ("new-orleans-pelicans", "NOP", "New Orleans Pelicans"), ("new-york-knicks", "NYK", "New York Knicks"),
    ("oklahoma-city-thunder", "OKC", "Oklahoma City Thunder"), ("orlando-magic", "ORL", "Orlando Magic"),
    ("philadelphia-76ers", "PHI", "Philadelphia 76ers"), ("phoenix-suns", "PHX", "Phoenix Suns"),
    ("portland-trail-blazers", "POR", "Portland Trail Blazers"), ("sacramento-kings", "SAC", "Sacramento Kings"),
    ("san-antonio-spurs", "SAS", "San Antonio Spurs"), ("toronto-raptors", "TOR", "Toronto Raptors"),
    ("utah-jazz", "UTA", "Utah Jazz"), ("washington-wizards", "WAS", "Washington Wizards"),
]

SESS = requests.Session()
SESS.headers.update({"User-Agent": twok.UA})


def rasterize(data: bytes, dest: str, size: int = 512) -> bool:
    """Write `data` to dest as PNG. SVG is rasterized via qlmanage; PNG bytes
    are written directly; other raster formats go through sips."""
    head = data[:64].lstrip()
    if head.startswith(b"\x89PNG"):
        with open(dest, "wb") as f:
            f.write(data)
        return True
    if head[:5].lower() == b"<?xml" or head[:4].lower() == b"<svg":
        with tempfile.TemporaryDirectory() as td:
            src = os.path.join(td, "in.svg")
            with open(src, "wb") as f:
                f.write(data)
            subprocess.run(["qlmanage", "-t", "-s", str(size), "-o", td, src],
                           capture_output=True)
            out = os.path.join(td, "in.svg.png")
            if os.path.exists(out) and os.path.getsize(out) > 0:
                shutil.move(out, dest)
                return True
        return False
    # JPEG/other raster -> convert to PNG via sips
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, "in.img")
        with open(src, "wb") as f:
            f.write(data)
        r = subprocess.run(["sips", "-s", "format", "png", src, "--out", dest],
                           capture_output=True)
        return r.returncode == 0 and os.path.exists(dest)


def download(url: str):
    try:
        r = SESS.get(url, timeout=25)
        if r.status_code == 200 and r.content:
            return r.content
    except requests.RequestException:
        pass
    return None


def nba_team_ids():
    try:
        from nba_api.stats.static import teams
        return {t["abbreviation"]: t["id"] for t in teams.get_teams()}
    except Exception:
        return {}


def main():
    os.makedirs(LOGO_DIR, exist_ok=True)
    teams_map = {}
    got = skipped = failed = fallback = 0
    fails = []

    # --- current teams ---
    cdn_ids = nba_team_ids()
    # nba_api uses GSW->GSW, PHX->PHX etc.; a couple legacy abbrev differences:
    abbr_alias = {"PHX": "PHX", "NOP": "NOP", "UTA": "UTA"}
    for slug, abbr, name in CURRENT_TEAMS:
        dest = os.path.join(LOGO_DIR, f"{slug}.png")
        rel = f"logos/{slug}.png"
        teams_map[abbr] = {"logo": rel, "season": None}
        if os.path.exists(dest):
            skipped += 1
            continue
        ok = False
        html = twok.fetch(f"{twok.BASE}/teams/{slug}")
        if html:
            url = twok.main_logo_url(html)
            data = download(url) if url else None
            if data and rasterize(data, dest):
                ok = True
                got += 1
        if not ok:  # CDN fallback (current teams only)
            tid = cdn_ids.get(abbr_alias.get(abbr, abbr))
            if tid:
                data = download(CDN_LOGO.format(tid=tid))
                if data and rasterize(data, dest):
                    ok = True
                    fallback += 1
        if not ok:
            failed += 1
            fails.append(name)

    # --- classic teams ---
    if os.path.exists(CLASSIC_TEAMS):
        for t in json.load(open(CLASSIC_TEAMS)):
            fname = f"{t['season']}-{t['franchise_slug']}.png"
            dest = os.path.join(LOGO_DIR, fname)
            teams_map[t["label"]] = {"logo": f"logos/{fname}", "season": t["season"]}
            if os.path.exists(dest):
                skipped += 1
                continue
            data = download(t["logo_url"]) if t.get("logo_url") else None
            if data and rasterize(data, dest):
                got += 1
            else:
                failed += 1
                fails.append(t["label"])
    else:
        print("! data/classic_teams.json not found — run scrape_classic.py first; "
              "classic logos skipped.")

    json.dump(dict(sorted(teams_map.items())), open(TEAMS_JSON, "w"), indent=2)

    print("\n=== LOGOS ===")
    print(f"downloaded={got} fallback(CDN)={fallback} skipped(existing)={skipped} failed={failed}")
    if fails:
        print("  failures:", ", ".join(fails))
    print(f"team labels in teams.json: {len(teams_map)}")
    print(f"wrote {os.path.relpath(TEAMS_JSON, ROOT)}")


if __name__ == "__main__":
    main()
