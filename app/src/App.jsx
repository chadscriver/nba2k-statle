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
  PG: { int: -18.94, ht: 0.0061, ig: 0.051, w: { OUT: [0.1083, 0.0537, 0.0712, 0.0538, 0.0754, 0.051], IN: [0.0724, 0.0, 0.0158, 0.0, 0.0363, 0.0246, 0.0474, 0.0756], PLY: [0.0874, 0.0393, 0.0634, 0.0449, 0.0691], ATH: [0.033, 0.0001, 0.0389, 0.0319, 0.0106, 0.0, 0.0159], DEF: [0.0011, 0.0061, 0.0213, 0.0, 0.0102, 0.0545, 0.0323], REB: [0.0, 0.0] } },
  SG: { int: -7.88, ht: 0.0051, ig: 0.0591, w: { OUT: [0.065, 0.084, 0.0558, 0.0647, 0.0757, 0.0606], IN: [0.0784, 0.0018, 0.0028, 0.0254, 0.0, 0.0, 0.045, 0.053], PLY: [0.0733, 0.0439, 0.0098, 0.0304, 0.0], ATH: [0.0, 0.0024, 0.0102, 0.0407, 0.0, 0.082, 0.0067], DEF: [0.0408, 0.0113, 0.0384, 0.0695, 0.0157, 0.0065, 0.0384], REB: [0.0051, 0.0] } },
  SF: { int: 2.56, ht: 0.0546, ig: 0.0297, w: { OUT: [0.0609, 0.0546, 0.0525, 0.0497, 0.0818, 0.0357], IN: [0.0722, 0.009, 0.0011, 0.0, 0.0272, 0.0119, 0.0403, 0.0367], PLY: [0.0, 0.0076, 0.0, 0.0387, 0.0459], ATH: [0.0486, 0.0, 0.0199, 0.0129, 0.0224, 0.0288, 0.0], DEF: [0.0015, 0.0045, 0.0516, 0.0567, 0.0436, 0.0147, 0.027], REB: [0.0239, 0.0039] } },
  PF: { int: 8.71, ht: 0.0117, ig: 0.0536, w: { OUT: [0.0406, 0.0289, 0.0236, 0.0244, 0.0699, 0.0422], IN: [0.0464, 0.0, 0.0398, 0.0488, 0.0071, 0.0329, 0.0129, 0.0433], PLY: [0.0229, 0.0268, 0.0065, 0.0054, 0.0322], ATH: [0.0314, 0.0443, 0.0269, 0.0325, 0.0, 0.0, 0.0012], DEF: [0.0042, 0.0269, 0.0193, 0.0224, 0.0139, 0.065, 0.0454], REB: [0.0537, 0.0] } },
  C: { int: 5.86, ht: 0.0236, ig: 0.0476, w: { OUT: [0.0, 0.0169, 0.0261, 0.0308, 0.0431, 0.0834], IN: [0.056, 0.0138, 0.006, 0.0339, 0.0323, 0.026, 0.0365, 0.0374], PLY: [0.0198, 0.0, 0.0113, 0.0318, 0.0], ATH: [0.0178, 0.0598, 0.0543, 0.0126, 0.002, 0.0184, 0.0107], DEF: [0.0348, 0.0, 0.0138, 0.0323, 0.0, 0.0381, 0.0469], REB: [0.0768, 0.0498] } },
};
const HT_MEAN = { PG: 74.8, SG: 76.7, SF: 78.5, PF: 80.1, C: 82.6 };
const POS_NAME = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };
const TIERS = ['HOF', 'Gold', 'Silver', 'Bronze'];
const TIER_COLOR = ['#7E22CE', '#A16207', '#64748B', '#92400E'];

const SLOTS = [
  { id: 'ARCH', kind: 'arch', label: 'Position & Frame' },
  { id: 'OUT', kind: 'cat', ci: 0, label: 'Outside' },
  { id: 'IN', kind: 'cat', ci: 1, label: 'Inside' },
  { id: 'PLY', kind: 'cat', ci: 2, label: 'Playmaking' },
  { id: 'ATH', kind: 'cat', ci: 3, label: 'Athleticism' },
  { id: 'DEF', kind: 'cat', ci: 4, label: 'Defense' },
  { id: 'REB', kind: 'cat', ci: 5, label: 'Rebounding' },
  { id: 'INT', kind: 'int', label: 'Intangibles' },
];

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

export default function App() {
  const [slots, setSlots] = useState({});
  const [pending, setPending] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [flash, setFlash] = useState(null);
  const [phase, setPhase] = useState('play');
  const [rerolls, setRerolls] = useState({ team: true, any: true });
  const iv = useRef(null), to = useRef(null);

  function cleanup() { clearInterval(iv.current); clearTimeout(to.current); }
  function newGame() { cleanup(); setSlots({}); setPending(null); setSpinning(false); setFlash(null); setPhase('play'); setRerolls({ team: true, any: true }); }
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
      if (pl) { const ws = f.w[c.key]; pl.a[c.key].forEach((v, i) => { base += ws[i] * v; }); }
    });
    if (slots.INT) base += f.ig * slots.INT.ig;
    let bodyAdj = 0;
    if (slots.ARCH) { base += f.ht * slots.ARCH.hi; bodyAdj = f.ht * (slots.ARCH.hi - HT_MEAN[bp]); }
    return { bp, bodyAdj, overall: Math.max(0, Math.min(99, Math.round(base))) };
  }

  if (phase === 'done') {
    const r = result();
    let totalAttr = 0;
    CATS.forEach((c) => { const pl = slots[c.key]; if (pl) totalAttr += pl.a[c.key].reduce((a, b) => a + b, 0); });
    return (
      <div style={{ background: C_BG, color: C_TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif', minHeight: '100%', padding: 20 }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="flex items-center" style={{ gap: 16 }}>
                <div style={{ width: 84, height: 84, borderRadius: 14, background: C_SURFACE2, border: `1px solid ${C_BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1, color: C_ACCENT }}>{r.overall}</div>
                  <div style={{ fontSize: 9, color: C_MUTED, letterSpacing: '0.1em', marginTop: 2 }}>OVERALL</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{POS_NAME[r.bp]}</div>
                  <div style={{ fontSize: 13, color: C_MUTED, marginTop: 2 }}>
                    {slots.ARCH ? slots.ARCH.ht : '—'} frame{r.bodyAdj ? ` (${r.bodyAdj > 0 ? '+' : ''}${r.bodyAdj.toFixed(1)} fit)` : ''}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C_ACCENT, marginTop: 4 }}>{tierFor(r.overall)}</div>
                </div>
              </div>
              <button onClick={newGame} className="flex items-center gap-2 select-none" style={{ background: C_RED, color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '12px 18px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                <RotateCcw size={16} /> Build again
              </button>
            </div>
            <div className="flex items-center" style={{ gap: 16, marginTop: 12, fontSize: 12, color: C_MUTED }}>
              <span>Position &amp; frame via {slots.ARCH ? slots.ARCH.n : '—'}</span>
              <span>{totalAttr.toLocaleString()} total attributes</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {CATS.map((c) => {
              const pl = slots[c.key];
              const val = pl.c[c.ci];
              return (
                <div key={c.key} style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 12, padding: 14 }}>
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
              <div style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 12, padding: 14 }}>
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
    <div style={{ background: C_BG, color: C_TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif', minHeight: '100%', padding: 20 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>2K</span>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: C_RED }}>STATLE</span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 12, color: C_MUTED }}>{filled}/{SLOTS.length} locked</span>
            <button onClick={newGame} className="flex items-center gap-1 select-none" style={{ background: 'transparent', color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
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
            <div style={{ background: C_SURFACE, border: `1px solid ${C_ACCENT}`, borderRadius: 14, padding: '12px 16px' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 11, color: C_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{spinning ? 'Spinning…' : 'You rolled'}</div>
                  <div style={{ fontSize: 19, fontWeight: 800 }}>{show ? show.n : '—'}</div>
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
                  <button onClick={() => reroll('team')} disabled={!rerolls.team || sameTeamCount === 0} className="flex items-center gap-1 select-none"
                    style={{ background: 'transparent', color: (rerolls.team && sameTeamCount > 0) ? C_ACCENT : C_MUTED, border: `1px solid ${(rerolls.team && sameTeamCount > 0) ? C_ACCENT : C_BORDER}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: (rerolls.team && sameTeamCount > 0) ? 'pointer' : 'not-allowed', opacity: (rerolls.team && sameTeamCount > 0) ? 1 : 0.45 }}>
                    <RotateCcw size={12} /> Re-roll {pending.tm}
                  </button>
                  <button onClick={() => reroll('any')} disabled={!rerolls.any} className="flex items-center gap-1 select-none"
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {SLOTS.map((s) => {
            const pl = slots[s.id];
            const selectable = pending && !pl;
            return (
              <div
                key={s.id}
                onClick={() => selectable && assign(s.id)}
                style={{
                  background: s.kind === 'cat' ? C_SURFACE : C_SURFACE2,
                  border: `1px solid ${selectable ? C_ACCENT : C_BORDER}`,
                  borderRadius: 12, padding: 11, minHeight: 96,
                  cursor: selectable ? 'pointer' : 'default',
                  opacity: pending && pl ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: s.kind === 'cat' ? C_TEXT : C_ACCENT, textTransform: s.kind === 'cat' ? 'none' : 'uppercase', letterSpacing: s.kind === 'cat' ? 0 : '0.06em' }}>{s.label}</div>
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
                      <div style={{ fontSize: 9, color: C_MUTED, marginTop: 2 }}>
                        {(() => { const cnt = (pl.b && pl.b[CATS[s.ci].key]) || [0, 0, 0, 0]; const tot = cnt.reduce((a, b) => a + b, 0); return tot ? `${tot} badge${tot > 1 ? 's' : ''}` : 'no badges'; })()}
                      </div>
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
          className="flex items-center justify-center gap-2 w-full select-none"
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
