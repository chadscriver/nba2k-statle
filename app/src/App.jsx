import React, { useState, useEffect, useRef } from 'react';
import { Dice5, RotateCcw } from 'lucide-react';
import POOL from './pool.json';

const CATS = [
  { key: 'OUT', name: 'Outside Scoring', short: 'Outside', ci: 0 },
  { key: 'IN', name: 'Inside Scoring', short: 'Inside', ci: 1 },
  { key: 'PLY', name: 'Playmaking', short: 'Playmaking', ci: 2 },
  { key: 'ATH', name: 'Athleticism', short: 'Athleticism', ci: 3 },
  { key: 'DEF', name: 'Defense', short: 'Defense', ci: 4 },
  { key: 'REB', name: 'Rebounding', short: 'Rebounding', ci: 5 },
];
const SUBS = {
  OUT: ['Three-Point Shot', 'Mid-Range Shot', 'Close Shot', 'Free Throw', 'Offensive Consistency', 'Shot IQ'],
  IN: ['Layup', 'Driving Dunk', 'Standing Dunk', 'Post Hook', 'Post Fade', 'Post Control', 'Draw Foul', 'Hands'],
  PLY: ['Ball Handle', 'Speed with Ball', 'Pass Accuracy', 'Pass Vision', 'Pass IQ'],
  ATH: ['Speed', 'Strength', 'Agility', 'Vertical', 'Hustle', 'Stamina', 'Overall Durability'],
  DEF: ['Block', 'Steal', 'Pass Perception', 'Interior Defense', 'Perimeter Defense', 'Help Defense IQ', 'Defensive Consistency'],
  REB: ['Defensive Rebound', 'Offensive Rebound'],
};
const FORM = {
  PG: { int: -2.23, ht: 0.0639, ig: 0.0535, bw: { OUT: 0.2537, IN: 0.0761, PLY: 0.1277, DEF: 0.187, REB: 0.1454 }, w: { OUT: [0.0512, 0.0379, 0.053, 0.0196, 0.038, 0.0787], IN: [0.0398, 0.0076, 0.0139, 0, 0.0138, 0.0041, 0.0347, 0.0555], PLY: [0.0631, 0, 0.037, 0.0347, 0.0521], ATH: [0.0833, 0.0241, 0.0774, 0, 0, 0.0169, 0], DEF: [0, 0.021, 0, 0, 0, 0.0543, 0.0126], REB: [0, 0] } },
  SG: { int: -7.35, ht: 0.1685, ig: 0.0603, bw: { OUT: 0.2994, IN: 0.1535, PLY: 0.0864, DEF: 0.1739, REB: 0.1673 }, w: { OUT: [0.0311, 0.0786, 0.0537, 0.0424, 0.0552, 0.0527], IN: [0.0724, 0.0286, 0, 0.0243, 0, 0, 0.014, 0.018], PLY: [0.0714, 0.0087, 0.0869, 0.0097, 0], ATH: [0, 0.0161, 0.0562, 0.0084, 0, 0.0249, 0.0196], DEF: [0.0208, 0.0097, 0.0054, 0.0176, 0.0032, 0.043, 0.0119], REB: [0.0119, 0.0106] } },
  SF: { int: 5.93, ht: 0.1729, ig: 0.0545, bw: { OUT: 0.4461, IN: 0.1413, PLY: 0, DEF: 0.199, REB: 0.0903 }, w: { OUT: [0.026, 0.0411, 0.0436, 0.0229, 0.0407, 0.0438], IN: [0.0631, 0.0183, 0.0172, 0, 0, 0.0228, 0.049, 0.0025], PLY: [0, 0.0209, 0, 0.0231, 0.0741], ATH: [0.0275, 0, 0.0194, 0.0069, 0, 0.0164, 0.0395], DEF: [0, 0.0024, 0.026, 0.0281, 0.0337, 0.0189, 0.0045], REB: [0.0057, 0.0253] } },
  PF: { int: 10.36, ht: 0.1301, ig: 0.0526, bw: { OUT: 0.4539, IN: 0.1438, PLY: 0.0126, DEF: 0.1742, REB: 0.0626 }, w: { OUT: [0.0384, 0.0289, 0.0376, 0.0264, 0.0456, 0.0528], IN: [0.0197, 0, 0.0363, 0.0592, 0, 0.0076, 0.0113, 0.0333], PLY: [0.0054, 0.0381, 0.0196, 0.0109, 0.0168], ATH: [0.0211, 0.0411, 0.0444, 0.0204, 0, 0, 0], DEF: [0.0019, 0.0166, 0, 0.0115, 0, 0.0052, 0.0569], REB: [0.0256, 0.0211] } },
  C: { int: 6.2, ht: 0.1718, ig: 0.0555, bw: { OUT: 0.3504, IN: 0.1481, PLY: 0.1141, DEF: 0.0262, REB: 0.1761 }, w: { OUT: [0.0112, 0.023, 0.0333, 0.0082, 0.02, 0.0817], IN: [0.0491, 0, 0.0055, 0.0308, 0.026, 0, 0.0229, 0.0172], PLY: [0.0133, 0, 0.0063, 0.0056, 0], ATH: [0.0237, 0.0454, 0.0462, 0.0238, 0.0164, 0.014, 0.0158], DEF: [0.0163, 0, 0.0224, 0, 0.0077, 0.0309, 0.0377], REB: [0.0459, 0.046] } },
};
const HT_MEAN = { PG: 74.8, SG: 76.7, SF: 78.5, PF: 80.1, C: 82.6 };
const POS_NAME = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };
const TIERS = ['HOF', 'Gold', 'Silver', 'Bronze'];
const TIER_COLOR = ['#7E22CE', '#CA8A04', '#6B7280', '#92400E'];

const SLOTS = [
  { id: 'ARCH', kind: 'arch', label: 'Position & Frame' },
  { id: 'OUT', kind: 'cat', ci: 0, label: 'Outside Scoring' },
  { id: 'IN', kind: 'cat', ci: 1, label: 'Inside Scoring' },
  { id: 'PLY', kind: 'cat', ci: 2, label: 'Playmaking' },
  { id: 'ATH', kind: 'cat', ci: 3, label: 'Athleticism' },
  { id: 'DEF', kind: 'cat', ci: 4, label: 'Defense' },
  { id: 'REB', kind: 'cat', ci: 5, label: 'Rebounding' },
  { id: 'INT', kind: 'int', label: 'Intangibles' },
];

const SHADOW = '0 1px 2px rgba(10,27,61,0.05), 0 12px 28px -16px rgba(10,27,61,0.16)';
const C_BG = '#F4F6FB', C_SURFACE = '#FFFFFF', C_SURFACE2 = '#EEF2F9', C_BORDER = '#D4DCEC', C_TEXT = '#0A1B3D', C_MUTED = '#5C6B8C', C_ACCENT = '#1D428A', C_RED = '#C8102E';

function chipColor(v) { if (v >= 80) return '#16A34A'; if (v >= 70) return '#84CC16'; if (v >= 60) return '#F59E0B'; return '#EF4444'; }
function chipText(v) { return (v >= 60 && v < 80) ? '#1a1206' : '#ffffff'; }
function numColor(v) { if (v >= 80) return '#15803D'; if (v >= 70) return '#4D7C0F'; if (v >= 60) return '#B45309'; return '#B91C1C'; }
function tierFor(o) {
  if (o >= 95) return 'Franchise cornerstone';
  if (o >= 90) return 'All-Star';
  if (o >= 85) return 'Quality starter';
  if (o >= 80) return 'Solid rotation';
  if (o >= 75) return 'Role player';
  return 'End of bench';
}

function Chip({ v, big }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: big ? 34 : 26, height: big ? 28 : 22, padding: '0 6px', borderRadius: 5, background: chipColor(v), color: chipText(v), fontSize: big ? 15 : 12, fontWeight: 700 }}>{v}</span>
  );
}

function BadgeLine({ counts }) {
  const items = counts.map((n, i) => ({ n, i })).filter((x) => x.n > 0);
  if (items.length === 0) return <div style={{ fontSize: 11, color: C_MUTED, marginTop: 6 }}>No badges</div>;
  return (
    <div className="flex items-center" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
      {items.map((x) => (
        <span key={x.i} style={{ fontSize: 10, fontWeight: 700, color: TIER_COLOR[x.i], border: `1px solid ${TIER_COLOR[x.i]}`, borderRadius: 4, padding: '1px 5px' }}>
          {x.n} {TIERS[x.i]}
        </span>
      ))}
    </div>
  );
}

function TierPills({ counts }) {
  const items = counts.map((n, i) => ({ n, i })).filter((x) => x.n > 0);
  if (items.length === 0) return <div style={{ fontSize: 9, color: C_MUTED, marginTop: 4 }}>no badges</div>;
  return (
    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
      {items.map((x) => (
        <span key={x.i} title={TIERS[x.i]} style={{ width: 15, height: 15, borderRadius: '50%', background: TIER_COLOR[x.i], color: '#fff', fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{x.n}</span>
      ))}
    </div>
  );
}

export default function App() {
  const [slots, setSlots] = useState({});
  const [pending, setPending] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState(null);
  const [phase, setPhase] = useState('play');
  const [rerolls, setRerolls] = useState({ team: true, any: true });
  const [lastLock, setLastLock] = useState(null);
  const [disp, setDisp] = useState(0);
  const iv = useRef(null), to = useRef(null);

  function cleanup() { clearInterval(iv.current); clearTimeout(to.current); }
  function newGame() { cleanup(); setSlots({}); setPending(null); setSpinning(false); setFlash(null); setPhase('play'); setRerolls({ team: true, any: true }); setLastLock(null); setDisp(0); }
  useEffect(() => { newGame(); return cleanup; }, []);

  const usedNames = Object.values(slots).filter(Boolean).map((p) => p.n);
  const filled = SLOTS.filter((s) => slots[s.id]).length;

  function runSpin(cands) {
    if (cands.length === 0) return;
    setPending(null);
    setSpinning(true);
    setFlash(cands[Math.floor(Math.random() * cands.length)]);
    iv.current = setInterval(() => setFlash(cands[Math.floor(Math.random() * cands.length)]), 70);
    to.current = setTimeout(() => {
      clearInterval(iv.current);
      setPending(cands[Math.floor(Math.random() * cands.length)]);
      setFlash(null);
      setSpinning(false);
    }, 900 + Math.random() * 500);
  }

  function spin() {
    if (spinning || pending || phase === 'done') return;
    runSpin(POOL.filter((p) => !usedNames.includes(p.n)));
  }

  function assign(id) {
    if (!pending || slots[id]) return;
    const ns = { ...slots, [id]: pending };
    setSlots(ns);
    setPending(null);
    setLastLock(id);
    if (SLOTS.every((s) => ns[s.id])) setPhase('done');
  }

  function reroll(kind) {
    if (!pending || spinning || !rerolls[kind]) return;
    const cand = POOL.filter((p) => !usedNames.includes(p.n) && p.n !== pending.n && (kind === 'team' ? p.tm === pending.tm : true));
    if (cand.length === 0) return;
    setRerolls((r) => ({ ...r, [kind]: false }));
    runSpin(cand);
  }

  function result() {
    const bp = slots.ARCH ? slots.ARCH.p : 'SF';
    const f = FORM[bp];
    let base = f.int;
    CATS.forEach((c) => {
      const pl = slots[c.key];
      if (pl) {
        const ws = f.w[c.key];
        pl.a[c.key].forEach((v, i) => { base += ws[i] * v; });
        if (f.bw[c.key] !== undefined) { const bb = (pl.b && pl.b[c.key]) || [0, 0, 0, 0]; base += f.bw[c.key] * (4 * bb[0] + 3 * bb[1] + 2 * bb[2] + bb[3]); }
      }
    });
    if (slots.INT) base += f.ig * slots.INT.ig;
    let bodyAdj = 0;
    if (slots.ARCH) { base += f.ht * slots.ARCH.hi; bodyAdj = f.ht * (slots.ARCH.hi - HT_MEAN[bp]); }
    return { bp, bodyAdj, overall: Math.max(0, Math.min(99, Math.round(base))) };
  }

  useEffect(() => {
    if (phase !== 'done') return;
    const target = result().overall;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDisp(target); return; }
    const t0 = performance.now(), dur = 1100;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setDisp(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (phase === 'done') {
    const r = result();
    let totalAttr = 0;
    CATS.forEach((c) => { const pl = slots[c.key]; if (pl) totalAttr += pl.a[c.key].reduce((a, b) => a + b, 0); });
    return (
      <div style={{ background: C_BG, color: C_TEXT, fontFamily: "'Archivo', ui-sans-serif, system-ui, sans-serif", fontVariantNumeric: 'tabular-nums', minHeight: '100%', padding: 20 }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="rise" style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 16, padding: 18, marginBottom: 14, boxShadow: SHADOW }}>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="flex items-center" style={{ gap: 16 }}>
                <div style={{ width: 84, height: 84, borderRadius: 14, background: C_SURFACE2, border: `1px solid ${C_BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: C_ACCENT }}>{disp}</div>
                  <div style={{ fontSize: 9, color: C_MUTED, letterSpacing: '0.1em', marginTop: 2 }}>OVERALL</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{POS_NAME[r.bp]}</div>
                  <div style={{ fontSize: 13, color: C_MUTED, marginTop: 2 }}>
                    {slots.ARCH ? slots.ARCH.ht : '—'} frame{r.bodyAdj ? ` (${r.bodyAdj > 0 ? '+' : ''}${r.bodyAdj.toFixed(1)} fit)` : ''}
                  </div>
                  <div className="fade-late" style={{ fontSize: 13, fontWeight: 700, color: C_RED, marginTop: 4 }}>{tierFor(r.overall)}</div>
                </div>
              </div>
              <button onClick={newGame} className="flex items-center gap-2 select-none btn-red" style={{ background: C_RED, color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '12px 18px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                <RotateCcw size={16} /> Build again
              </button>
            </div>
            <div className="flex items-center" style={{ gap: 16, marginTop: 12, fontSize: 12, color: C_MUTED }}>
              <span>Position &amp; frame via {slots.ARCH ? slots.ARCH.n : '—'}</span>
              <span>{totalAttr.toLocaleString()} total attributes</span>
            </div>
          </div>

          <div className="end-grid">
            {CATS.map((c, ci2) => {
              const pl = slots[c.key];
              const val = pl.c[c.ci];
              return (
                <div key={c.key} className="rise" style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 12, padding: 14, boxShadow: SHADOW, animationDelay: `${140 + ci2 * 70}ms` }}>
                  <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
                    <Chip v={val} big />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                  </div>
                  <div>
                    {SUBS[c.key].map((label, idx) => (
                      <div key={label} className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: C_MUTED }}>{label}</span>
                        <Chip v={pl.a[c.key][idx]} />
                      </div>
                    ))}
                  </div>
                  <BadgeLine counts={(pl.b && pl.b[c.key]) || [0, 0, 0, 0]} />
                  <div style={{ fontSize: 11, color: C_MUTED, marginTop: 8, borderTop: `1px solid ${C_BORDER}`, paddingTop: 8 }}>via {pl.n}</div>
                </div>
              );
            })}
            {slots.INT ? (
              <div className="rise" style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 12, padding: 14, boxShadow: SHADOW, animationDelay: '560ms' }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
                  <Chip v={slots.INT.ig} big />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Intangibles</span>
                </div>
                <div style={{ fontSize: 12, color: C_MUTED, lineHeight: 1.5 }}>Toughness, poise under pressure, and clutch impact the standard ratings don't capture.</div>
                <div style={{ fontSize: 11, color: C_MUTED, marginTop: 8, borderTop: `1px solid ${C_BORDER}`, paddingTop: 8 }}>via {slots.INT.n}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const canSpin = !spinning && !pending;
  const sameTeamCount = pending ? POOL.filter((p) => !usedNames.includes(p.n) && p.n !== pending.n && p.tm === pending.tm).length : 0;
  const show = spinning ? flash : pending;

  return (
    <div style={{ background: C_BG, color: C_TEXT, fontFamily: "'Archivo', ui-sans-serif, system-ui, sans-serif", fontVariantNumeric: 'tabular-nums', minHeight: '100%', padding: 20 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em' }}>2K</span>
            <span style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', color: C_RED }}>STATLE</span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', background: C_ACCENT, borderRadius: 999, padding: '3px 10px' }}>{filled}/{SLOTS.length} locked</span>
            <button onClick={newGame} className="flex items-center gap-1 select-none btn-ghost" style={{ background: 'transparent', color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', height: 3, width: 104, borderRadius: 2, overflow: 'hidden', margin: '2px 0 14px' }}>
          <span style={{ flex: 1, background: C_ACCENT }} />
          <span style={{ flex: 1, background: C_RED }} />
        </div>
        <p style={{ fontSize: 13, color: C_MUTED, margin: '0 0 16px', lineHeight: 1.5 }}>
          Spin a player, then lock him into any open slot — position and frame, intangibles, or his rating in one category. You get two re-rolls a game: one for another player on his team, one for anyone in the league. Ratings stay hidden until you commit, and your overall stays hidden until every slot is filled.
        </p>

        <div style={{ minHeight: 78, marginBottom: 14 }}>
          {(pending || spinning) ? (
            <div style={{ background: C_SURFACE, border: `1px solid ${C_ACCENT}`, borderRadius: 14, padding: '12px 16px', boxShadow: SHADOW }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 11, color: C_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{spinning ? <><span className="live-dot" />Spinning…</> : 'You rolled'}</div>
                  <div key={show ? show.n : 'none'} className="tick" style={{ fontSize: 19, fontWeight: 800 }}>{show ? show.n : '—'}</div>
                  <div style={{ fontSize: 11, color: C_MUTED, marginTop: 1 }}>{show ? show.tm : '\u00A0'}</div>
                </div>
                {show ? (
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '3px 8px' }}>{show.p}</span>
                    <span style={{ fontSize: 12, color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '3px 8px' }}>{show.ht}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C_ACCENT, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '3px 8px' }}>{show.o} OVR</span>
                  </div>
                ) : null}
              </div>
              {!spinning && pending ? (
                <div className="flex items-center" style={{ gap: 8, marginTop: 10 }}>
                  <button onClick={() => reroll('team')} disabled={!rerolls.team || sameTeamCount === 0} className="flex items-center gap-1 select-none btn-ghost"
                    style={{ background: 'transparent', color: (rerolls.team && sameTeamCount > 0) ? C_ACCENT : C_MUTED, border: `1px solid ${(rerolls.team && sameTeamCount > 0) ? C_ACCENT : C_BORDER}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: (rerolls.team && sameTeamCount > 0) ? 'pointer' : 'not-allowed', opacity: (rerolls.team && sameTeamCount > 0) ? 1 : 0.45 }}>
                    <RotateCcw size={12} /> Re-roll {pending.tm}
                  </button>
                  <button onClick={() => reroll('any')} disabled={!rerolls.any} className="flex items-center gap-1 select-none btn-ghost"
                    style={{ background: 'transparent', color: rerolls.any ? C_ACCENT : C_MUTED, border: `1px solid ${rerolls.any ? C_ACCENT : C_BORDER}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: rerolls.any ? 'pointer' : 'not-allowed', opacity: rerolls.any ? 1 : 0.45 }}>
                    <RotateCcw size={12} /> Re-roll anyone
                  </button>
                  <span style={{ fontSize: 11, color: C_MUTED, marginLeft: 'auto' }}>or pick a slot below</span>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 78, color: C_MUTED, fontSize: 13 }}>
              Hit spin to roll a player.
            </div>
          )}
        </div>

        <div className="slot-grid">
          {SLOTS.map((s) => {
            const pl = slots[s.id];
            const selectable = pending && !pl;
            return (
              <div
                key={s.id}
                onClick={() => selectable && assign(s.id)}
                className={`slot${selectable ? ' slot-sel' : ''}${pl && lastLock === s.id ? ' pop' : ''}`}
                style={{
                  boxShadow: SHADOW,
                  background: C_SURFACE,
                  border: `1px solid ${selectable ? C_ACCENT : C_BORDER}`,
                  borderRadius: 12, padding: 11, minHeight: 104,
                  cursor: selectable ? 'pointer' : 'default',
                  opacity: pending && pl ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: C_ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                {pl ? (
                  s.kind === 'arch' ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{pl.p}</span>
                        <span style={{ fontSize: 13, color: C_MUTED }}>{pl.ht}</span>
                      </div>
                      <div style={{ fontSize: 10, color: C_MUTED, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.n}</div>
                    </div>
                  ) : s.kind === 'int' ? (
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: numColor(pl.ig) }}>{pl.ig}</div>
                      <div style={{ fontSize: 10, color: C_MUTED, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.n}</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: numColor(pl.c[s.ci]) }}>{pl.c[s.ci]}</div>
                      <div style={{ fontSize: 10, color: C_MUTED, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.n}</div>
                      <TierPills counts={(pl.b && pl.b[CATS[s.ci].key]) || [0, 0, 0, 0]} />
                    </div>
                  )
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: selectable ? C_ACCENT : C_MUTED }}>{selectable ? 'Lock here' : '—'}</div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={spin}
          disabled={!canSpin}
          className="flex items-center justify-center gap-2 w-full select-none btn-red"
          style={{
            background: canSpin ? C_RED : C_SURFACE2,
            color: canSpin ? '#FFFFFF' : C_MUTED,
            border: `1px solid ${canSpin ? C_RED : C_BORDER}`,
            borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 800,
            cursor: canSpin ? 'pointer' : 'not-allowed',
          }}
        >
          <Dice5 size={18} />
          {spinning ? 'Spinning…' : pending ? 'Lock your player into a slot' : 'Spin'}
        </button>
      </div>
    </div>
  );
}
