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

OVERRIDES: dict[str, int] = {
    "Alexandre Sarr": 1642259,  # listed as "Alex Sarr" in the static roster
}

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

    # --- current players: prefer the active record (existing behavior) ---
    for r in current:
        name = r["name"]
        if name in resolved:
            continue
        if name in OVERRIDES:
            resolved[name] = (OVERRIDES[name], slugify(name), "current")
            continue
        norm = normalize(name)
        cands = active_idx.get(norm) or all_idx.get(norm)
        if cands:
            resolved[name] = (pick_active(cands)["id"], slugify(name), "current")
        else:
            no_match[name] = {"name": name, "slug": slugify(name),
                              "nba_id": "", "source": "current", "reason": "no_nba_match"}

    # --- historic players: exact normalized match; multiple == ambiguous ---
    for r in classic:
        name = r["name"]
        if name in resolved or name in ambiguous or name in no_match:
            continue
        if name in OVERRIDES:
            resolved[name] = (OVERRIDES[name], slugify(name), "classic")
            continue
        norm = normalize(name)
        cands = all_idx.get(norm, [])
        ids = sorted({c["id"] for c in cands})
        if len(ids) == 1:
            resolved[name] = (ids[0], slugify(name), "classic")
        elif len(ids) > 1:
            ambiguous[name] = {"name": name, "team": r.get("classic_team", ""),
                               "season": r.get("season", ""),
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
