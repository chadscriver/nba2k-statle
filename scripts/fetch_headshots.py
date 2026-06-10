#!/usr/bin/env python3
"""Map NBA 2K Statle pool players to NBA player IDs, download their headshots,
and record a relative image path on each player in pool.json.

Player IDs come from nba_api's STATIC players list (offline, no API calls).
Names are matched with diacritic/suffix-insensitive normalization plus a
fuzzy fallback. Unmatched names are printed for manual resolution.

Usage:
    python scripts/fetch_headshots.py --dry-run   # match + report only
    python scripts/fetch_headshots.py             # match, download, write pool.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests
from nba_api.stats.static import players
from rapidfuzz import fuzz, process

ROOT = Path(__file__).resolve().parent.parent
POOL_PATH = ROOT / "app" / "src" / "pool.json"
HEADSHOT_DIR = ROOT / "app" / "public" / "headshots"
CDN_URL = "https://cdn.nba.com/headshots/nba/latest/260x190/{id}.png"
FUZZY_CUTOFF = 87          # rapidfuzz WRatio score required to accept a fuzzy match
REQUEST_DELAY = 0.25       # seconds between downloads, to be polite
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) nba2k-statle/1.0"

# Manual name -> nba_api player id overrides for cases fuzzy matching can't
# resolve confidently (filled in after reviewing --dry-run output).
OVERRIDES: dict[str, int] = {
    "Alexandre Sarr": 1642259,  # listed as "Alex Sarr" in the static roster
}

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def normalize(name: str) -> str:
    """Lowercased, accent-free, suffix-free, punctuation-free token string."""
    s = strip_accents(name).lower().replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    toks = [t for t in s.split() if t not in SUFFIXES]
    return " ".join(toks)


def slugify(name: str) -> str:
    """URL/file-safe slug; keeps suffixes so 'Jaren Jackson Jr.' -> jaren-jackson-jr."""
    s = strip_accents(name).lower().replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def build_index(plist: list[dict]) -> dict[str, list[dict]]:
    idx: dict[str, list[dict]] = {}
    for p in plist:
        idx.setdefault(normalize(p["full_name"]), []).append(p)
    return idx


def pick(cands: list[dict]) -> dict:
    """Prefer an active player when a normalized name maps to several records."""
    active = [c for c in cands if c.get("is_active")]
    return (active or cands)[0]


def match_player(name, active_idx, all_idx, active_keys, all_keys):
    """Return (player_dict_or_None, how_str)."""
    if name in OVERRIDES:
        oid = OVERRIDES[name]
        rec = players.find_player_by_id(oid)
        return ({"id": oid, "full_name": rec["full_name"] if rec else name}, "override")

    norm = normalize(name)
    if norm in active_idx:
        return pick(active_idx[norm]), "exact"
    if norm in all_idx:
        return pick(all_idx[norm]), "exact(inactive)"

    # Fuzzy fallback: try active pool first, then the full historical list.
    for keys, idx, tag in ((active_keys, active_idx, "fuzzy"),
                           (all_keys, all_idx, "fuzzy(inactive)")):
        hit = process.extractOne(norm, keys, scorer=fuzz.WRatio, score_cutoff=FUZZY_CUTOFF)
        if hit:
            key, score, _ = hit
            return pick(idx[key]), f"{tag} {score:.0f} -> {idx[key][0]['full_name']!r}"
    return None, "UNMATCHED"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="match and report only; do not download or write pool.json")
    args = ap.parse_args()

    pool = json.loads(POOL_PATH.read_text())
    print(f"Loaded {len(pool)} players from {POOL_PATH.relative_to(ROOT)}")

    all_players = players.get_players()
    active = [p for p in all_players if p.get("is_active")]
    active_idx, all_idx = build_index(active), build_index(all_players)
    active_keys, all_keys = list(active_idx), list(all_idx)

    matched: list[tuple[dict, dict, str]] = []  # (pool_player, nba_record, slug)
    fuzzy_report: list[str] = []
    unmatched: list[str] = []

    for p in pool:
        rec, how = match_player(p["n"], active_idx, all_idx, active_keys, all_keys)
        if rec is None:
            unmatched.append(p["n"])
            continue
        slug = slugify(p["n"])
        matched.append((p, rec, slug))
        if how.startswith("fuzzy") or how == "override" or how.startswith("exact(inactive)"):
            fuzzy_report.append(f"  {p['n']!r}  [{how}]  id={rec['id']}")

    print(f"\nMatched {len(matched)}/{len(pool)}  (unmatched: {len(unmatched)})")
    if fuzzy_report:
        print("\nNon-exact / notable matches (please eyeball):")
        print("\n".join(fuzzy_report))
    if unmatched:
        print("\n*** UNMATCHED — resolve manually (add to OVERRIDES) ***")
        for n in unmatched:
            print(f"  - {n}")

    if args.dry_run:
        print("\n[dry-run] no downloads, pool.json unchanged.")
        return 0

    # --- Download headshots (skip existing, polite delay) ---
    HEADSHOT_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    downloaded = skipped = failed = 0
    for p, rec, slug in matched:
        dest = HEADSHOT_DIR / f"{slug}.png"
        p["img"] = f"headshots/{slug}.png"  # relative to the Vite public/ root
        if dest.exists():
            skipped += 1
            continue
        try:
            r = session.get(CDN_URL.format(id=rec["id"]), timeout=20)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
                dest.write_bytes(r.content)
                downloaded += 1
            else:
                failed += 1
                print(f"  ! {p['n']} (id {rec['id']}): HTTP {r.status_code}")
        except requests.RequestException as e:
            failed += 1
            print(f"  ! {p['n']} (id {rec['id']}): {e}")
        time.sleep(REQUEST_DELAY)

    print(f"\nHeadshots: downloaded={downloaded} skipped(existing)={skipped} failed={failed}")

    # --- Write pool.json back, preserving the original minified format ---
    POOL_PATH.write_text(json.dumps(pool, ensure_ascii=False, separators=(",", ":")))
    reparsed = json.loads(POOL_PATH.read_text())
    assert len(reparsed) == 300, f"expected 300 entries, got {len(reparsed)}"
    with_img = sum(1 for p in reparsed if p.get("img"))
    print(f"Wrote {POOL_PATH.relative_to(ROOT)}: {len(reparsed)} entries, {with_img} with img field.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
