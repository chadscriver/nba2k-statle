import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dice5, RotateCcw, X } from 'lucide-react';
import NORMAL_POOL from './pool.json';
import TEAMS from './teams.json';
import DAILIES from './dailies.json';

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
// import.meta.env.BASE_URL keeps asset paths correct under any deploy base
// (root on Vercel, the repo subpath on GitHub Pages).
const BASE = import.meta.env.BASE_URL;
const TIER_IMG = ['hof', 'gold', 'silver', 'bronze'].map((t) => `${BASE}badges/${t}.png`);
const headshotSrc = (p) => (p && p.img ? `${BASE}${p.img}` : '');
const teamLogoSrc = (tm) => { const m = TEAMS[tm]; return m && m.logo ? `${BASE}${m.logo}` : ''; };

const MODES = [{ id: 'normal', label: 'Normal' }, { id: 'hard', label: 'Hard' }, { id: 'legends', label: 'Legends' }, { id: 'daily', label: 'Daily' }];

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

const SHARE_URL = 'https://chadscriver.github.io/nba2k-statle/';
function bucket(v) { return v >= 90 ? '🟪' : v >= 80 ? '🟨' : v >= 70 ? '⬜' : '🟫'; }
function loadGames() { try { return JSON.parse(localStorage.getItem('statle.games')) || []; } catch { return []; } }
function saveGame(g) { const arr = loadGames(); arr.unshift(g); localStorage.setItem('statle.games', JSON.stringify(arr.slice(0, 200))); }
function loadDaily() { try { return JSON.parse(localStorage.getItem('statle.daily')) || { streak: 0, lastDaily: null, results: {} }; } catch { return { streak: 0, lastDaily: null, results: {} }; } }
function loadDailyInProgress() { try { return JSON.parse(localStorage.getItem('statle.dailyInProgress')); } catch { return null; } }
function saveDailyInProgress(o) { localStorage.setItem('statle.dailyInProgress', JSON.stringify(o)); }
function clearDailyInProgress() { localStorage.removeItem('statle.dailyInProgress'); }

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

const SEED_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomSeed() { let s = ''; for (let i = 0; i < 6; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)]; return s; }
function makeRng(seed) { return mulberry32(xmur3(seed)()); }

const DAILY_EPOCH = '2026-06-15';
function dailyNumber() {
  const [y, m, d] = DAILY_EPOCH.split('-').map(Number);
  const epoch = new Date(y, m - 1, d);
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((today - epoch) / 86400000) + 1;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Resolve today's daily set against the NORMAL pool; on pool drift advance to
// the next set index (per spec) and warn.
function resolveDailySet(n) {
  const sets = DAILIES.sets, L = sets.length;
  for (let k = 0; k < L; k++) {
    const idx = (((n - 1 + k) % L) + L) % L;
    const players = sets[idx].players.map((nm) => NORMAL_POOL.find((p) => p.n === nm));
    if (players.every(Boolean)) return { players, idx };
    console.warn(`daily: set ${idx} references a missing player (pool drift); advancing`);
  }
  return null;
}

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

function Headshot({ p, size }) {
  const hs = headshotSrc(p);
  const logo = teamLogoSrc(p && p.tm);
  if (!hs && !logo) return null;
  const rad = Math.round(size * 0.28);
  const badge = Math.max(20, Math.round(size * 0.3));
  return (
    <span data-hswrap="1" style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: rad, background: C_SURFACE2, border: `1px solid ${C_BORDER}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {logo ? <img src={logo} alt="" data-fallbacklogo="1" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: '66%', height: '66%', objectFit: 'contain', display: hs ? 'none' : 'block' }} /> : null}
        {hs ? (
          <img
            src={hs}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const wrap = e.currentTarget.closest('[data-hswrap]');
              const bd = wrap && wrap.querySelector('[data-teambadge]');
              if (bd) bd.style.display = 'none';
              const fb = wrap && wrap.querySelector('[data-fallbacklogo]');
              if (fb) fb.style.display = 'block';
            }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }}
          />
        ) : null}
      </span>
      {hs && logo ? (
        <span data-teambadge="1" style={{ position: 'absolute', right: -4, bottom: -4, width: badge, height: badge, borderRadius: '50%', background: C_SURFACE, border: `1px solid ${C_BORDER}`, boxShadow: '0 1px 3px rgba(10,27,61,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={logo} alt="" onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }} style={{ width: '72%', height: '72%', objectFit: 'contain' }} />
        </span>
      ) : null}
    </span>
  );
}

function TeamLogo({ tm, size }) {
  const src = teamLogoSrc(tm);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, verticalAlign: 'middle' }}
    />
  );
}

function Modal({ title, onClose, children, width }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,27,61,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 12px', zIndex: 50, overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 16, boxShadow: SHADOW, width: width || 'min(520px, calc(100vw - 24px))', maxHeight: '80vh', overflowY: 'auto', padding: 20, marginTop: '6vh' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} aria-label="Close" className="select-none btn-ghost" style={{ background: 'transparent', color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '4px 8px', cursor: 'pointer', lineHeight: 1 }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalMini({ pl, slot, grey }) {
  const src = headshotSrc(pl);
  const value = slot.kind === 'arch' ? pl.p : slot.kind === 'int' ? pl.ig : pl.c[slot.ci];
  const vColor = grey ? C_MUTED : slot.kind === 'arch' ? C_TEXT : numColor(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      {src ? <img src={src} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover', objectPosition: 'center 18%', flexShrink: 0, filter: grey ? 'grayscale(1)' : 'none', opacity: grey ? 0.5 : 1 }} /> : null}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, lineHeight: 1.25, fontWeight: 600, color: grey ? C_MUTED : C_TEXT, wordBreak: 'break-word' }}>{pl.n}</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: vColor }}>{value}</div>
      </div>
    </div>
  );
}

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

function TierPills({ counts, mobile }) {
  const items = counts.map((n, i) => ({ n, i })).filter((x) => x.n > 0);
  if (items.length === 0) return <div style={{ fontSize: 9, color: C_MUTED, marginTop: 4 }}>no badges</div>;
  const w = mobile ? 13 : 15, h = mobile ? 17 : 20, fs = mobile ? 8 : 9;
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {items.map((x) => (
        <span key={x.i} title={TIERS[x.i]} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: w, height: h }}>
          <img src={TIER_IMG[x.i]} alt={TIERS[x.i]} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
          <span style={{ position: 'relative', fontSize: fs, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.85)', lineHeight: 1 }}>{x.n}</span>
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
  const [lastLock, setLastLock] = useState(null);
  const [disp, setDisp] = useState(0);
  const [mode, setMode] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('statle.mode')) || 'normal');
  const [pool, setPool] = useState(NORMAL_POOL);
  const [poolLoading, setPoolLoading] = useState(false);
  const [showBest, setShowBest] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share');
  const [linkLabel, setLinkLabel] = useState('Challenge a friend');
  const [seed, setSeed] = useState('');
  const [challengeBanner, setChallengeBanner] = useState(null);
  const [dailyN, setDailyN] = useState(null);
  const [dailyOrder, setDailyOrder] = useState([]);
  const [dailyRevealed, setDailyRevealed] = useState(0);
  const [dailyPar, setDailyPar] = useState(0);
  const [dailyPractice, setDailyPractice] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const isMobile = useIsMobile();
  const iv = useRef(null), to = useRef(null);
  const recorded = useRef(false);
  const rngRef = useRef(Math.random);

  function cleanup() { clearInterval(iv.current); clearTimeout(to.current); }
  function resetGameState() {
    cleanup();
    setSlots({}); setPending(null); setSpinning(false); setFlash(null); setPhase('play');
    setRerolls({ team: true, any: true }); setLastLock(null); setDisp(0);
    setShowBest(false); setShareLabel('Share'); setLinkLabel('Challenge a friend');
    recorded.current = false;
  }

  // Endless game: every game gets a seed (challenge links). All endless
  // randomness draws from this rng, so the same seed + same choices replays.
  function startEndless(forcedSeed) {
    const s = forcedSeed || randomSeed();
    rngRef.current = makeRng(s);
    setSeed(s);
    setChallengeBanner(forcedSeed || null);
    setDailyN(null); setDailyOrder([]); setDailyRevealed(0); setDailyPractice(false);
    resetGameState();
  }

  // Daily Gauntlet setup: resolve today's set, recompute par locally, resume an
  // in-progress attempt, or show the summary if today is already done.
  function setupDaily(practice) {
    const n = dailyNumber();
    const resolved = resolveDailySet(n);
    setChallengeBanner(null);
    setDailyN(n);
    if (!resolved) { setDailyPar(0); setDailyOrder([]); setDailyRevealed(0); setDailyPractice(false); resetGameState(); return; }
    setDailyPar(bestArrangement(resolved.players).overall);
    const doneToday = !!(loadDaily().results || {})[n];
    resetGameState();
    if (!practice && doneToday) {
      setDailyPractice(false); setDailyOrder(shuffle(resolved.players)); setDailyRevealed(0);
      setPhase('daily-summary');
      return;
    }
    if (practice) {
      setDailyPractice(true); setDailyOrder(shuffle(resolved.players)); setDailyRevealed(0);
      return;
    }
    setDailyPractice(false);
    const ip = loadDailyInProgress();
    if (ip && ip.n === n) {  // resume — preserves order, kills order-scumming
      const order = ip.order.map((nm) => resolved.players.find((p) => p.n === nm)).filter(Boolean);
      const restored = {};
      Object.entries(ip.slots).forEach(([sid, nm]) => { const pl = resolved.players.find((p) => p.n === nm); if (pl) restored[sid] = pl; });
      setDailyOrder(order.length === 8 ? order : shuffle(resolved.players));
      setDailyRevealed(Object.keys(restored).length);
      setSlots(restored);
      if (SLOTS.every((s) => restored[s.id])) setPhase('done');
    } else {
      setDailyOrder(shuffle(resolved.players)); setDailyRevealed(0);
    }
  }

  function setupForMode(m, forcedSeed) {
    if (m === 'daily') setupDaily(false); else startEndless(forcedSeed);
  }
  function newGame() {
    if (mode === 'daily') setupDaily(dailyPractice); else startEndless();
  }

  // Mount: honor ?seed (+ optional &mode) for challenge links, else set up the
  // persisted mode.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get('seed');
    const urlMode = params.get('mode');
    let m = mode;
    if (urlSeed) {
      m = ['normal', 'hard', 'legends'].includes(urlMode) ? urlMode : (mode === 'daily' ? 'normal' : mode);
      if (m !== mode) setMode(m);
    }
    setupForMode(m, urlSeed || null);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pool loading: normal/daily use the bundled normal pool; hard/legends
  // lazy-load so the initial bundle stays light. Mode persists to localStorage.
  useEffect(() => {
    localStorage.setItem('statle.mode', mode);
    if (mode === 'normal' || mode === 'daily') { setPool(NORMAL_POOL); setPoolLoading(false); return; }
    setPoolLoading(true);
    let cancelled = false;
    const loader = mode === 'hard' ? import('./pool_full.json') : import('./pool_legends.json');
    loader.then((m) => { if (!cancelled) { setPool(m.default); setPoolLoading(false); } });
    return () => { cancelled = true; };
  }, [mode]);

  const usedNames = Object.values(slots).filter(Boolean).map((p) => p.n);
  const filled = SLOTS.filter((s) => slots[s.id]).length;

  function switchMode(next) {
    if (next === mode || poolLoading) return;
    if (filled > 0 && !window.confirm('Abandon this build?')) return;
    setMode(next);
    setupForMode(next, null);
  }

  function reveal() {
    if (pending || phase !== 'play' || mode !== 'daily' || dailyRevealed >= 8) return;
    setPending(dailyOrder[dailyRevealed]);
    setDailyRevealed((r) => r + 1);
  }

  function runSpin(cands) {
    if (cands.length === 0) return;
    const rnd = rngRef.current || Math.random;
    setPending(null);
    setSpinning(true);
    // Draw a fixed number of rng values up front (flash frames + duration +
    // result) so rng consumption per spin is constant regardless of animation
    // timing — that is what makes a seed replay identically.
    const pick = () => cands[Math.floor(rnd() * cands.length)];
    const frames = []; for (let i = 0; i < 20; i++) frames.push(pick());
    const dur = 900 + rnd() * 500;
    const result = pick();
    let fi = 0;
    setFlash(frames[0]);
    iv.current = setInterval(() => { fi = (fi + 1) % frames.length; setFlash(frames[fi]); }, 70);
    to.current = setTimeout(() => {
      clearInterval(iv.current);
      setPending(result);
      setFlash(null);
      setSpinning(false);
    }, dur);
  }

  function spin() {
    if (spinning || pending || phase === 'done' || poolLoading || mode === 'daily') return;
    runSpin(pool.filter((p) => !usedNames.includes(p.n)));
  }

  function assign(id) {
    if (!pending || slots[id]) return;
    const ns = { ...slots, [id]: pending };
    setSlots(ns);
    setPending(null);
    setLastLock(id);
    // Daily counting attempt: persist progress on every lock so a refresh
    // resumes the same order/slots (consumed at the first lock).
    if (mode === 'daily' && !dailyPractice) {
      const slotNames = {};
      Object.entries(ns).forEach(([k, v]) => { slotNames[k] = v.n; });
      saveDailyInProgress({ n: dailyN, order: dailyOrder.map((p) => p.n), slots: slotNames });
    }
    if (SLOTS.every((s) => ns[s.id])) setPhase('done');
  }

  function reroll(kind) {
    if (!pending || spinning || !rerolls[kind]) return;
    const cand = pool.filter((p) => !usedNames.includes(p.n) && p.n !== pending.n && (kind === 'team' ? p.tm === pending.tm : true));
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

  // On completion: the user's actual score, the optimal arrangement of the same
  // 8 locked players, efficiency, and whether the build is perfect.
  const analysis = useMemo(() => {
    if (phase !== 'done' || !SLOTS.every((s) => slots[s.id])) return null;
    const players8 = SLOTS.map((s) => slots[s.id]);
    const userScore = scoreArrangement(slots.ARCH, slots.INT, CAT_KEYS.map((k) => slots[k]));
    const bestRes = bestArrangement(players8);
    const a = bestRes.asg;
    const optimalBySlot = {
      ARCH: players8[a.arch], INT: players8[a.int],
      OUT: players8[a.cats[0]], IN: players8[a.cats[1]], PLY: players8[a.cats[2]],
      ATH: players8[a.cats[3]], DEF: players8[a.cats[4]], REB: players8[a.cats[5]],
    };
    return {
      userScore, bestRes, optimalBySlot,
      perfect: userScore >= bestRes.score - 1e-6,
      eff: Math.round(100 * userScore / bestRes.score),
    };
  }, [phase, slots]);

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

  // Record each completed game once. Daily writes its result + streak and
  // clears the in-progress key; practice games are never recorded.
  useEffect(() => {
    if (phase !== 'done' || !analysis || recorded.current) return;
    recorded.current = true;
    if (mode === 'daily' && dailyPractice) return;
    const r = result();
    const slotNames = {};
    SLOTS.forEach((s) => { slotNames[s.id] = slots[s.id].n; });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dateISO = new Date().toISOString();
    if (mode === 'daily') {
      const ds = loadDaily();
      ds.results = ds.results || {};
      ds.results[dailyN] = { overall: r.overall, best: dailyPar, perfect: analysis.perfect };
      let streak = 0;
      for (let k = dailyN; ds.results[k]; k--) streak++;
      ds.streak = streak; ds.lastDaily = dailyN;
      localStorage.setItem('statle.daily', JSON.stringify(ds));
      clearDailyInProgress();
      saveGame({ id, dateISO, mode: 'daily', overall: r.overall, best: dailyPar, eff: analysis.eff, perfect: analysis.perfect, rerolls: 0, seed: null, daily: dailyN, slots: slotNames });
    } else {
      saveGame({ id, dateISO, mode, overall: r.overall, best: analysis.bestRes.overall, eff: analysis.eff, perfect: analysis.perfect, rerolls: (rerolls.team ? 0 : 1) + (rerolls.any ? 0 : 1), seed, daily: null, slots: slotNames });
    }
  }, [phase, analysis]);

  function shareText() {
    const r = result();
    const squares = SLOTS.map((s) => {
      const pl = slots[s.id];
      if (s.kind === 'arch') return bucket(pl.o);
      if (s.kind === 'int') return bucket(pl.ig);
      return bucket(pl.c[s.ci]);
    }).join('');
    const head = mode === 'daily'
      ? `2K STATLE Daily #${dailyN} — ${r.overall}/${dailyPar}`
      : `2K STATLE — ${r.overall} OVR (best ${analysis.bestRes.overall})`;
    return `${head}\n${squares}\n${SHARE_URL}`;
  }
  async function handleShare() {
    const text = shareText();
    if (navigator.share) { try { await navigator.share({ text }); } catch (e) { /* cancelled */ } return; }
    try { await navigator.clipboard.writeText(text); setShareLabel('Copied!'); setTimeout(() => setShareLabel('Share'), 1500); } catch (e) { /* ignore */ }
  }
  async function handleChallenge() {
    const url = `${window.location.origin}${window.location.pathname}?seed=${seed}&mode=${mode}`;
    try { await navigator.clipboard.writeText(url); setLinkLabel('Link copied!'); setTimeout(() => setLinkLabel('Challenge a friend'), 1500); } catch (e) { /* ignore */ }
  }

  if (phase === 'daily-summary') {
    const res = (loadDaily().results || {})[dailyN] || {};
    const dstreak = loadDaily().streak || 0;
    return (
      <div style={{ background: C_BG, color: C_TEXT, fontFamily: "'Archivo', ui-sans-serif, system-ui, sans-serif", fontVariantNumeric: 'tabular-nums', minHeight: '100%', padding: 20 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em' }}>2K</span>
              <span style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', color: C_RED }}>STATLE</span>
            </div>
            <div style={{ display: 'flex', border: `1px solid ${C_BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
              {MODES.map((m) => (
                <button key={m.id} onClick={() => switchMode(m.id)} className="select-none" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 8px', border: 'none', cursor: 'pointer', background: mode === m.id ? C_ACCENT : 'transparent', color: mode === m.id ? '#FFFFFF' : C_MUTED }}>{m.label}</button>
              ))}
            </div>
          </div>
          <div className="rise" style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 16, padding: 24, boxShadow: SHADOW, textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C_ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Daily #{dailyN}</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: C_ACCENT, marginTop: 8 }}>{res.overall ?? '—'} <span style={{ fontSize: 18, color: C_MUTED, fontWeight: 700 }}>/ par {dailyPar}</span></div>
            {res.perfect ? <div style={{ fontSize: 14, fontWeight: 800, color: C_RED, marginTop: 4 }}>Perfect build</div> : null}
            <div style={{ fontSize: 13, color: C_MUTED, marginTop: 10 }}>You've already played today's Gauntlet{dstreak ? ` — streak ${dstreak}` : ''}. Come back tomorrow for #{dailyN + 1}.</div>
            <button onClick={() => setupDaily(true)} className="select-none btn-ghost" style={{ marginTop: 16, background: 'transparent', color: C_ACCENT, border: `1px solid ${C_BORDER}`, borderRadius: 12, padding: '12px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Practice (doesn't count)</button>
          </div>
        </div>
      </div>
    );
  }

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
                  <div style={{ fontSize: 9, color: C_MUTED, letterSpacing: '0.1em', marginTop: 2 }}>{mode === 'daily' ? `/ PAR ${dailyPar}` : 'OVERALL'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{POS_NAME[r.bp]}</div>
                  <div style={{ fontSize: 12, color: C_MUTED, marginTop: 3, lineHeight: 1.6 }}>
                    <div>Height: {slots.ARCH ? slots.ARCH.ht : '—'}</div>
                    {slots.ARCH && slots.ARCH.wt ? <div>Weight: {slots.ARCH.wt} lbs</div> : null}
                    {slots.ARCH && slots.ARCH.ws ? <div>Wingspan: {slots.ARCH.ws}</div> : null}
                  </div>
                  {analysis ? (analysis.perfect ? (
                    <div style={{ fontSize: 13, fontWeight: 800, color: C_RED, marginTop: 6 }}>Perfect build</div>
                  ) : (
                    <div style={{ fontSize: 13, color: C_MUTED, marginTop: 6 }}>
                      Best possible: {analysis.bestRes.overall}
                    </div>
                  )) : null}
                  <div className="fade-late" style={{ fontSize: 13, fontWeight: 700, color: C_RED, marginTop: 4 }}>{tierFor(r.overall)}</div>
                </div>
              </div>
              <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setShowBest(true)} className="select-none btn-ghost" style={{ background: 'transparent', color: C_ACCENT, border: `1px solid ${C_BORDER}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  See best build
                </button>
                <button onClick={handleShare} className="select-none btn-ghost" style={{ background: 'transparent', color: C_ACCENT, border: `1px solid ${C_BORDER}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  {shareLabel}
                </button>
                {mode !== 'daily' ? (
                  <button onClick={handleChallenge} className="select-none btn-ghost" style={{ background: 'transparent', color: C_ACCENT, border: `1px solid ${C_BORDER}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {linkLabel}
                  </button>
                ) : null}
                <button onClick={newGame} className="flex items-center gap-2 select-none btn-red" style={{ background: C_RED, color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '12px 18px', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                  <RotateCcw size={16} /> Build again
                </button>
              </div>
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
          {showBest && analysis ? (
            <Modal title={`Best possible build — ${analysis.bestRes.overall} OVR`} onClose={() => setShowBest(false)} width="min(440px, calc(100vw - 24px))">
              {SLOTS.map((s) => {
                const you = slots[s.id], opt = analysis.optimalBySlot[s.id];
                const correct = you.n === opt.n;
                return (
                  <div key={s.id} style={{ padding: '8px 2px', borderBottom: `1px solid ${C_BORDER}` }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: C_MUTED, marginBottom: 4 }}>{s.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 18px 1fr', gap: 6, alignItems: 'center' }}>
                      <ModalMini pl={you} slot={s} grey={!correct} />
                      <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: correct ? '#15803D' : C_RED }}>→</div>
                      <ModalMini pl={opt} slot={s} grey={false} />
                    </div>
                  </div>
                );
              })}
            </Modal>
          ) : null}
        </div>
      </div>
    );
  }

  const canSpin = !spinning && !pending && !poolLoading;
  const canReveal = mode === 'daily' && !pending && dailyRevealed < 8;
  const sameTeamCount = pending ? pool.filter((p) => !usedNames.includes(p.n) && p.n !== pending.n && p.tm === pending.tm).length : 0;
  const show = spinning ? flash : pending;

  return (
    <div style={{ background: C_BG, color: C_TEXT, fontFamily: "'Archivo', ui-sans-serif, system-ui, sans-serif", fontVariantNumeric: 'tabular-nums', minHeight: '100%', padding: 20 }}>
      <div className="page-wrap" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4, flexWrap: 'wrap', rowGap: 6 }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em' }}>2K</span>
            <span style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.02em', color: C_RED }}>STATLE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', border: `1px solid ${C_BORDER}`, borderRadius: 8, overflowX: isMobile ? 'auto' : 'hidden', overflowY: 'hidden', minWidth: 0 }}>
              {MODES.map((m) => (
                <button key={m.id} onClick={() => switchMode(m.id)} className="select-none"
                  style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 8px', border: 'none', cursor: 'pointer', flexShrink: 0, background: mode === m.id ? C_ACCENT : 'transparent', color: mode === m.id ? '#FFFFFF' : C_MUTED }}>
                  {m.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', background: C_ACCENT, borderRadius: 999, padding: '3px 10px' }}>{filled}/{SLOTS.length} locked</span>
            <button onClick={newGame} className="flex items-center gap-1 select-none btn-ghost" style={{ background: 'transparent', color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
              <RotateCcw size={12} /> Reset
            </button>
            <button onClick={() => setShowStats(true)} className="select-none btn-ghost" style={{ background: 'transparent', color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}>
              Stats
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', height: 3, width: 104, borderRadius: 2, overflow: 'hidden', margin: '2px 0 14px' }}>
          <span style={{ flex: 1, background: C_ACCENT }} />
          <span style={{ flex: 1, background: C_RED }} />
        </div>
        {(() => {
          const text = mode === 'daily'
            ? "Today's Gauntlet: reveal eight players one at a time and lock each into an open slot before the next reveal. No re-rolls — beat par. One counting attempt per day."
            : 'Spin a player, then lock him into any open slot — position and frame, intangibles, or his rating in one category. You get two re-rolls a game: one for another player on his team, one for anyone in the league. Ratings stay hidden until you commit, and your overall stays hidden until every slot is filled.';
          const para = <p style={{ fontSize: isMobile ? 12 : 13, color: C_MUTED, margin: '0 0 16px', lineHeight: 1.5 }}>{text}</p>;
          if (loadGames().length === 0) return para;
          return (
            <div style={{ marginBottom: howToOpen ? 0 : 16 }}>
              <div onClick={() => setHowToOpen((o) => !o)} style={{ fontSize: 12, color: C_ACCENT, cursor: 'pointer', marginBottom: howToOpen ? 8 : 0 }}>How to play</div>
              {howToOpen ? para : null}
            </div>
          );
        })()}

        {challengeBanner ? (
          <div style={{ fontSize: 12, fontWeight: 700, color: C_ACCENT, marginBottom: 10 }}>Challenge seed {challengeBanner}</div>
        ) : null}
        {mode === 'daily' && dailyPractice ? (
          <div style={{ fontSize: 12, fontWeight: 700, color: C_RED, marginBottom: 10 }}>Practice — doesn't count</div>
        ) : null}

        <div className="rollzone">
          {(pending || spinning) ? (
            isMobile ? (
              <div style={{ background: C_SURFACE, border: `1px solid ${C_ACCENT}`, borderRadius: 14, padding: '10px 12px', boxShadow: SHADOW, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {show ? <Headshot p={show} size={52} /> : null}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 9, color: C_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{spinning ? <><span className="live-dot" />Spinning…</> : 'You rolled'}</div>
                    <div key={show ? show.n : 'none'} className="tick" style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{show ? show.n : '—'}</div>
                    <div style={{ fontSize: 10, color: C_MUTED, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{show ? shortTm(show.tm) : ' '}</div>
                  </div>
                  {show ? <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: C_ACCENT, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '3px 8px' }}>{show.o} OVR</span> : null}
                </div>
                {show ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '2px 6px' }}>{show.p}</span>
                    <span style={{ fontSize: 10, color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '2px 6px' }}>{show.ht}</span>
                    {show.wt ? <span style={{ fontSize: 10, color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '2px 6px' }}>{show.wt} lbs</span> : null}
                    {mode !== 'daily' && !spinning && pending ? (
                      <>
                        <button onClick={() => reroll('team')} disabled={!rerolls.team || sameTeamCount === 0} className="flex items-center justify-center gap-1 select-none btn-ghost"
                          style={{ flex: 1, background: 'transparent', color: (rerolls.team && sameTeamCount > 0) ? C_ACCENT : C_MUTED, border: `1px solid ${(rerolls.team && sameTeamCount > 0) ? C_ACCENT : C_BORDER}`, borderRadius: 8, padding: '6px 4px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', cursor: (rerolls.team && sameTeamCount > 0) ? 'pointer' : 'not-allowed', opacity: (rerolls.team && sameTeamCount > 0) ? 1 : 0.45 }}>
                          <RotateCcw size={11} /> Re-roll {shortTm(pending.tm)}
                        </button>
                        <button onClick={() => reroll('any')} disabled={!rerolls.any} className="flex items-center justify-center gap-1 select-none btn-ghost"
                          style={{ flex: 1, background: 'transparent', color: rerolls.any ? C_ACCENT : C_MUTED, border: `1px solid ${rerolls.any ? C_ACCENT : C_BORDER}`, borderRadius: 8, padding: '6px 4px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', cursor: rerolls.any ? 'pointer' : 'not-allowed', opacity: rerolls.any ? 1 : 0.45 }}>
                          <RotateCcw size={11} /> Re-roll anyone
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
            <div style={{ height: '100%', background: C_SURFACE, border: `1px solid ${C_ACCENT}`, borderRadius: 14, padding: '12px 16px', boxShadow: SHADOW, display: 'flex', alignItems: 'center', gap: 14 }}>
              {show ? <Headshot p={show} size={86} /> : null}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: C_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{spinning ? <><span className="live-dot" />Spinning…</> : 'You rolled'}</div>
                <div key={show ? show.n : 'none'} className="tick" style={{ fontSize: 19, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{show ? show.n : '—'}</div>
                <div style={{ fontSize: 11, color: C_MUTED, marginTop: 1 }}>{show ? shortTm(show.tm) : '\u00A0'}</div>
              </div>
              <div style={{ marginLeft: 'auto', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', padding: '3px 0', flexShrink: 0 }}>
                {show ? (
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 12, color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '3px 8px' }}>{show.p}</span>
                    <span style={{ fontSize: 12, color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '3px 8px' }}>{show.ht}</span>
                    {show.wt ? <span style={{ fontSize: 12, color: C_MUTED, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '3px 8px' }}>{show.wt} lbs</span> : null}
                    <span style={{ fontSize: 12, fontWeight: 700, color: C_ACCENT, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '3px 8px' }}>{show.o} OVR</span>
                  </div>
                ) : <span />}
                {mode !== 'daily' && !spinning && pending ? (
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <button onClick={() => reroll('team')} disabled={!rerolls.team || sameTeamCount === 0} className="flex items-center gap-1 select-none btn-ghost"
                      style={{ background: 'transparent', color: (rerolls.team && sameTeamCount > 0) ? C_ACCENT : C_MUTED, border: `1px solid ${(rerolls.team && sameTeamCount > 0) ? C_ACCENT : C_BORDER}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: (rerolls.team && sameTeamCount > 0) ? 'pointer' : 'not-allowed', opacity: (rerolls.team && sameTeamCount > 0) ? 1 : 0.45 }}>
                      <RotateCcw size={12} /> Re-roll {shortTm(pending.tm)}
                    </button>
                    <button onClick={() => reroll('any')} disabled={!rerolls.any} className="flex items-center gap-1 select-none btn-ghost"
                      style={{ background: 'transparent', color: rerolls.any ? C_ACCENT : C_MUTED, border: `1px solid ${rerolls.any ? C_ACCENT : C_BORDER}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: rerolls.any ? 'pointer' : 'not-allowed', opacity: rerolls.any ? 1 : 0.45 }}>
                      <RotateCcw size={12} /> Re-roll anyone
                    </button>
                  </div>
                ) : <span />}
              </div>
            </div>
            )
          ) : (
            <div className="flex items-center justify-center" style={{ height: '100%', color: C_MUTED, fontSize: 13 }}>
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
                  borderRadius: 12, padding: isMobile ? 10 : 12, minHeight: isMobile ? 136 : 172,
                  cursor: selectable ? 'pointer' : 'default',
                  opacity: pending && pl ? 0.5 : 1,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ fontSize: isMobile ? 10 : 11, fontWeight: 600, color: C_ACCENT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                  {pl ? (
                    s.kind === 'arch' ? <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{pl.p}</span>
                      : s.kind === 'int' ? <span style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, lineHeight: 1, color: numColor(pl.ig) }}>{pl.ig}</span>
                        : <span style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, lineHeight: 1, color: numColor(pl.c[s.ci]) }}>{pl.c[s.ci]}</span>
                  ) : null}
                </div>
                {pl ? (
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, marginTop: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <Headshot p={pl} size={isMobile ? 56 : 88} />
                      <div style={{ fontSize: 10, color: C_MUTED, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.n}</div>
                    </div>
                    {s.kind === 'arch' ? (
                      <div style={{ textAlign: 'right', fontSize: 10, color: C_MUTED, lineHeight: 1.7, whiteSpace: 'nowrap' }}>
                        <div>HT {pl.ht}</div>
                        {pl.wt ? <div>WT {pl.wt} lbs</div> : null}
                        {pl.ws ? <div>WS {pl.ws}</div> : null}
                      </div>
                    ) : s.kind === 'cat' ? (
                      <TierPills counts={(pl.b && pl.b[CATS[s.ci].key]) || [0, 0, 0, 0]} mobile={isMobile} />
                    ) : null}
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: C_MUTED }}>—</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="actionbar">
        {mode === 'daily' ? (
          <button
            onClick={reveal}
            disabled={!canReveal}
            className="flex items-center justify-center gap-2 w-full select-none btn-red"
            style={{
              background: canReveal ? C_RED : C_SURFACE2,
              color: canReveal ? '#FFFFFF' : C_MUTED,
              border: `1px solid ${canReveal ? C_RED : C_BORDER}`,
              borderRadius: 14, padding: 16, fontSize: 16, fontWeight: 800,
              cursor: canReveal ? 'pointer' : 'not-allowed',
            }}
          >
            <Dice5 size={18} />
            {pending ? 'Lock your player into a slot' : dailyRevealed >= 8 ? 'All players revealed' : `Reveal next player (${dailyRevealed}/8)`}
          </button>
        ) : (
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
        )}
        </div>
      </div>

      {showStats ? (() => {
        const games = loadGames();
        const daily = loadDaily();
        const MODE_LABELS = { normal: 'Normal', hard: 'Hard', legends: 'Legends', daily: 'Daily' };
        const bestPerMode = Object.keys(MODE_LABELS).map((m) => {
          const gs = games.filter((g) => g.mode === m);
          return { m, label: MODE_LABELS[m], best: gs.length ? Math.max(...gs.map((g) => g.overall)) : null };
        });
        const avgEff = games.length ? Math.round(games.reduce((a, g) => a + (g.eff || 0), 0) / games.length) : 0;
        const perfects = games.filter((g) => g.perfect).length;
        return (
          <Modal title="Your stats" onClose={() => setShowStats(false)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              {[['Games played', games.length], ['Avg efficiency', `${avgEff}%`], ['Perfect games', perfects], ['Daily streak', daily.streak || 0]].map(([label, value]) => (
                <div key={label} style={{ background: C_SURFACE2, border: `1px solid ${C_BORDER}`, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C_ACCENT }}>{value}</div>
                  <div style={{ fontSize: 10, color: C_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Best overall by mode</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {bestPerMode.map((b) => (
                <span key={b.m} style={{ fontSize: 12, color: C_TEXT, border: `1px solid ${C_BORDER}`, borderRadius: 8, padding: '4px 8px' }}>{b.label}: <strong>{b.best == null ? '—' : b.best}</strong></span>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Recent games</div>
            {games.length === 0 ? (
              <div style={{ fontSize: 12, color: C_MUTED }}>No games yet — finish a build to start tracking.</div>
            ) : games.slice(0, 10).map((g) => (
              <div key={g.id} className="flex items-center justify-between" style={{ fontSize: 12, padding: '6px 0', borderBottom: `1px solid ${C_BORDER}`, gap: 8 }}>
                <span style={{ color: C_MUTED, flex: 1 }}>{new Date(g.dateISO).toLocaleDateString()}</span>
                <span style={{ textTransform: 'capitalize', color: C_MUTED, flex: 1 }}>{g.mode}{g.daily ? ` #${g.daily}` : ''}</span>
                <span style={{ flex: 1, textAlign: 'right' }}><strong>{g.overall}</strong> <span style={{ color: C_MUTED }}>vs {g.best}</span></span>
                <span style={{ color: C_RED, width: 14, textAlign: 'center' }}>{g.perfect ? '✓' : ''}</span>
              </div>
            ))}
          </Modal>
        );
      })() : null}
    </div>
  );
}
