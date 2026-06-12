#!/usr/bin/env python3
"""Remove NBA-CDN placeholder silhouettes from app/public/headshots.

The NBA headshot CDN returns a generic gray silhouette PNG (HTTP 200,
content-type image/png) for player IDs that have no digitized photo, so
fetch_headshots.py saved those placeholders as if they were real headshots.
All placeholder files are byte-identical, so they form large clusters of
files with the same hash. Real photos are never byte-identical across
different players.

This script hashes every PNG, deletes every cluster of >= MIN_CLUSTER
identical files, and reports what's left. After running it, re-run
scripts/build_pools.py so the pruned players lose their img field and the
app falls back to the era team-logo portrait.

Usage (from repo root):
    python3 scripts/prune_silhouettes.py --dry-run   # report only
    python3 scripts/prune_silhouettes.py             # delete + report
"""
import argparse
import hashlib
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
HEADSHOTS = os.path.join(HERE, "..", "app", "public", "headshots")
MIN_CLUSTER = 5  # a hash shared by this many files can only be a placeholder


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="report only, delete nothing")
    args = ap.parse_args()

    files = [f for f in os.listdir(HEADSHOTS) if f.endswith(".png")]
    clusters = defaultdict(list)
    for f in files:
        with open(os.path.join(HEADSHOTS, f), "rb") as fh:
            clusters[hashlib.md5(fh.read()).hexdigest()].append(f)

    placeholders = {h: fs for h, fs in clusters.items() if len(fs) >= MIN_CLUSTER}
    n_del = sum(len(fs) for fs in placeholders.values())

    print(f"headshot files on disk : {len(files)}")
    print(f"placeholder clusters   : {len(placeholders)}")
    print(f"placeholder files      : {n_del}")
    print(f"real photos remaining  : {len(files) - n_del}")
    for h, fs in placeholders.items():
        sample = ", ".join(sorted(fs)[:8])
        print(f"  cluster {h[:8]} x{len(fs)}: {sample}{' ...' if len(fs) > 8 else ''}")

    if args.dry_run:
        print("\n[dry-run] nothing deleted.")
        return
    for fs in placeholders.values():
        for f in fs:
            os.remove(os.path.join(HEADSHOTS, f))
    print(f"\ndeleted {n_del} placeholder files.")
    print("now run: python3 scripts/build_pools.py  (then commit & push)")


if __name__ == "__main__":
    main()
