#!/usr/bin/env python3
"""Download NBA headshots for every player in the dataset.

Sources both data/nba2k26.csv (current, 533) and data/nba2k26_classic.csv
(historic). Player IDs come from nba_api's STATIC players list (offline), which
includes retired players. Names are matched with diacritic/suffix-insensitive
normalization.

Rules:
  * Headshots are keyed by a name slug with NO era ("michael-jordan.png"), so
    the same human shares one image across eras. Existing files are skipped.
  * A historic name that matches MULTIPLE NBA IDs is NOT guessed -- it is written
    to data/headshot_ambiguous.csv for manual resolution.
  * Old players 404 on the CDN; those (and names with no NBA match) are recorded
    in data/headshot_misses.csv. The run never fails on a miss.

This script only downloads images. The pool generator (scripts/build_pools.py)
decides which players get an `img` field, based on whether the file exists.

Usage:
    python scripts/fetch_headshots.py --dry-run   # match + report only
    python scripts/fetch_headshots.py             # download everything
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests
from nba_api.stats.static import players

ROOT = Path(__file__).resolve().parent.parent
CUR_CSV = ROOT / "data" / "nba2k26.csv"
CLASSIC_CSV = ROOT / "data" / "nba2k26_classic.csv"
HEADSHOT_DIR = ROOT / "app" / "public" / "headshots"
AMBIG_CSV = ROOT / "data" / "headshot_ambiguous.csv"
MISS_CSV = ROOT / "data" / "headshot_misses.csv"
CDN_URL = "https://cdn.nba.com/headshots/nba/latest/260x190/{id}.png"
REQUEST_DELAY = 0.25
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) nba2k-statle/1.0"

# The NBA CDN serves one byte-identical gray placeholder silhouette (HTTP 200,
# image/png) for player IDs with no digitized photo. Never save it. This md5 is
# the placeholder cluster hash reported by scripts/prune_silhouettes.py.
PLACEHOLDER_MD5 = "7475ba9619305909d7998dd9dba02481"

OVERRIDES: dict[str, int] = {
    "Alexandre Sarr": 1642259,  # listed as "Alex Sarr" in the static roster
}

# Known name mismatches: the dataset's name -> the name nba_api lists the same
# player under. The headshot is still saved under the original (slugified) name
# so the pool generator finds it.
ALIASES: dict[str, str] = {
    "Penny Hardaway": "Anfernee Hardaway",
    "J.R. Smith": "JR Smith",
    "C.J. McCollum": "CJ McCollum",
    "R.J. Barrett": "RJ Barrett",
    "Stanislav Medvedenko": "Slava Medvedenko",
    "Jeff Pendegraph": "Jeff Ayres",
    "World B. Free": "World Free",
}

# Ambiguous historic names from seasons before this year are resolved to the
# legacy (smallest, i.e. oldest) candidate NBA id rather than left for review.
LEGACY_BEFORE = 2010

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text)
                   if not unicodedata.combining(c))


def normalize(name: str) -> str:
    s = strip_accents(name).lower().replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(t for t in s.split() if t not in SUFFIXES)


def slugify(name: str) -> str:
    s = strip_accents(name).lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def build_index(plist):
    idx: dict[str, list[dict]] = {}
    for p in plist:
        idx.setdefault(normalize(p["full_name"]), []).append(p)
    return idx


def pick_active(cands):
    active = [c for c in cands if c.get("is_active")]
    return (active or cands)[0]


def alias_id(name, active_idx, all_idx):
    """Resolve a known alias to its nba_api id, or None if the target is absent."""
    target = ALIASES.get(name)
    if not target:
        return None
    cands = active_idx.get(normalize(target)) or all_idx.get(normalize(target))
    return pick_active(cands)["id"] if cands else None


def team_nick(team):
    """Last word of a team name as a normalized key ('Detroit Pistons' -> pistons)."""
    toks = normalize(team).split()
    return toks[-1] if toks else ""


def fetch_live_rows():
    """Current-season player index, for recovering current misses (2025-26 rookies,
    two-way players, and names nba_api lists differently). Primary: stats.nba.com
    commonallplayers; fallback: the NBA CDN playerIndex JSON that nba.com/players
    loads. Returns (person_id, full_name, team_name) rows."""
    try:
        from nba_api.stats.endpoints import commonallplayers
        d = commonallplayers.CommonAllPlayers(is_only_current_season=1,
                                              season="2025-26", timeout=30).get_normalized_dict()
        return [(p["PERSON_ID"], p.get("DISPLAY_FIRST_LAST") or "", p.get("TEAM_NAME") or "")
                for p in d["CommonAllPlayers"]]
    except Exception as e:  # stats.nba.com blocked / unreachable
        print(f"  live index via stats.nba.com failed ({e}); using NBA CDN playerIndex")
    try:
        url = "https://cdn.nba.com/static/json/staticData/playerIndex.json"
        rs = requests.get(url, headers={"User-Agent": UA, "Referer": "https://www.nba.com/"},
                          timeout=30).json()["resultSets"][0]
        h = {c: i for i, c in enumerate(rs["headers"])}
        return [(row[h["PERSON_ID"]],
                 f'{row[h["PLAYER_FIRST_NAME"]]} {row[h["PLAYER_LAST_NAME"]]}'.strip(),
                 row[h["TEAM_NAME"]] or "")
                for row in rs["rowSet"]]
    except Exception as e:
        print(f"  NBA CDN playerIndex also failed ({e}); skipping live recovery")
        return []


def build_live_lookup():
    """Two lookups over the live index: normalized full name -> [ids], and
    (normalized last name, team nickname) -> [ids]."""
    full, lastteam = {}, {}
    for pid, name, teamname in fetch_live_rows():
        nm = normalize(name)
        if not nm:
            continue
        full.setdefault(nm, []).append(pid)
        toks, nick = nm.split(), team_nick(teamname)
        if toks and nick:
            lastteam.setdefault((toks[-1], nick), []).append(pid)
    return full, lastteam


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="match + report only; no downloads, no CSV writes")
    args = ap.parse_args()

    current = list(csv.DictReader(open(CUR_CSV, newline="", encoding="utf-8")))
    classic = []
    if CLASSIC_CSV.exists():
        classic = list(csv.DictReader(open(CLASSIC_CSV, newline="", encoding="utf-8")))
    print(f"current players: {len(current)} | classic rows: {len(classic)}")

    all_players = players.get_players()
    active = [p for p in all_players if p.get("is_active")]
    active_idx, all_idx = build_index(active), build_index(all_players)

    # name -> (nba_id, slug, source); plus ambiguous / unmatched collections.
    resolved: dict[str, tuple[int, str, str]] = {}
    ambiguous: dict[str, dict] = {}
    no_match: dict[str, dict] = {}
    cur_unmatched: list[dict] = []  # current rows to retry against the live index

    # --- current players: prefer the active record (existing behavior) ---
    for r in current:
        name = r["name"]
        if name in resolved:
            continue
        if name in OVERRIDES:
            resolved[name] = (OVERRIDES[name], slugify(name), "current")
            continue
        aid = alias_id(name, active_idx, all_idx)
        if aid is not None:
            resolved[name] = (aid, slugify(name), "current")
            continue
        norm = normalize(name)
        cands = active_idx.get(norm) or all_idx.get(norm)
        if cands:
            resolved[name] = (pick_active(cands)["id"], slugify(name), "current")
        else:
            no_match[name] = {"name": name, "slug": slugify(name),
                              "nba_id": "", "source": "current", "reason": "no_nba_match"}
            cur_unmatched.append(r)

    # --- recover current misses via the live NBA player index (rookies, two-way
    #     players, and names the static list spells differently) ---
    if cur_unmatched:
        live_full, live_lastteam = build_live_lookup()
        recovered = 0
        for r in cur_unmatched:
            name = r["name"]
            if name in resolved:
                continue
            nm = normalize(name)
            pid = None
            fc = live_full.get(nm)
            if fc and len(set(fc)) == 1:  # unique full-name match
                pid = fc[0]
            else:                          # else last name + team, only if unique
                toks = nm.split()
                lt = live_lastteam.get((toks[-1], team_nick(r.get("team", "")))) if toks else None
                if lt and len(set(lt)) == 1:
                    pid = lt[0]
            if pid is not None:
                resolved[name] = (pid, slugify(name), "current")
                no_match.pop(name, None)
                recovered += 1
        print(f"live-index recovery: {recovered}/{len(cur_unmatched)} current misses resolved")

    # --- historic players: exact normalized match; multiple == ambiguous ---
    for r in classic:
        name = r["name"]
        if name in resolved or name in ambiguous or name in no_match:
            continue
        if name in OVERRIDES:
            resolved[name] = (OVERRIDES[name], slugify(name), "classic")
            continue
        aid = alias_id(name, active_idx, all_idx)
        if aid is not None:
            resolved[name] = (aid, slugify(name), "classic")
            continue
        norm = normalize(name)
        cands = all_idx.get(norm, [])
        ids = sorted({c["id"] for c in cands})
        if len(ids) == 1:
            resolved[name] = (ids[0], slugify(name), "classic")
        elif len(ids) > 1:
            season = r.get("season", "")
            start_year = int(season[:4]) if season[:4].isdigit() else 9999
            if start_year < LEGACY_BEFORE:  # legacy era -> smallest (oldest) id
                resolved[name] = (ids[0], slugify(name), "classic")
            else:
                ambiguous[name] = {"name": name, "team": r.get("classic_team", ""),
                                   "season": season,
                                   "candidate_ids": " ".join(str(i) for i in ids)}
        else:
            no_match[name] = {"name": name, "slug": slugify(name),
                              "nba_id": "", "source": "classic", "reason": "no_nba_match"}

    print(f"resolved names: {len(resolved)} | ambiguous: {len(ambiguous)} | "
          f"no NBA match: {len(no_match)}")
    if ambiguous:
        print("  ambiguous (-> headshot_ambiguous.csv):")
        for a in list(ambiguous.values())[:15]:
            print(f"    {a['name']} [{a['season']}] ids={a['candidate_ids']}")

    if args.dry_run:
        print("\n[dry-run] no downloads, no CSV writes.")
        return 0

    HEADSHOT_DIR.mkdir(parents=True, exist_ok=True)
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    downloaded = skipped = 0
    misses = list(no_match.values())

    # de-dupe by slug so shared humans download once
    by_slug: dict[str, tuple[int, str, str]] = {}
    for name, (pid, slug, src) in resolved.items():
        by_slug.setdefault(slug, (pid, name, src))

    for slug, (pid, name, src) in by_slug.items():
        dest = HEADSHOT_DIR / f"{slug}.png"
        if dest.exists():
            skipped += 1
            continue
        try:
            r = s.get(CDN_URL.format(id=pid), timeout=20)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                if hashlib.md5(r.content).hexdigest() == PLACEHOLDER_MD5:
                    misses.append({"name": name, "slug": slug, "nba_id": pid,
                                   "source": src, "reason": "cdn_placeholder"})
                else:
                    dest.write_bytes(r.content)
                    downloaded += 1
            else:
                misses.append({"name": name, "slug": slug, "nba_id": pid,
                               "source": src, "reason": "cdn_404"})
        except requests.RequestException as e:
            misses.append({"name": name, "slug": slug, "nba_id": pid,
                           "source": src, "reason": f"error:{e}"})
        time.sleep(REQUEST_DELAY)

    # --- write report CSVs ---
    with open(AMBIG_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["name", "team", "season", "candidate_ids"])
        w.writeheader()
        w.writerows(sorted(ambiguous.values(), key=lambda x: x["name"]))
    with open(MISS_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["name", "slug", "nba_id", "source", "reason"])
        w.writeheader()
        w.writerows(sorted(misses, key=lambda x: (x["reason"], x["name"])))

    have = len(list(HEADSHOT_DIR.glob("*.png")))
    print("\n=== HEADSHOTS ===")
    print(f"downloaded={downloaded} skipped(existing)={skipped} "
          f"misses={len(misses)} ambiguous={len(ambiguous)}")
    print(f"headshot files on disk: {have}")
    print(f"wrote {AMBIG_CSV.name} ({len(ambiguous)}) and {MISS_CSV.name} ({len(misses)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
