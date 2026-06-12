# 2K Statle — Mobile Layout Fix (frozen spec)

Executor: Claude Code. Decisions are FROZEN; reconcile element/variable names
against the current App.jsx, do not redesign. `npm run build` must pass.
Desktop (>600px) must look IDENTICAL to today — every change below is gated on
mobile except item 6.

## 1. useIsMobile hook (verbatim)

```js
function useIsMobile() {
  const [m, setM] = useState(() => window.matchMedia('(max-width: 600px)').matches);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 600px)');
    const fn = (e) => setM(e.matches);
    q.addEventListener('change', fn);
    return () => q.removeEventListener('change', fn);
  }, []);
  return m;
}
```

Call once in App: `const isMobile = useIsMobile();`

## 2. Sticky bottom action bar (mobile only) — the core fix

- Move the Spin button into a container div with className "actionbar".
- Desktop: .actionbar has no special styling — the button renders exactly where
  it is today.
- Mobile CSS:

```css
@media (max-width: 600px) {
  .actionbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    background: #FFFFFF; border-top: 1px solid #D4DCEC;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
    box-shadow: 0 -6px 16px rgba(10, 27, 61, 0.08);
  }
  .actionbar button { width: 100%; }
  .page-wrap { padding-bottom: 84px; }
}
```

- Add className "page-wrap" to the app's outermost content container so the
  fixed bar never covers the last row of slot cards.
- If the locked-count pill ("x/8 locked") fits naturally inside the bar next to
  the button, include it left of the button at mobile; otherwise leave it in
  the header. Do not move Reset/Stats into the bar.
- In Daily mode the same bar holds the "Reveal next player" button.

## 3. Roll card — mobile layout (fixes the jumble)

Keep the desktop single-row layout untouched. On mobile (isMobile), render the
roll card as two stacked rows:

- Row 1: Headshot size 52 · name column (minWidth: 0, flex: 1) · OVR pill only.
  - Eyebrow ("YOU ROLLED" / "Spinning…"): fontSize 9, whiteSpace: 'nowrap'.
  - Name: fontSize 15, fontWeight 800, ellipsis. THE NAME MUST NEVER COLLAPSE —
    the right side of row 1 is only the single OVR pill (flexShrink: 0), so the
    name column always gets the remaining width.
  - Team line under name: fontSize 10.
- Row 2 (marginTop 8, only when a player is showing): position pill, height
  pill, weight pill (fontSize 10, padding 2px 6px), then the two re-roll
  buttons. Buttons: flex: 1, fontSize 11, padding 6px 4px, so the pair fills
  the remaining row width. Allow row 2 to wrap (flexWrap) on very narrow
  screens.
- .rollzone on mobile stays height: auto with min-height — update the existing
  media query value to match the new natural two-row height so the layout does
  not jump between empty/spinning/rolled states (measure: ~118px).

## 4. Slot cards — mobile sizes

When isMobile, use these values (desktop values in parentheses stay as-is):
- card minHeight 136 (172), padding 10 (12)
- Headshot size 56 (88)
- rating / position number in header: fontSize 22 (26 / 22)
- slot label: fontSize 10 (11)
- ARCH spec lines (HT/WT/WS) and player name: unchanged sizes.
- TierPills circles: 13px (15) with fontSize 8.

## 5. Instructions paragraph — collapse after first game

- If localStorage statle.games has at least one entry, render a single muted
  line "How to play" (fontSize 12, C_ACCENT, cursor pointer) instead of the
  paragraph; tapping toggles the full paragraph open/closed (useState, default
  closed). Applies on ALL viewports.
- If no games played yet, show the full paragraph as today, but on mobile at
  fontSize 12 / lineHeight 1.5.

## 6. Small fixes (all viewports unless noted)

- Mode switcher row: overflow-x auto, no wrapping (mobile).
- All modals (Stats, Best build): width min(520px, calc(100vw - 24px)).
- Verify the header row wraps cleanly at 390px wide; if the wordmark and
  switcher collide, switcher drops to its own line below the wordmark.

## Acceptance test (iPhone-width, 390px)

1. Spin button visible at all times (sticky bar), including mid-scroll.
2. Roll a player: headshot, full name (ellipsized if long), team, OVR, and both
   re-roll buttons all visible without horizontal overflow.
3. All 8 slot cards + roll card + header fit in ~2.5 screen heights.
4. Lock 8 slots, open Best build modal: fits viewport, scrolls internally.
5. Desktop at 1280px: pixel-identical to current production.
