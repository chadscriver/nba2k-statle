#!/usr/bin/env python3
"""Mine daily Gauntlet sets for 2K Statle.

Finds 8-player sets from the NORMAL pool (app/src/pool.json) whose OPTIMAL
arrangement across the 8 slots scores exactly 99 (unclamped, JS-rounding), and
ranks them by the gap to the second-best assignment. A 'strict' set is one
where the second-best assignment rounds below 99 — i.e. a single misplacement
kills the 99.

Usage (from repo root):
    python3 scripts/mine_dailies.py [--samples 20000] [--target 400] [--seed 1]

Output: app/src/dailies.json
    { "epoch": "2026-06-15", "generated": "...", "sets": [
        { "players": [8 names], "par": 99, "opt": 98.97, "gap": 1.12,
          "strict": true }, ... ] }

Runtime: roughly 20-40 minutes at default samples on a laptop. Progress prints
every 500 candidates. Safe to re-run; output is regenerated whole.

IMPORTANT: FORM below is a copy of the constant in app/src/App.jsx and must be
kept in sync if the app's formula is ever refit.
"""
import itertools
import json
import math
import os
import random
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
POOL_PATH = os.path.join(HERE, '..', 'app', 'src', 'pool.json')
OUT_PATH = os.path.join(HERE, '..', 'app', 'src', 'dailies.json')

EPOCH = '2026-06-15'
CATS = ['OUT', 'IN', 'PLY', 'ATH', 'DEF', 'REB']

FORM = {
  'PG': {'int': -2.23, 'ht': 0.0639, 'ig': 0.0535,
         'bw': {'OUT': 0.2537, 'IN': 0.0761, 'PLY': 0.1277, 'DEF': 0.187, 'REB': 0.1454},
         'w': {'OUT': [0.0512, 0.0379, 0.053, 0.0196, 0.038, 0.0787],
               'IN': [0.0398, 0.0076, 0.0139, 0, 0.0138, 0.0041, 0.0347, 0.0555],
               'PLY': [0.0631, 0, 0.037, 0.0347, 0.0521],
               'ATH': [0.0833, 0.0241, 0.0774, 0, 0, 0.0169, 0],
               'DEF': [0, 0.021, 0, 0, 0, 0.0543, 0.0126],
               'REB': [0, 0]}},
  'SG': {'int': -7.35, 'ht': 0.1685, 'ig': 0.0603,
         'bw': {'OUT': 0.2994, 'IN': 0.1535, 'PLY': 0.0864, 'DEF': 0.1739, 'REB': 0.1673},
         'w': {'OUT': [0.0311, 0.0786, 0.0537, 0.0424, 0.0552, 0.0527],
               'IN': [0.0724, 0.0286, 0, 0.0243, 0, 0, 0.014, 0.018],
               'PLY': [0.0714, 0.0087, 0.0869, 0.0097, 0],
               'ATH': [0, 0.0161, 0.0562, 0.0084, 0, 0.0249, 0.0196],
               'DEF': [0.0208, 0.0097, 0.0054, 0.0176, 0.0032, 0.043, 0.0119],
               'REB': [0.0119, 0.0106]}},
  'SF': {'int': 5.93, 'ht': 0.1729, 'ig': 0.0545,
         'bw': {'OUT': 0.4461, 'IN': 0.1413, 'PLY': 0, 'DEF': 0.199, 'REB': 0.0903},
         'w': {'OUT': [0.026, 0.0411, 0.0436, 0.0229, 0.0407, 0.0438],
               'IN': [0.0631, 0.0183, 0.0172, 0, 0, 0.0228, 0.049, 0.0025],
               'PLY': [0, 0.0209, 0, 0.0231, 0.0741],
               'ATH': [0.0275, 0, 0.0194, 0.0069, 0, 0.0164, 0.0395],
               'DEF': [0, 0.0024, 0.026, 0.0281, 0.0337, 0.0189, 0.0045],
               'REB': [0.0057, 0.0253]}},
  'PF': {'int': 10.36, 'ht': 0.1301, 'ig': 0.0526,
         'bw': {'OUT': 0.4539, 'IN': 0.1438, 'PLY': 0.0126, 'DEF': 0.1742, 'REB': 0.0626},
         'w': {'OUT': [0.0384, 0.0289, 0.0376, 0.0264, 0.0456, 0.0528],
               'IN': [0.0197, 0, 0.0363, 0.0592, 0, 0.0076, 0.0113, 0.0333],
               'PLY': [0.0054, 0.0381, 0.0196, 0.0109, 0.0168],
               'ATH': [0.0211, 0.0411, 0.0444, 0.0204, 0, 0, 0],
               'DEF': [0.0019, 0.0166, 0, 0.0115, 0, 0.0052, 0.0569],
               'REB': [0.0256, 0.0211]}},
  'C': {'int': 6.2, 'ht': 0.1718, 'ig': 0.0555,
        'bw': {'OUT': 0.3504, 'IN': 0.1481, 'PLY': 0.1141, 'DEF': 0.0262, 'REB': 0.1761},
        'w': {'OUT': [0.0112, 0.023, 0.0333, 0.0082, 0.02, 0.0817],
              'IN': [0.0491, 0, 0.0055, 0.0308, 0.026, 0, 0.0229, 0.0172],
              'PLY': [0.0133, 0, 0.0063, 0.0056, 0],
              'ATH': [0.0237, 0.0454, 0.0462, 0.0238, 0.0164, 0.014, 0.0158],
              'DEF': [0.0163, 0, 0.0224, 0, 0.0077, 0.0309, 0.0377],
              'REB': [0.0459, 0.046]}},
}

POSITIONS = list(FORM.keys())
PERMS = list(itertools.permutations(range(6)))  # 720


def js_round(x):
    """Match JS Math.round for positive values (half rounds up)."""
    return math.floor(x + 0.5)


def badge_pts(player, cat):
    bb = (player.get('b') or {}).get(cat) or [0, 0, 0, 0]
    return 4 * bb[0] + 3 * bb[1] + 2 * bb[2] + bb[3]


def main():
    args = sys.argv[1:]

    def arg(flag, default):
        return int(args[args.index(flag) + 1]) if flag in args else default

    samples = arg('--samples', 20000)
    target = arg('--target', 400)
    seed = arg('--seed', 1)
    random.seed(seed)

    pool = json.load(open(POOL_PATH, encoding='utf-8'))
    players = [p for p in pool
               if p.get('p') in FORM and isinstance(p.get('a'), dict)
               and all(c in p['a'] for c in CATS)]
    n = len(players)
    print(f'pool: {n} usable players (of {len(pool)})')

    # Precompute per-position contribution tables.
    # catv[pos][ci][i] = attribute dot + badge term for player i in category ci.
    # arch_t[pos][i] = height term if player i is the ARCH donor.
    # int_t[pos][i]  = intangibles term if player i is the INT donor.
    catv, arch_t, int_t = {}, {}, {}
    for pos in POSITIONS:
        f = FORM[pos]
        arch_t[pos] = [f['ht'] * p['hi'] for p in players]
        int_t[pos] = [f['ig'] * p['ig'] for p in players]
        catv[pos] = []
        for c in CATS:
            w = f['w'][c]
            bw = f['bw'].get(c)
            col = []
            for p in players:
                v = sum(wi * ai for wi, ai in zip(w, p['a'][c]))
                if bw is not None:
                    v += bw * badge_pts(p, c)
                col.append(v)
            catv[pos].append(col)

    hits, seen = [], set()
    skipped = 0
    t0 = time.time()
    local6 = list(range(6))

    for it in range(1, samples + 1):
        cand = random.sample(range(n), 8)
        key = frozenset(cand)
        if key in seen:
            continue
        seen.add(key)

        # Relaxed upper bound (allows donor reuse): skip hopeless sets fast.
        feasible = False
        for ai in range(8):
            pos = players[cand[ai]]['p']
            others = [g for k, g in enumerate(cand) if k != ai]
            ub = (FORM[pos]['int'] + arch_t[pos][cand[ai]]
                  + max(int_t[pos][g] for g in others)
                  + sum(max(catv[pos][ci][g] for g in others) for ci in range(6)))
            if ub >= 98.5:
                feasible = True
                break
        if not feasible:
            skipped += 1
            continue

        best, second = -1e18, -1e18
        for ai in range(8):
            pos = players[cand[ai]]['p']
            f_int = FORM[pos]['int']
            M = [[catv[pos][ci][g] for ci in range(6)] for g in cand]
            it_loc = [int_t[pos][g] for g in cand]
            const_a = f_int + arch_t[pos][cand[ai]]
            for ii in range(8):
                if ii == ai:
                    continue
                base2 = const_a + it_loc[ii]
                rest = [k for k in range(8) if k != ai and k != ii]
                for perm in PERMS:
                    s = (base2
                         + M[rest[perm[0]]][0] + M[rest[perm[1]]][1]
                         + M[rest[perm[2]]][2] + M[rest[perm[3]]][3]
                         + M[rest[perm[4]]][4] + M[rest[perm[5]]][5])
                    if s > best:
                        second = best
                        best = s
                    elif s > second:
                        second = s

        if js_round(best) == 99:
            hits.append({
                'players': [players[g]['n'] for g in cand],
                'par': 99,
                'opt': round(best, 3),
                'gap': round(best - second, 3),
                'strict': second < 98.5,
            })

        if it % 500 == 0:
            el = time.time() - t0
            print(f'{it}/{samples}  hits={len(hits)}  '
                  f'strict={sum(1 for h in hits if h["strict"])}  '
                  f'bound-skipped={skipped}  {el:.0f}s  '
                  f'eta {el / it * (samples - it):.0f}s', flush=True)

    hits.sort(key=lambda h: h['gap'], reverse=True)
    out_sets = hits[:target]
    random.shuffle(out_sets)  # avoid difficulty drifting monotonically by date

    out = {'epoch': EPOCH,
           'generated': time.strftime('%Y-%m-%dT%H:%M:%S'),
           'sets': out_sets}
    json.dump(out, open(OUT_PATH, 'w', encoding='utf-8'), separators=(',', ':'))

    strict_n = sum(1 for h in out_sets if h['strict'])
    print(f'\nwrote {len(out_sets)} sets to {os.path.relpath(OUT_PATH)}')
    print(f'strict one-mistake-kills sets: {strict_n}/{len(out_sets)}')
    if out_sets:
        gaps = [h['gap'] for h in out_sets]
        print(f'gap range kept: {min(gaps):.2f} .. {max(gaps):.2f}')
    if len(out_sets) < target:
        print(f'WARNING: only {len(out_sets)} qualifying sets found; '
              f're-run with a larger --samples to reach {target}.')


if __name__ == '__main__':
    main()
