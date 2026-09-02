/**
 * router-hero.js — the Smart Router hero (02.09.26).
 *
 * No device. A living switchboard drawn in the site's own language: incoming
 * tasks as cornered chips, a dotted core that decides, four tier nodes that
 * light up as the tasks land, counters and a savings figure that climb.
 * The scroll scrubs the first tasks; once the move completes it runs live.
 */
const TIERS = [
  { id: 'local',  name: 'Local',  model: 'ollama · qwen3-coder', tint: '#dfff3f', y: 0.215 },
  { id: 'fast',   name: 'Fast',   model: 'gemini-3.7-flash',     tint: '#57ded3', y: 0.405 },
  { id: 'strong', name: 'Strong', model: 'claude-sonnet-5',      tint: '#b8a4f8', y: 0.595 },
  { id: 'ultra',  name: 'Ultra',  model: 'claude-fable-5-1',     tint: '#f99c00', y: 0.785 },
];
const TASKS = [
  ['Explore the repo · 14 files', 'fast', 0.004, 0.19],
  ['Refactor retry backoff · 3 modules', 'strong', 0.31, 3.4],
  ['Run the test suite · 42 tests', 'local', 0, 0.9],
  ['Design the landing hero', 'ultra', 1.12, 0],
  ['Rename a config flag', 'fast', 0.002, 0.12],
  ['Audit the auth flow · 9 files', 'strong', 0.27, 2.6],
  ['Summarize the diff', 'local', 0, 0.4],
  ['Plan the schema migration', 'ultra', 0.84, 0],
  ['Fix a flaky timeout', 'strong', 0.22, 1.9],
  ['Explain a stack trace', 'fast', 0.003, 0.15],
];
// Two compositions: the full switchboard, and a compact one for narrow hosts
// (the mobile work box), where the same drawing would shrink its type to 4px.
const FULL = { W: 1000, H: 545, CORE: { x: 500, y: 262, r: 60 }, CHIP: { x: 62, w: 232, h: 52, gap: 66, slots: 5, top: 104, center: 2 },
  NODE: { x: 700, w: 240, h: 66 }, F: 1, models: true, header: true, footerRight: true, chipsLabel: true };
const COMPACT = { W: 620, H: 500, CORE: { x: 318, y: 248, r: 46 }, CHIP: { x: 22, w: 188, h: 50, gap: 0, slots: 1, top: 223, center: 0 },
  NODE: { x: 418, w: 180, h: 58 }, F: 1.22, models: false, header: true, footerRight: false, chipsLabel: false };
let L = FULL;
let W = L.W, H = L.H, CORE = L.CORE, CHIP = L.CHIP, NODE = L.NODE;
const CYCLE_S = 2.7;          // seconds per task when live
const SCRUB_TASKS = 3.0;      // tasks routed across the scrub
const SAVED_BASE = 101.84;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hex = (h, a) => {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};
const tierOf = (id) => TIERS.find((t) => t.id === id);

// fibonacci sphere, unit radius
function sphere(n) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return pts;
}

export function createRouterHero(host) {
  const cv = host.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const PTS = sphere(420);
  let dpr = 1, cw = 0, ch = 0, sc = 1, ox = 0, oy = 0;
  let p = 0;                 // progress in tasks (float)
  let live = false, running = false, raf = 0, lastNow = 0, spin = 0;

  function resize() {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    L = r.width < 440 ? COMPACT : FULL;
    W = L.W; H = L.H; CORE = L.CORE; CHIP = L.CHIP; NODE = L.NODE;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cw !== r.width || ch !== r.height) {
      cw = r.width; ch = r.height;
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    }
    sc = Math.min(cw / W, ch / H);
    ox = (cw - W * sc) / 2; oy = (ch - H * sc) / 2;
    return true;
  }

  // ---------------------------------------------------------------- state from p
  function state() {
    const done = Math.floor(p);
    const phase = p - done;
    const settled = done + (phase >= 0.92 ? 1 : 0);   // tasks whose landing already counted
    const counts = { local: 0, fast: 0, strong: 0, ultra: 0 };
    let saved = SAVED_BASE, spent = 0;
    for (let k = 0; k < settled; k++) {
      const t = TASKS[k % TASKS.length];
      counts[t[1]] += 1; saved += t[3]; spent += t[2];
    }
    return { done, phase, settled, counts, saved, spent, task: TASKS[done % TASKS.length] };
  }

  // ---------------------------------------------------------------- drawing
  function cornered(x, y, w, h, color, len = 12, full = false) {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    if (full) { ctx.strokeRect(x + 0.5, y + 0.5, w, h); return; }
    const L = Math.min(len, w / 3, h / 3);
    ctx.beginPath();
    ctx.moveTo(x, y + L); ctx.lineTo(x, y); ctx.lineTo(x + L, y);
    ctx.moveTo(x + w - L, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + L);
    ctx.moveTo(x + w, y + h - L); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - L, y + h);
    ctx.moveTo(x + L, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - L);
    ctx.stroke();
  }
  function text(str, x, y, font, color, align = 'left', tracking = 0) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (!tracking) { ctx.fillText(str, x, y); return; }
    // manual tracking for the small-caps labels
    let cx = x;
    if (align !== 'left') {
      let w = 0; for (const c of str) w += ctx.measureText(c).width + tracking;
      cx = align === 'center' ? x - w / 2 : x - w;
      ctx.textAlign = 'left';
    }
    for (const c of str) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + tracking; }
  }
  function fit(str, maxW, font) {
    ctx.font = font;
    if (ctx.measureText(str).width <= maxW) return str;
    let s = str;
    while (s.length > 2 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function chipPath(y) {
    const p0 = { x: CHIP.x + CHIP.w, y }, p3 = { x: CORE.x - CORE.r - 6, y: CORE.y };
    return [p0, { x: p0.x + 90, y: p0.y }, { x: p3.x - 90, y: p3.y }, p3];
  }
  function tierPath(tier) {
    const p0 = { x: CORE.x + CORE.r + 6, y: CORE.y }, p3 = { x: NODE.x, y: H * tier.y };
    return [p0, { x: p0.x + 80, y: p0.y }, { x: p3.x - 80, y: p3.y }, p3];
  }
  function strokePath(P, from, to, color, width, dash) {
    ctx.beginPath();
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = from + (to - from) * (i / n);
      const q = bez(P[0], P[1], P[2], P[3], t);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function glowDot(x, y, color, r = 4) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    g.addColorStop(0, hex(color, 0.55)); g.addColorStop(1, hex(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function draw(now) {
    if (!resize()) return;
    const S = state();
    const { phase, task } = S;
    const tier = tierOf(task[1]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.translate(ox, oy); ctx.scale(sc, sc);

    const MONO = (px, w = 400) => `${w} ${Math.round(px * L.F)}px "IBM Plex Mono", ui-monospace, monospace`;
    const SANS = (px, w = 300) => `${w} ${Math.round(px * L.F)}px "Montserrat", -apple-system, sans-serif`;
    const border = '#404040', dim = '#71717a', mid = '#a1a1aa', hi = '#d4d4d8', top = '#fafafa';

    // header line
    const mx = CHIP.x, mr = W - CHIP.x;
    text('SMART ROUTER · SESSION 4', mx, 40 * L.F, MONO(11), mid, 'left', 2.2);
    if (L.footerRight) text('AUTO · HYBRID TIER', mr, 40 * L.F, MONO(11), dim, 'right', 2.2);
    ctx.strokeStyle = border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(mx, 60 * L.F + 0.5); ctx.lineTo(mr, 60 * L.F + 0.5); ctx.stroke();

    // ---- incoming chips (a column that slides up one slot per task; one chip in the compact layout)
    if (L.chipsLabel) text('INCOMING', CHIP.x, CHIP.top - 28, MONO(10), dim, 'left', 2);
    const slide = ease(clamp(phase / 0.2));           // the column settles during the first 20%
    const centerSlot = CHIP.center;                    // the current task's slot
    let curY;
    if (CHIP.slots > 1) {
      ctx.save();
      ctx.beginPath(); ctx.rect(CHIP.x - 10, CHIP.top - 14, CHIP.w + 40, CHIP.gap * CHIP.slots + 10); ctx.clip();
      for (let s = -1; s <= CHIP.slots; s++) {
        const k = S.done + (s - centerSlot);            // task index in this slot
        if (k < 0) continue;
        const t = TASKS[k % TASKS.length];
        const y = CHIP.top + (s + (1 - slide)) * CHIP.gap;
        const isCur = s === centerSlot;
        const past = s < centerSlot;
        ctx.globalAlpha = isCur ? 1 : past ? 0.35 : 0.55;
        cornered(CHIP.x, y, CHIP.w, CHIP.h, isCur ? hi : border, 12, isCur);
        const tt = tierOf(t[1]);
        if (past) { ctx.fillStyle = tt.tint; ctx.fillRect(CHIP.x, y + CHIP.h - 2, CHIP.w, 2); }
        text(fit(t[0], CHIP.w - 28, SANS(14, isCur ? 400 : 300)), CHIP.x + 14, y + CHIP.h / 2, SANS(14, isCur ? 400 : 300), isCur ? top : mid);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      curY = CHIP.top + centerSlot * CHIP.gap + CHIP.h / 2;
    } else {
      // one chip: the current task slides in from below and settles
      const y = CHIP.top + (1 - slide) * 18;
      ctx.globalAlpha = 0.3 + 0.7 * slide;
      cornered(CHIP.x, y, CHIP.w, CHIP.h, hi, 12, true);
      text(fit(task[0], CHIP.w - 24, SANS(13, 400)), CHIP.x + 12, y + CHIP.h / 2, SANS(13, 400), top);
      ctx.globalAlpha = 1;
      text(`TASK ${S.done + 1}`, CHIP.x, CHIP.top - 16, MONO(9), dim, 'left', 2);
      curY = y + CHIP.h / 2;
    }

    // ---- the circuit (faint), then the active route
    for (const tr of TIERS) strokePath(tierPath(tr), 0, 1, border, 1, [3, 6]);
    strokePath(chipPath(curY), 0, 1, border, 1, [3, 6]);
    const inT = clamp((phase - 0.2) / 0.3);            // chip → core
    const outT = clamp((phase - 0.62) / 0.3);          // core → tier
    if (inT > 0) {
      const P = chipPath(curY);
      strokePath(P, 0, ease(inT), hex(tier.tint, 0.9), 1.5);
      const q = bez(P[0], P[1], P[2], P[3], ease(inT));
      if (inT < 1) glowDot(q.x, q.y, tier.tint);
    }
    if (outT > 0) {
      const P = tierPath(tier);
      strokePath(P, 0, ease(outT), hex(tier.tint, 0.9), 1.5);
      const q = bez(P[0], P[1], P[2], P[3], ease(outT));
      if (outT < 1) glowDot(q.x, q.y, tier.tint);
    }

    // ---- the core: a dotted sphere that thinks
    const thinking = clamp((phase - 0.5) / 0.12);      // 0.50–0.62: the decision
    spin += (0.004 + 0.03 * Math.sin(Math.PI * thinking) * (thinking > 0 && thinking < 1 ? 1 : 0)) * (now ? 1 : 0);
    const a = spin + p * 0.35, b = Math.sin(spin * 0.7) * 0.35;
    const cosA = Math.cos(a), sinA = Math.sin(a), cosB = Math.cos(b), sinB = Math.sin(b);
    const R = CORE.r + 6 * Math.sin(Math.PI * clamp(thinking));
    // rings
    ctx.strokeStyle = border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(CORE.x, CORE.y, R + 22, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.arc(CORE.x, CORE.y, R + 36, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // the lit arc toward the chosen tier
    if (phase >= 0.5) {
      const ang = Math.atan2(H * tier.y - CORE.y, NODE.x - CORE.x);
      const arcT = clamp((phase - 0.5) / 0.15);
      ctx.strokeStyle = hex(tier.tint, 0.9); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(CORE.x, CORE.y, R + 22, ang - 0.45 * arcT, ang + 0.45 * arcT); ctx.stroke();
    }
    // points, back to front
    const proj = [];
    for (const [x0, y0, z0] of PTS) {
      const x1 = x0 * cosA - z0 * sinA, z1 = x0 * sinA + z0 * cosA;
      const y1 = y0 * cosB - z1 * sinB, z2 = y0 * sinB + z1 * cosB;
      proj.push([CORE.x + x1 * R, CORE.y + y1 * R, z2]);
    }
    proj.sort((u, v) => u[2] - v[2]);
    const tintMix = clamp(thinking) * 0.7 + (phase > 0.62 ? 0.7 : 0);
    for (const [x, y, z] of proj) {
      const d = (z + 1) / 2;                            // 0 back … 1 front
      const alpha = 0.18 + 0.72 * d;
      ctx.fillStyle = tintMix > 0 ? hex(tier.tint, alpha * (0.35 + 0.65 * tintMix)) : `rgba(212,212,216,${alpha})`;
      const r = 0.9 + 1.4 * d;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    text('ROUTER', CORE.x, CORE.y + R + 52 * L.F, MONO(10), dim, 'center', 2.2);
    // the decision, typed out
    if (phase >= 0.62) {
      const line = L.models
        ? `→ ${tier.id} · ${tier.model} · $${task[2].toFixed(task[2] >= 1 ? 2 : 3)}`
        : `→ ${tier.id} · $${task[2].toFixed(task[2] >= 1 ? 2 : 3)}`;
      const n = Math.round(clamp((phase - 0.62) / 0.22) * line.length);
      text(line.slice(0, n), CORE.x, CORE.y + R + 74 * L.F, MONO(12), hi, 'center');
    }

    // ---- tier nodes
    const total = Math.max(1, S.settled);
    for (const tr of TIERS) {
      const y = H * tr.y - NODE.h / 2;
      const hit = tr === tier && phase >= 0.92 ? 1 - (phase - 0.92) / 0.08 : tr === tier && outT >= 1 ? 1 : 0;
      const recent = tr === tier && phase >= 0.62;
      if (hit > 0) { ctx.fillStyle = hex(tr.tint, 0.14 * hit); ctx.fillRect(NODE.x, y, NODE.w, NODE.h); }
      cornered(NODE.x, y, NODE.w, NODE.h, recent ? tr.tint : border, 12, recent);
      const ny = L.models ? y + 25 : y + NODE.h / 2;
      ctx.fillStyle = tr.tint; ctx.fillRect(NODE.x + 14, ny - 3, 6, 6);
      text(tr.name, NODE.x + 30, ny, SANS(16, 400), top);
      if (L.models) text(tr.model, NODE.x + 30, y + 49, MONO(11), dim);
      text(`×${S.counts[tr.id]}`, NODE.x + NODE.w - 14, ny, MONO(13), recent ? tr.tint : mid, 'right');
      const share = S.counts[tr.id] / total;
      ctx.fillStyle = border; ctx.fillRect(NODE.x, y + NODE.h - 2, NODE.w, 2);
      ctx.fillStyle = tr.tint; ctx.fillRect(NODE.x, y + NODE.h - 2, NODE.w * share, 2);
    }

    // ---- footer figures
    ctx.strokeStyle = border; ctx.beginPath(); ctx.moveTo(mx, H - 62 * L.F + 0.5); ctx.lineTo(mr, H - 62 * L.F + 0.5); ctx.stroke();
    text(`saved $${S.saved.toFixed(2)}`, mx, H - 36 * L.F, SANS(17, 300), '#dfff3f');
    text(`spent $${S.spent.toFixed(2)}`, mx + 200 * L.F, H - 36 * L.F, MONO(12), mid);
    if (L.footerRight) text('76% LOWER COST · 3,024 TURNS BENCHMARKED', mr, H - 36 * L.F, MONO(10), dim, 'right', 1.8);
    else text('76% LOWER COST', mr, H - 36 * L.F, MONO(10), dim, 'right', 1.8);
  }

  // ---------------------------------------------------------------- loop
  function frame(now) {
    if (!running) return;
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
    lastNow = now;
    if (live) p += dt / CYCLE_S;
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  const api = {
    /** scroll-scrub: t 0→1 routes the first tasks; keep drawing so the core keeps breathing */
    scrub(t) {
      if (!live) p = clamp(t) * SCRUB_TASKS;
      api.start();
    },
    setLive(on) {
      if (on && !live) { live = true; }
      if (!on && live) { live = false; }
    },
    start() { if (running) return; running = true; lastNow = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    draw: () => draw(performance.now()),
  };
  return api;
}
