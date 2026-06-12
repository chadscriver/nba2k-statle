# 2K Statle — Polish Pass 2 (frozen spec)

Executor: Claude Code. Decisions are FROZEN. Reconcile names/structure against
current App.jsx; make no design decisions of your own. Desktop and mobile both
affected where noted. `npm run build` must pass; commit and push when done.

## 1. Short team labels for classic teams

Add verbatim near the other constants:

```js
const FR_ABBR = {
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN',
  'New Jersey Nets': 'NJN', 'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI',
  'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS', 'Seattle Supersonics': 'SEA', 'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
};

// "1986-87 Los Angeles Lakers" -> "'87 LAL"; current abbrevs pass through.
function shortTm(tm) {
  const m = /^(\d{4})-(\d{2})\s+(.+)$/.exec(tm || '');
  if (!m) return tm;
  return `'${m[2]} ${FR_ABBR[m[3]] || m[3]}`;
}
```

Use `shortTm(pending.tm)` in the team re-roll button label ("Re-roll '87 LAL")
on ALL viewports. Also use shortTm for the team text line in the ROLL CARD when
the label matches the classic pattern (so "1986-87 Los Angeles Lakers" never
wraps); slot cards have no team text, no change there.

## 2. Headshot component — kill the visible behind-logo

NBA headshots are transparent PNGs, so the under-layer logo currently shows
through behind the player's head, doubling with the corner badge. Fix:

- The fallback logo img inside the clipped layer gets
  `style={{ ..., display: hs ? 'none' : 'block' }}` plus attribute
  `data-fallbacklogo="1"`.
- The headshot img's onError handler additionally reveals it:
  `const fb = wrap && wrap.querySelector('[data-fallbacklogo]'); if (fb) fb.style.display = 'block';`
- Net behavior: photo present = photo + corner badge only (clean background);
  photo missing/404 = big logo portrait, no badge. Nothing else changes.

## 3. Best-build modal — full redesign (replaces current row layout)

Eight rows, one per slot, in SLOTS order. Each row:

- Line 1: slot label, eyebrow style (fontSize 9, uppercase, letterSpacing
  0.06em, C_MUTED).
- Line 2: a 3-column grid `gridTemplateColumns: '1fr 18px 1fr'`, gap 6,
  alignItems center:
  - LEFT: the user's pick as a mini-card: 26px headshot (plain img from
    headshotSrc, borderRadius 7, onError hide) + column of: player name
    (fontSize 10, lineHeight 1.25, fontWeight 600, **wrapping allowed up to 2
    lines, NO ellipsis** — names must read fully on mobile) and the slot value
    underneath (fontSize 12, fontWeight 800; cat slots = pl.c[ci] in
    numColor, INT = ig in numColor, ARCH = position text).
  - MIDDLE: an arrow "→" (fontSize 14, fontWeight 800).
  - RIGHT: same mini-card structure for the comparison player.
- CORRECT pick (user's player === optimal player for that slot): arrow color
  #15803D (green); RIGHT shows the same player again, full color (yes,
  duplicated — intentional).
- WRONG pick: LEFT mini-card greyed — img gets `filter: 'grayscale(1)',
  opacity: 0.5`, text color C_MUTED; arrow color C_RED; RIGHT shows the
  optimal player full color.
- Modal width: min(440px, calc(100vw - 24px)); rows separated by 1px C_BORDER
  hairlines; internal scroll as today. Title unchanged.
- Acceptance: at 390px viewport every name renders completely (wrapped, not
  truncated).

## 4. End card copy

Remove the "— you left N on the table" phrasing entirely. Non-perfect games
show just: `Best possible: {best}` (same muted style). Perfect games keep
"Perfect build" in C_RED. Share strings unchanged.

## 5. Mobile: pin the roll card

Add to the mobile media query in index.css:

```css
@media (max-width: 600px) {
  .rollzone { position: sticky; top: 0; z-index: 40; background: #F4F6FB; padding-top: 6px; }
}
```

Combined with the bottom action bar, the rolled player and the Spin/Reveal
button are BOTH always visible while scrolling the slot grid. Verify the slot
cards scroll underneath cleanly and slot hover/press states aren't broken by
the z-index.

## Acceptance (390px)

1. Legends re-roll buttons render one line: "Re-roll '87 LAL".
2. No logo visible behind any player photo; corner badge only. Missing-photo
   players show the big logo portrait with no badge.
3. Best-build modal: 8 labeled rows, full names visible (wrapped), grey/red
   for misses, green for correct, fits without horizontal scroll.
4. Scroll mid-game: roll card pinned top, action bar pinned bottom.
5. Desktop unchanged except items 1–4.
