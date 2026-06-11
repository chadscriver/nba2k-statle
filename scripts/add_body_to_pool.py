#!/usr/bin/env python3
"""Merge weight + wingspan from data/nba2k26.csv into app/src/pool.json.

Adds two fields per player:
  wt - weight in lbs (int), e.g. 284
  ws - wingspan display string, e.g. 7'3"

The UI renders these conditionally, so running this is safe at any time
and re-running it is idempotent.

Run from the repo root:  python3 scripts/add_body_to_pool.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, '..', 'data', 'nba2k26.csv')
POOL_PATH = os.path.join(HERE, '..', 'app', 'src', 'pool.json')

rows = {}
with open(CSV_PATH, newline='', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        rows[r['name']] = r

with open(POOL_PATH, encoding='utf-8') as f:
    pool = json.load(f)

hit, miss = 0, []
for p in pool:
    r = rows.get(p['n'])
    if not r:
        miss.append(p['n'])
        continue
    w = (r.get('weight_lbs') or '').strip()
    ws = (r.get('wingspan') or '').strip()
    if w:
        try:
            p['wt'] = int(float(w))
        except ValueError:
            pass
    if ws:
        p['ws'] = ws
    hit += 1

with open(POOL_PATH, 'w', encoding='utf-8') as f:
    json.dump(pool, f, separators=(',', ':'), ensure_ascii=False)

print(f"updated {hit}/{len(pool)} players")
print("missing from CSV:", ", ".join(miss) if miss else "none")
