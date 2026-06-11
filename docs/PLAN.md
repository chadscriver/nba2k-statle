# 2K Statle — Feature Implementation Plan (v2)

Executor: Claude Code. Author: Claude (chat session). Every design decision in this
document is FROZEN — implement as specified, do not redesign, do not add features.
Where this doc references data file shapes (teams.json, pool entries), reconcile
against the actual files you generated — adapt lookups to reality, not vice versa.

## Global guardrails
- The FORM constant and the scoring math in App.jsx must produce IDENTICAL numbers
  to today. New code may call shared helpers, but no weight, term, or rounding rule
  changes.
- Keep the NBA Broadcast theme exactly: existing color constants (C_ACCENT navy
  #1D428A structural, C_RED #C8102E CTA-only), Archivo font, existing card/border/
  shadow patterns. New UI reuses existing button classes (btn-red, btn-ghost) and
  card styles.
- No new npm dependencies.
- `npm run build` must pass after EVERY commit. Commit after each numbered section
  below, push after all four.
- Asset paths always via `BASE` (import.meta.env.BASE_URL).
- All new images get onError-hide like the existing Headshot component.

## Commit 1 — Mode switcher, pools, team logos

1. Mode state: `mode` ∈ 'normal' | 'hard' | 'legends' (commit 4 adds 'daily').
   Persist to localStorage key `statle.mode`. Default 'normal'.
2. Pool loading: pool.json (normal), pool_full.json (hard), pool_legends.json
   (legends). Lazy-load hard/legends with dynamic `import()` so the initial bundle
   stays light; normal can stay static. Loading state: disable Spin until loaded.
3. Switcher UI: segmented control in the header row (next to the "x/8 locked"
   pill): small uppercase buttons NORMAL · HARD · LEGENDS, 10px, letterspaced;
   active = navy bg + white text, inactive = ghost. Switching mid-game (any slot
   locked) requires window.confirm("Abandon this build?"). Switching resets the
   game but preserves mode. "Build again" / Reset preserve mode.
4. Hard mode = full-league pool, otherwise identical rules (2 re-rolls). Legends =
   classic pool, identical rules. Legends entries have era-tagged names and
   classic team labels — the UI needs no special casing beyond logo lookup.
5. Team logos: static-import app/src/teams.json. Wherever a team name renders:
   - Spin/roll card team line: 16px logo inline before the team text.
   - Slot cards: 12px logo inline before the player name.
   Lookup by the entry's `tm` string against teams.json (reconcile key format
   against the real file). Missing/failed logo = render nothing.

## Commit 2 — Solver, best-possible modal, efficiency, perfect games

1. Add the shared scoring + solver code below VERBATIM (adjust only if pool field
   names differ in reality). Do not reimplement the math your own way.

```js
const CAT_KEYS = ['OUT', 'IN', 'PLY', 'ATH', 'DEF', 'REB'];

function badgePts(pl, cat) {
  const bb = (pl.b && pl.b[cat]) || [0, 0, 0, 0];
  return 4 * bb[0] + 3 * bb[1] + 2 * bb[2] + bb[3];
}

// arch, intp: pool entries; cats: array of 6 pool entries aligned with CAT_KEYS.
// Returns the unclamped, unrounded build score.
function scoreArrangement(arch, intp, cats) {
  const f = FORM[arch.p];
  let base = f.int + f.ht * arch.hi + f.ig * intp.ig;
  for (let ci = 0; ci < 6; ci++) {
    const c = CAT_KEYS[ci], pl = cats[ci], w = f.w[c], a = pl.a[c];
    for (let i = 0; i < w.length; i++) base += w[i] * a[i];
    if (f.bw[c] !== undefined) base += f.bw[c] * badgePts(pl, c);
  }
  return base;
}

function permute6(arr, cb) {
  const a = arr.slice(), n = a.length;
  const rec = (k) => {
    if (k === n) { cb(a); return; }
    for (let i = k; i < n; i++) {
      [a[k], a[i]] = [a[i], a[k]]; rec(k + 1); [a[k], a[i]] = [a[i], a[k]];
    }
  };
  rec(0);
}

// players: exactly 8 pool entries. Brute-forces all 8*7*720 = 40,320 assignments.
function bestArrangement(players) {
  let best = -Infinity, asg = null;
  for (let ai = 0; ai < 8; ai++) {
    for (let ii = 0; ii < 8; ii++) {
      if (ii === ai) continue;
      const rest = [];
      for (let k = 0; k < 8; k++) if (k !== ai && k !== ii) rest.push(k);
      permute6(rest, (perm) => {
        const s = scoreArrangement(players[ai], players[ii],
          [players[perm[0]], players[perm[1]], players[perm[2]],
           players[perm[3]], players[perm[4]], players[perm[5]]]);
        if (s > best) { best = s; asg = { arch: ai, int: ii, cats: perm.slice() }; }
      });
    }
  }
  return { score: best,
           overall: Math.max(0, Math.min(99, Math.round(best))), asg };
}
```

2. On game completion compute: `userScore` = scoreArrangement of the user's actual
   arch/int/cat assignment; `bestRes` = bestArrangement of the same 8 locked
   players (re-rolled-away players are NOT included — only locked ones).
   `perfect` = userScore >= bestRes.score - 1e-6.
   `eff` = Math.round(100 * userScore / bestRes.score).
3. End-screen header gains one line under the Height/Weight/Wingspan block:
   - if perfect: "Perfect build" in C_RED, bold.
   - else: "Best possible: {bestRes.overall} — you left
     {(bestRes.overall - yourOverall)} on the table" in C_MUTED, with the points
     figure bold.
4. Button "See best build" (btn-ghost) next to "Build again" → opens a modal:
   fixed overlay (rgba(10,27,61,0.55) backdrop), white card (existing card style,
   max-width 520, max-height 80vh, scroll), title "Best possible build —
   {bestRes.overall} OVR". One row per slot in SLOTS order: slot label (uppercase
   eyebrow style) | your player name | optimal player name. Rows where they differ
   get a 3px C_RED left border. Rows where they match render the name once with a
   small "✓". Close: X button top-right + backdrop click. The modal is the ONLY
   place the optimal lineup is itemized; the end card stays uncluttered.

## Commit 3 — Archive, stats, share

1. localStorage schema (exact):
   - `statle.games`: JSON array, newest first, capped at 200 entries:
     `{ id, dateISO, mode, overall, best, eff, perfect, rerolls, seed, daily,
        slots: { ARCH: name, OUT: name, IN: name, PLY: name, ATH: name,
                 DEF: name, REB: name, INT: name } }`
     (seed: string|null, daily: number|null). Push on every completed game.
   - `statle.daily`: `{ streak, lastDaily, results: { [n]: { overall, best,
     perfect } } }` (used in commit 4).
2. Header gains a "Stats" btn-ghost button (next to Reset) → modal (same overlay
   pattern): games played, best overall per mode, average efficiency, perfect-game
   count, current daily streak, then the 10 most recent games as compact rows
   (date · mode · overall vs best · ✓ if perfect).
3. Share: end card gains a "Share" button (btn-red secondary to Build again —
   make Share btn-ghost to keep one red CTA). Builds this exact text:

```
2K STATLE — {overall} OVR (best {best})
{eight emoji squares}
https://chadscriver.github.io/nba2k-statle/
```

   Squares in SLOTS order using: ARCH → bucket(player.o), category slots →
   bucket(pl.c[ci]), INT → bucket(pl.ig), where
   `bucket(v) = v>=90 ? '🟪' : v>=80 ? '🟨' : v>=70 ? '⬜' : '🟫'`.
   Use navigator.share if available, else navigator.clipboard.writeText and flip
   the button label to "Copied!" for 1.5s.

## Commit 4 — Daily Gauntlet, mining, challenge links

1. Run `python3 scripts/mine_dailies.py` from the repo root (written by chat
   session; takes 20–40 min; configurable via `--samples N`). Commit the
   resulting app/src/dailies.json. If strict-uniqueness yield is reported low,
   that is expected and fine — proceed.
2. DAILY joins the mode switcher. Mechanics (FROZEN):
   - DAILY_EPOCH = '2026-06-15' (daily #1). n = days between local midnight of
     epoch and local midnight of today, +1. Today's set =
     dailies.sets[(n-1) % dailies.sets.length]. Resolve player names against the
     NORMAL pool; if any name is missing (pool drift), advance to the next set
     index and console.warn.
   - Par = the app's OWN bestArrangement(players8).overall recomputed at load —
     do not trust the JSON's stored value for display.
   - Presentation order: shuffled with Math.random per attempt (every user/attempt
     gets a different order — this is intentional spoiler-proofing).
   - Flow: no free spinning and NO re-rolls (hide the buttons). Button reads
     "Reveal next player"; revealed player must be locked into a slot before the
     next reveal enables. 8 reveals, 8 locks, then the end screen with par
     framing: overall shown as "{overall} / par {par}".
   - One counting attempt per day, consumed at the FIRST lock. Persist
     `statle.dailyInProgress` = { n, order, slots } on every lock so refresh
     resumes instead of resetting (this also kills order-scumming). On completion
     write to statle.daily.results, update streak (consecutive n values
     completed), clear dailyInProgress, and push to statle.games with daily: n.
   - If today's n is already in results: show the result summary + a "Practice"
     replay (new shuffle) with a persistent banner "Practice — doesn't count";
     practice games are not recorded anywhere.
   - Daily share string first line instead: `2K STATLE Daily #{n} — {overall}/{par}`.
3. Challenge links (endless modes only, not daily):
   - Add VERBATIM:

```js
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

   - Every endless game gets a seed: from URL `?seed=` if present, else a random
     6-char alphanumeric. `rng = mulberry32(xmur3(seed)())`. ALL endless-mode
     randomness (spin candidate picks, the spinning flash, re-roll picks) draws
     from rng instead of Math.random. Same seed + same choices = same players.
   - On load with ?seed (and optional &mode=hard|legends|normal): set mode, show a
     small banner line above the roll zone: "Challenge seed {seed}".
   - End card gains "Challenge a friend" (btn-ghost): copies
     `{origin}{pathname}?seed={seed}&mode={mode}` to clipboard, label flips to
     "Link copied!".

## Final
- Update README.md with the new modes, scripts, and localStorage keys.
- Push. The GitHub Action build is the final gate.
