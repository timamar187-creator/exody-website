/**
 * app.js — the stage: grid math, pinned sections, the travelling orb's
 * anchor + aperture mask, section connectors, corner marks, text reveals,
 * printed captions, loader, rulers.  One requestAnimationFrame drives it all.
 */
import { createBubble } from './bubble.js?v=mtk9j6as';
import { createRouterHero } from './router-hero.js?v=mtk9j6as';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const px = (n) => `${Math.round(n)}px`;

// ---------------------------------------------------------------- grid
const G = { vw: 0, vh: 0, K: 72, rows: 12, cols: 22, maxW: 0, gridX: 0, pinning: true };
const HERO_PLACEMENT = { 16: [1, 2, 2, 4], 18: [2, 3, 3, 5], 20: [2, 3, 3, 5], 22: [3, 4, 4, 6], 24: [3, 4, 4, 6], 26: [3, 4, 5, 7], 28: [3, 4, 7, 9], 30: [3, 4, 7, 9] };
// pinned scroll budget per section, in viewport heights
const DIST = { hero: 2.2, work: 5, services: 5, about: 3, footer: 1.6 };
// mobile: only Product and Capabilities pin (their rails), the rest flows
const DIST_M = { work: 3.2, services: 4.2 };
const LABEL = { hero: '', work: 'Product', services: 'Capabilities', about: 'About', footer: 'Contact' };
// ── MOBILE FLOW (02.09.26): the reference's non-pinning layout. Sections run in
// normal flow, one column of blocks; the orb docks in whichever aperture is on
// screen; the work heroes play their move on entry instead of on scroll.
const MOBILE = innerWidth < 900 || innerHeight < 560;
document.documentElement.classList.toggle('is-mobile', MOBILE);

function measureVh() {
  const d = document.createElement('div');
  d.style.cssText = 'position:absolute;height:100svh;width:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(d);
  const h = d.offsetHeight;
  d.remove();
  return h || innerHeight;
}
function computeMaxWidth(vw, bs) {
  if (!bs || !vw) return 0;
  const target = vw * 0.9, cap = vw * 0.94;
  let aligned = Math.round(target / (2 * bs)) * 2 * bs;
  aligned = Math.min(aligned, Math.floor(cap / (2 * bs)) * 2 * bs);
  aligned = Math.max(aligned, 6 * bs);
  return Math.round(aligned);
}
function layoutGrid() {
  G.vw = innerWidth;
  G.vh = measureVh();
  const bs0 = G.vh / 12;
  const n0 = Math.round(computeMaxWidth(G.vw, bs0) / bs0);
  G.pinning = n0 >= 12 && G.vh >= 560 && G.vw >= 900;
  G.rows = G.pinning ? 12 : Math.max(2, Math.floor(Math.floor(G.vh / 54) / 2) * 2);
  G.K = Math.round(G.vh / G.rows);
  G.maxW = computeMaxWidth(G.vw, G.K);
  G.cols = Math.round(G.maxW / G.K);
  G.gridX = (G.vw / 2) % G.K;
  const r = document.documentElement.style;
  r.setProperty('--k', px(G.K));
  r.setProperty('--k-num', String(G.K));
  r.setProperty('--cols', String(G.cols));
  r.setProperty('--max-w', px(G.maxW));
  r.setProperty('--vh', px(G.vh));
  r.setProperty('--grid-x', px(G.gridX));
  r.setProperty('--corner-length', px(Math.round(G.K / 3)));
  const listSpan = G.cols >= 16 ? 8 : 6;
  G.span = Math.max(3, Math.floor((G.cols - listSpan) / 2));
  r.setProperty('--span', String(G.span));
  const wide = G.cols >= 18;
  r.setProperty('--about-img-c', wide ? '15' : '13');
  r.setProperty('--about-ap-s', wide ? '6' : '4');
  r.setProperty('--ft-form-c', wide ? '15' : '13');
  r.setProperty('--ft-ap-s', wide ? '6' : '5');
  r.setProperty('--work-ap-s', G.cols >= 16 ? '6' : '5');
  r.setProperty('--svc-list-s', G.cols >= 16 ? '8' : '6');
  const key = Math.max(16, Math.min(30, G.cols - (G.cols % 2)));
  const [ll, lr, wl, wr] = HERO_PLACEMENT[key] || HERO_PLACEMENT[22];
  r.setProperty('--lbl-l', String(ll));
  r.setProperty('--lbl-r', String(lr));
  r.setProperty('--wrd-l', String(wl));
  r.setProperty('--wrd-r', String(wr));
  for (const s of SEC) {
    if (MOBILE) {
      s.el.style.height = '';
      if (s.track) s.track.style.height = px((DIST_M[s.name] + 1) * G.vh);
    } else {
      s.el.style.height = px((DIST[s.name] + 1) * G.vh);
    }
  }
  r.setProperty('--hero-h', MOBILE ? 'auto' : px((DIST.hero + 1) * G.vh));
}

// ---------------------------------------------------------------- sections
const SEC = $$('.sec').map((el) => ({
  name: el.dataset.section,
  el,
  pin: $('.pin', el),
  blk: $('.blk', el),
  ap: $('[data-aperture]', el),
  cbs: $$('.cb', el).filter((c) => c.id !== 'hero-cb' && !c.closest('[data-aperture]')),
  trs: [],
  p: 0,
  pinned: false,
  active: false,
  top: 0,
  h: 0,
}));
const byName = Object.fromEntries(SEC.map((s) => [s.name, s]));
if (MOBILE) {
  // Work: image → bar → text/tech, like the reference at 390px. Each case's text
  // and tech row move under the bar, shown for the current case only.
  const bar = $('.work-bar');
  const det = document.createElement('div');
  det.className = 'work-details';
  det.id = 'work-details';
  bar.after(det);
  $$('.case').forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'case-details' + (i === 0 ? ' is-cur' : '');
    d.dataset.case = String(i);
    const txt = $('.txt', c), tech = $('.tech', c);
    if (txt) d.appendChild(txt);
    if (tech) d.appendChild(tech);
    det.appendChild(d);
  });
  // Header: the section nav folds into a menu.
  const btn = document.createElement('button');
  btn.className = 'menu-btn cell';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Menu');
  btn.innerHTML = '<div class="cb"><i></i><i></i><i></i><i></i></div><i></i><span>Menu</span>';
  $('#header .in').appendChild(btn);
  const menu = document.createElement('nav');
  menu.id = 'menu';
  menu.setAttribute('aria-label', 'Sections');
  menu.innerHTML = ['work', 'services', 'about', 'footer'].map((n, i) =>
    `<a href="#${n}-section" data-goto="${n}"><div class="cb is-full"><i></i><i></i><i></i><i></i></div><span class="n">0${i + 1}</span>${LABEL[n]}</a>`).join('') +
    '<div class="foot">Exody · autonomous coding agent</div>';
  document.body.appendChild(menu);
  btn.addEventListener('click', () => document.body.classList.toggle('menu-open'));
  menu.addEventListener('click', () => document.body.classList.remove('menu-open'));
  // Product + Capabilities pin like the desktop: the vertical scroll drives the
  // rails sideways (the owner: "horizontal while I scroll normally, like desktop").
  for (const name of ['work', 'services']) {
    const s = byName[name];
    const track = document.createElement('div');
    track.className = 'pintrack';
    s.pin.parentNode.insertBefore(track, s.pin);
    track.appendChild(s.pin);
    s.track = track;
  }
  // Capabilities: the stats, the orb box and the testimonials flow after the pinned rail.
  const sv = byName.services;
  const rest = document.createElement('div');
  rest.className = 'blk svc-rest';
  rest.appendChild($('.svc-window', sv.el));
  rest.appendChild($('.svc-test', sv.el));
  sv.el.appendChild(rest);
  sv.tail = rest;
  // Capabilities: one card per service on the same kind of rail.
  const list = $('.svc-list');
  const titles = $$('#svc-title .tt').map((t) => t.textContent.trim());
  const descs = $$('#svc-desc .dd').map((d) => d.textContent.trim());
  const cards = document.createElement('div');
  cards.className = 'svc-cards';
  cards.innerHTML = titles.map((t, i) =>
    `<div class="svc-card"><div class="cb is-full"><i></i><i></i><i></i><i></i></div>` +
    `<div class="svc-sq">${titles.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>` +
    `<div class="ct">${t}</div>` +
    `<div class="svc-kind${i >= 3 ? ' is-design' : ''}"><span class="bg"></span><span class="word dev">Development</span><span class="word des">Design</span></div>` +
    `<p class="cd">${descs[i]}</p><span class="hint">${i + 1} / ${titles.length}${i < titles.length - 1 ? ' · scroll' : ''}</span></div>`).join('');
  list.after(cards);
  // Testimonials: swipe, with the arrows as a fallback.
  const win = $('.svc-test .win');
  $('#test-prev').addEventListener('click', () => win.scrollBy({ left: -win.clientWidth, behavior: 'smooth' }));
  $('#test-next').addEventListener('click', () => win.scrollBy({ left: win.clientWidth, behavior: 'smooth' }));
  // A sideways swipe on the bar or the text below it also turns the case.
  let sx = 0, sy = 0;
  for (const z of [$('#work-details'), $('.work-bar')]) {
    z.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    z.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) gotoCase(work.idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
}
// The orb is anchored to the SCREEN on mobile too — the holes scroll over it, so
// it sinks under one box's floor and rises through the next box's ceiling.
let mobileAnchorY = 0;
function measureMobileAnchor() {
  const r = apertureRect(byName.hero);
  mobileAnchorY = r.top + scrollY + r.height / 2;   // document y of the hero hole's centre
}

function measureSections() {
  for (const s of SEC) {
    const r = (s.track || s.el).getBoundingClientRect();
    s.top = r.top + scrollY;
    s.h = r.height;
  }
}

// ---------------------------------------------------------------- text reveal
function splitTR(root) {
  if (root.dataset.split) return;
  root.dataset.split = '1';
  root.classList.add('textreveal');
  const delay0 = parseFloat(root.dataset.delay || '0');
  const letters = (root.textContent || '').replace(/\s+/g, '').length || 1;
  const step = parseFloat(root.dataset.step || String(Math.min(0.0175, 1.3 / letters)));
  let idx = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const text = child.nodeValue;
        if (!text.trim()) continue;
        const frag = document.createDocumentFragment();
        const words = text.split(/(\s+)/);
        for (const w of words) {
          if (!w) continue;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const ws = document.createElement('span');
          ws.className = 'w';
          for (const ch of w) {
            const ls = document.createElement('span');
            ls.className = 'l';
            ls.textContent = ch;
            ls.style.transitionDelay = `${(delay0 + idx * step).toFixed(4)}s`;
            idx++;
            ws.appendChild(ls);
          }
          frag.appendChild(ws);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.classList.contains('l')) {
        walk(child);
      }
    }
  };
  walk(root);
}
function trSet(el, on) {
  if (!el) return;
  if (on) { el.classList.remove('is-exiting'); el.classList.add('is-on'); }
  else if (el.classList.contains('is-on')) {
    el.classList.remove('is-on');
    el.classList.add('is-exiting');
    setTimeout(() => el.classList.remove('is-exiting'), 160);
  }
}
$$('[data-tr]').forEach(splitTR);
for (const s of SEC) s.trs = $$('[data-tr]:not([data-tr-manual])', s.el);

// ---------------------------------------------------------------- hatch cells
$$('[data-hatch]').forEach((svg) => {
  const C = Array.from({ length: 9 }, (_, i) => ((i + 1) / 10) * 100);
  let d = '';
  for (const v of C) d += `<line x1="${v}" y1="0" x2="0" y2="${v}"/><line x1="100" y1="${v}" x2="${v}" y2="100"/><line x1="${100 - v}" y1="0" x2="100" y2="${v}"/><line x1="0" y1="${v}" x2="${100 - v}" y2="100"/>`;
  svg.innerHTML = d;
});

// ---------------------------------------------------------------- about ticker (model logos, inlined so currentColor applies)
{
  const models = ['google', 'claude', 'openai', 'xai', 'kimi', 'deepseek', 'groq'];
  const track = $('#ticker-track');
  Promise.all(models.map((m) => fetch(`assets/logos/models/${m}.svg`).then((r) => r.text()).catch(() => '')))
    .then((svgs) => {
      const html = svgs.map((s, i) => `<span class="mdl" title="${models[i]}">${s}</span>`).join('');
      track.innerHTML = html + html;
    });
}

// ---------------------------------------------------------------- about terminal (typed command, streamed result)
const term = { el: $('#about-term'), timer: null, running: false };
const TERM_SCRIPT = [
  ['cmd', 'exody run "investigate the flaky auth test"'],
  ['out', '› reading 42 files · building the call graph'],
  ['out', '› hypothesis: token clock skew on retry'],
  ['out', '› patch in worktree fix/auth-clock · 3 edits'],
  ['out', '› node --test · <span class="ok">21 passed</span> · 0 failed'],
  ['out', '› verified in browser · screenshot attached'],
  ['ok', '<b>✓</b> done in 3m 41s · cost <span class="ok">$0.19</span>'],
];
function termStop() { term.running = false; clearTimeout(term.timer); }
function termRun() {
  if (!term.el) return;
  termStop();
  term.running = true;
  const el = term.el;
  el.innerHTML = '';
  const later = (fn, ms) => { term.timer = setTimeout(() => { if (term.running) fn(); }, ms); };
  const cmd = document.createElement('div');
  cmd.className = 'ln is-in';
  cmd.innerHTML = '<b>$</b> <span class="typed"></span><span class="cur"></span>';
  el.appendChild(cmd);
  const typed = cmd.querySelector('.typed');
  const text = TERM_SCRIPT[0][1];
  let i = 0;
  const type = () => {
    typed.textContent = text.slice(0, ++i);
    if (i < text.length) later(type, 28 + Math.random() * 40);
    else later(() => { cmd.querySelector('.cur').remove(); stream(1); }, 500);
  };
  const stream = (k) => {
    if (k >= TERM_SCRIPT.length) { later(termRun, 4200); return; }
    const ln = document.createElement('div');
    ln.className = 'ln';
    ln.innerHTML = TERM_SCRIPT[k][1];
    el.appendChild(ln);
    requestAnimationFrame(() => ln.classList.add('is-in'));
    later(() => stream(k + 1), k === TERM_SCRIPT.length - 1 ? 600 : 520 + Math.random() * 500);
  };
  later(type, 400);
}

// ---------------------------------------------------------------- bubble
const bubble = createBubble($('#bubble'), { count: MOBILE ? 12000 : 30000 });
const anchor = { name: 'hero' };

function apertureRect(s) { return s.ap.getBoundingClientRect(); }
/** Aperture centre in viewport coordinates when the section is pinned. */
function pinnedCenter(s) {
  const ar = apertureRect(s), pr = s.pin.getBoundingClientRect();
  return { x: ar.left + ar.width / 2, y: ar.top - pr.top + ar.height / 2, size: Math.min(ar.width, ar.height) };
}
function setAnchor(name, immediate) {
  anchor.name = name;
  const s = byName[name];
  const c = pinnedCenter(s);
  bubble.setTarget(c.x, c.y, c.size, immediate);
  bubble.setSection(name);
}

function updateMask() {
  const c = $('#bubble');
  const imgs = [], sizes = [], poss = [];
  for (const s of SEC) {
    const r = apertureRect(s);
    if (r.bottom <= 0 || r.top >= G.vh) continue;
    let L = r.left, T = r.top, R = r.right, B = r.bottom;
    if (s.name === 'services') { const w = svc.window.getBoundingClientRect(); L = Math.max(L, w.left); R = Math.min(R, w.right); }
    if (R <= L) continue;
    imgs.push('linear-gradient(#000,#000)');
    sizes.push(`${Math.max(0, R - L)}px ${Math.max(0, B - T)}px`);
    poss.push(`${L}px ${T}px`);
  }
  if (!imgs.length) { imgs.push('linear-gradient(#000,#000)'); sizes.push('0px 0px'); poss.push('0px 0px'); }
  c.style.webkitMaskImage = c.style.maskImage = imgs.join(',');
  c.style.webkitMaskSize = c.style.maskSize = sizes.join(',');
  c.style.webkitMaskPosition = c.style.maskPosition = poss.join(',');
  c.style.webkitMaskRepeat = c.style.maskRepeat = 'no-repeat';
}

// ---------------------------------------------------------------- corners + activation
function cornersFull(s, on) {
  for (const cb of s.cbs) cb.classList.toggle('is-full', on);
}
function activate(s, on) {
  if (s.active === on) return;
  s.active = on;
  s.blk.classList.toggle('is-active', on);
  cornersFull(s, on);
  for (const cap of $$('.cap', s.el)) cap.classList.toggle('is-on', on);
  if (on) {
    setTimeout(() => { if (s.active) for (const t of s.trs) trSet(t, true); }, s.name === 'hero' ? 350 : 500);
  } else {
    for (const t of s.trs) trSet(t, false);
  }
  if (s.name === 'work') workActivate(on);
  if (s.name === 'services') servicesActivate(on);
  if (s.name === 'about') { if (on) setTimeout(() => { if (s.active) termRun(); }, 900); else termStop(); }
}

// ---------------------------------------------------------------- hero frame (scroll-closing corners + printed captions)
const heroCb = $('#hero-cb');
const heroCaps = Object.fromEntries($$('#hero-ap .cap').map((c) => [c.dataset.cap, c]));
let heroIntro = 0; // 0..1 after the loader
function heroFrame(p) {
  const ap = byName.hero.ap;
  const w = ap.clientWidth / 2, h = ap.clientHeight / 2;
  const e = clamp(heroIntro);
  const cw = Math.round((1 - e) * w), ch = Math.round((1 - e) * h);
  const q = heroCb.children;
  q[0].style.clipPath = `inset(0px ${cw}px ${ch}px 0px)`;
  q[1].style.clipPath = `inset(0px 0px ${ch}px ${cw}px)`;
  q[2].style.clipPath = `inset(${ch}px ${cw}px 0px 0px)`;
  q[3].style.clipPath = `inset(${ch}px 0px 0px ${cw}px)`;
  heroCaps.tl.textContent = `clip-path: inset(0px ${cw}px ${ch}px 0px)`;
  heroCaps.tr.textContent = `clip-path: inset(0px 0px ${ch}px ${cw}px)`;
  heroCaps.br.textContent = `clip-path: inset(${ch}px 0px 0px ${cw}px)`;
  heroCaps.bl.textContent = `clip-path: inset(${ch}px ${cw}px 0px 0px)`;
  const on = e > 0.02;
  for (const c of Object.values(heroCaps)) c.classList.toggle('is-on', on);
}
for (const i of heroCb.children) i.style.transition = 'none';

// ---------------------------------------------------------------- connector
const cn = { root: $('#connector'), line: $('#cn-line'), top: $('#cn-top'), bottom: $('#cn-bottom'), cap: $('#cn-cap'), label: $('#cn-label'), labelTop: $('#cn-label-top') };
function updateConnector() {
  let shown = false;
  for (let i = 0; i < SEC.length - 1 && !shown; i++) {
    const A = SEC[i], B = SEC[i + 1];
    const ra = (A.tail || A.blk).getBoundingClientRect(), rb = B.blk.getBoundingClientRect();
    // mobile: the line stops half a block short of the content at both ends
    const inset = MOBILE ? G.K * 0.6 : 0;
    const E = ra.bottom + inset, J = rb.top - inset, M = J - E;
    if (M <= 0 || E > G.vh * 1.2 || J < -G.vh * 0.2) continue;
    const p = G.vh;
    const C = 0.5 * p, N = 0.75 * p, O = 0.25 * p + M;
    let t;
    if (E >= N) t = 0; else if (J <= C) t = 1; else t = O > 0 ? clamp((N - E) / O) : 0;
    // mobile: the connector stays as long as its gap is on screen (it used to blink in and
    // out with the travel thresholds); desktop keeps the travelling reveal
    if (MOBILE ? (E > p || J < 0) : (t <= 0 || t >= 1)) continue;
    shown = true;
    // mobile: the connector is a fixture, drawn whole while the gap is on screen (the
    // desktop's travelling reveal left it a stub most of the time on a phone)
    const clip = MOBILE ? 'inset(0)' : t <= 0.5 ? `inset(0% 0% ${(100 - 200 * t).toFixed(1)}% 0%)` : `inset(${((t - 0.5) * 200).toFixed(1)}% 0% 0% 0%)`;
    cn.line.style.top = px(E);
    cn.line.style.height = px(M);
    cn.line.style.clipPath = clip;
    cn.top.style.top = px(E);
    cn.bottom.style.top = px(J);
    const nodeOn = MOBILE || (t > 0.01 && t < 0.99) ? 1 : 0;
    cn.top.style.opacity = nodeOn;
    cn.bottom.style.opacity = nodeOn;
    cn.top.firstElementChild.style.clipPath = MOBILE ? 'inset(25%)' : `inset(${(1 - t) * 50}%)`;
    cn.bottom.firstElementChild.style.clipPath = MOBILE ? 'inset(25%)' : `inset(${t * 50}%)`;
    cn.label.textContent = LABEL[B.name];
    cn.labelTop.textContent = LABEL[A.name];
    cn.cap.style.top = px((E + J) / 2);
    cn.cap.textContent = `clip-path: ${clip}`;
    cn.cap.style.opacity = t <= 0.15 ? t / 0.15 : t >= 0.85 ? (1 - t) / 0.15 : 1;
  }
  cn.root.style.display = shown ? 'block' : 'none';
}

// ---------------------------------------------------------------- WORK
const work = {
  gal: $('#work-gal'),
  cases: $$('.case'),
  name: $('#work-name'),
  idx: 0,
  chatTimer: null,
};
function playChat(caseEl) {
  clearTimeout(work.chatTimer);
  const msgs = $$('.msg', caseEl);
  msgs.forEach((m) => m.classList.remove('is-in'));
  let i = 0;
  const step = () => {
    if (i < msgs.length) { msgs[i].classList.add('is-in'); i++; work.chatTimer = setTimeout(step, 650); }
  };
  work.chatTimer = setTimeout(step, 500);
}
function setCase(i, force) {
  if (i === work.idx && !force) return;
  const prev = work.cases[work.idx];
  const next = work.cases[i];
  work.idx = i;
  for (const c of work.cases) { c.classList.remove('is-cur', 'is-out'); }
  if (prev !== next) prev.classList.add('is-out');
  next.classList.add('is-cur');
  $$('.case-details').forEach((d) => d.classList.toggle('is-cur', Number(d.dataset.case) === i));
  trSet(work.name, false);
  setTimeout(() => { work.name.textContent = next.dataset.name; splitTR(work.name); trSet(work.name, true); }, 170);
  if (!MOBILE) bubble.setTint(next.dataset.tint, 0.85);   // mobile: no hole in the product section, so no case tint
  const trOf = (k) => $('[data-tr]', work.cases[k]) || $(`.case-details[data-case="${k}"] [data-tr]`);
  const tr = trOf(i);
  for (let k = 0; k < work.cases.length; k++) { const t = trOf(k); if (t && k !== i) trSet(t, false); }
  setTimeout(() => trSet(tr, true), 300);
  playChat(next);
  filmPause(next);
  if (MOBILE) { const gal = $('#work-gal'); gal.scrollTo({ left: i * gal.clientWidth, behavior: 'smooth' }); }
}
/* ── SCROLL-SCRUBBED FILM HEROES (02.09.26) ──
   Each case owns a frame sequence (the laptop opening, the phone's 360) drawn
   on a canvas from the case's own scroll progress; when the move completes
   the transparent video loop takes over from the exact same pose. */
const film = { cases: [] };
function filmInit() {
  work.cases.forEach((c, i) => {
    const rh = $('.rhero', c);
    if (rh) { film.cases[i] = { el: rh, rhero: createRouterHero(rh), n: 0, imgs: [], cur: -1, live: false }; return; }
    const el = $('.film', c);
    if (!el) return;
    const cv = $('canvas', el);
    film.cases[i] = {
      el, cv, v: $('video', el), ctx: cv.getContext('2d'),
      n: Number(el.dataset.frames || 0), seq: el.dataset.seq || '',
      imgs: [], cur: -1, live: false,
    };
  });
}
function filmPreload(i) {
  const f = film.cases[i];
  if (!f || f.rhero || f.imgs.length || !f.n) return;
  for (let k = 0; k < f.n; k++) {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { if (f.cur < 0 && k === 0) filmDraw(f, 0); else if (k === f.cur) filmDraw(f, k); };
    im.src = `${f.seq}${String(k).padStart(3, '0')}.webp`;
    f.imgs.push(im);
  }
}
function filmDraw(f, idx) {
  const im = f.imgs[idx];
  if (!im || !im.complete || !im.naturalWidth) { f.cur = idx; return; }
  if (f.cv.width !== im.naturalWidth) { f.cv.width = im.naturalWidth; f.cv.height = im.naturalHeight; }
  f.ctx.clearRect(0, 0, f.cv.width, f.cv.height);
  f.ctx.drawImage(im, 0, 0);
  f.cur = idx;
}
// local = the case's own 0→1 progress; the move plays out over its first 60%.
function filmScrub(i, local) {
  const f = film.cases[i];
  if (!f) return;
  filmPreload(i);
  const t = clamp(local / 0.6, 0, 1);
  if (f.rhero) { f.rhero.scrub(t); f.rhero.setLive(t >= 1); f.live = t >= 1; return; }
  if (t >= 1) {
    if (!f.live) {
      f.live = true; f.el.classList.add('is-live');
      try { f.v.currentTime = 0; } catch (e) {}
      f.v.play().catch(() => {});
    }
    return;
  }
  if (f.live) { f.live = false; f.el.classList.remove('is-live'); f.v.pause(); }
  // The phone's turn is rendered with an ease-out, so the scroll walks the
  // frames with an ease-in: the rotation reads even across the scroll.
  const ease = Number(f.el.dataset.ease || 1);
  const idx = Math.round(Math.pow(t, ease) * (f.n - 1));
  if (idx !== f.cur) filmDraw(f, idx);
  // The laptop never moves: shut on the table, only the lid rises, so the
  // frame sits exactly where the loop's does.
}
// Mobile: no pinned scroll to scrub, so the move plays itself when the case
// arrives (2.6 s), then hands over to the loop exactly like the scrub does.
function filmSequence(i) {
  const f = film.cases[i];
  if (!f) return;
  filmPreload(i);
  f.seqT0 = performance.now();
  f.seqOn = true;
  if (f.rhero) { f.rhero.setLive(false); f.live = false; return; }
  if (f.live) { f.live = false; f.el.classList.remove('is-live'); f.v.pause(); }
}
function filmTick(now) {
  const f = film.cases[work.idx];
  if (!f || !f.seqOn) return;
  const t = clamp((now - f.seqT0) / 2600);
  filmScrub(work.idx, t * 0.62);
  if (t >= 1) f.seqOn = false;
}
function filmPause(cur) {
  film.cases.forEach((f, i) => {
    if (!f || work.cases[i] === cur) return;
    if (f.rhero) { f.rhero.setLive(false); f.rhero.stop(); f.live = false; return; }
    if (f.live) { f.live = false; f.el.classList.remove('is-live'); }
    f.v.pause();
  });
}
filmInit();
filmPreload(0);
function workActivate(on) {
  if (on) { setCase(work.idx, true); }
  else { clearTimeout(work.chatTimer); bubble.setTint(null); filmPause(null); }
  if (on) { for (let k = 0; k < 4; k++) filmPreload(k); }
}
function updateWork(s) {
  if (!s.active || MOBILE) return;
  const i = clamp(Math.floor((s.p - 0.06) / 0.235), 0, 3);
  if (s.p > 0.06) setCase(i);
  filmScrub(i, clamp((s.p - 0.06 - i * 0.235) / 0.235, 0, 1));
}
$('#work-prev').addEventListener('click', () => gotoCase(work.idx - 1));
$('#work-next').addEventListener('click', () => gotoCase(work.idx + 1));
function gotoCase(i) {
  i = clamp(i, 0, 3);
  const s = byName.work;
  if (MOBILE) { scrollTo0(s.top + (i / 4 + 0.03) * (s.h - G.vh)); return; }
  scrollTo0(s.top + (0.06 + i * 0.235 + 0.03) * (s.h - G.vh));
}

// ---------------------------------------------------------------- SERVICES
const svc = {
  sq: $$('#svc-sq i'),
  titles: $$('#svc-title .tt'),
  kind: $('#svc-kind'),
  descs: $$('#svc-desc .dd'),
  strip: $('#svc-strip'),
  window: $('#svc-window'),
  gear: $('#gear'),
  gearCap: $('[data-cap=gear]'),
  stripCap: $('[data-cap=strip]'),
  testTrack: $('#test-track'),
  testCap: $('[data-cap=test]'),
  counters: $$('[data-count]'),
  idx: -1,
  testIdx: 0,
  counted: false,
  stripX: null,
};
function setService(i) {
  if (i === svc.idx) return;
  svc.idx = i;
  svc.sq.forEach((el, k) => el.classList.toggle('on', k === i));
  svc.titles.forEach((el, k) => el.classList.toggle('is-cur', k === i));
  svc.kind.classList.toggle('is-design', i >= 3);
  svc.descs.forEach((el, k) => { el.classList.toggle('is-cur', k === i); trSet(el, k === i); });
}
function runCounters() {
  if (svc.counted) return;
  svc.counted = true;
  const t0 = performance.now();
  const tick = () => {
    const k = clamp((performance.now() - t0) / 1400);
    const e = easeOutCubic(k);
    for (const c of svc.counters) c.textContent = Math.round(parseFloat(c.dataset.count) * e).toLocaleString('en-US');
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function servicesActivate(on) {
  if (on) { svc.idx = -1; setService(0); }
  else { svc.counted = false; for (const c of svc.counters) c.textContent = '0'; }
}
function updateServices(s, now) {
  if (MOBILE) {
    const tw = svc.testTrack.parentElement.clientWidth;
    for (const q of $$('.tq', svc.testTrack)) q.style.width = px(tw);
    svc.testCap.textContent = `scrollLeft: ${Math.round(svc.testTrack.parentElement.scrollLeft)}px`;
    if (!s.active) return;
    const st = $('#svc-stats').getBoundingClientRect();
    if (st.top < G.vh * 0.85 && st.bottom > 0) runCounters();
    const ar = apertureRect(s);
    bubble.setServicesMix(clamp((Math.min(ar.bottom, G.vh) - Math.max(ar.top, 0)) / Math.max(1, ar.height)));
    return;
  }
  const overflow = G.span * G.K;
  const sp = clamp((s.p - 0.6) / 0.25);
  const x = -overflow * (1 - easeOutQuint(sp));
  svc.strip.style.transform = `translateX(${x.toFixed(1)}px)`;
  svc.stripCap.textContent = `translateX: ${Math.round(x)}px`;
  const rot = -s.p * 160;
  svc.gear.style.transform = `rotate(${rot.toFixed(1)}deg)`;
  svc.gearCap.textContent = `transform: translate3d(0px, 0px, 0) rotate(${Math.round(rot)}deg)`;
  const tw = svc.testTrack.parentElement.clientWidth;
  const cardW = tw / 2;
  for (const q of $$('.tq', svc.testTrack)) q.style.width = px(cardW);
  if (!s.active) return;
  const ti = clamp(Math.floor(s.p / 0.13), 0, 5);
  setService(ti);
  if (sp > 0.25) runCounters();
  bubble.setServicesMix(clamp((s.p - 0.15) / 0.5));
  const step = clamp(Math.floor(s.p / 0.16), 0, 5) + svc.testIdx;
  const tx = -clamp(step, 0, 5) * cardW;
  svc.testTrack.style.transform = `translateX(${tx}px)`;
  svc.testCap.textContent = `translateX: ${Math.round(tx)}px`;
  svc.testTrack.dataset.step = String(step);
}
$('#test-prev').addEventListener('click', () => { svc.testIdx = clamp(svc.testIdx - 1, -5, 5); });
$('#test-next').addEventListener('click', () => { svc.testIdx = clamp(svc.testIdx + 1, -5, 5); });
// service descs: the current one only
svc.descs.forEach((d, k) => { d.style.position = k ? 'absolute' : 'relative'; d.style.left = 0; d.style.top = 0; });
$('#svc-desc').style.position = 'relative';

// ---------------------------------------------------------------- ABOUT
const about = { track: $('#ticker-track'), cap: $('[data-cap=ticker]'), x: 0 };
function updateAbout(s, dt) {
  const half = about.track.scrollWidth / 2 || 1;
  const drive = (s.pinned || (MOBILE && s.active)) ? 22 : 0;
  about.x = (about.x + dt * drive + (s.pinned ? 0 : 0)) % half;
  const x = -about.x - clamp(s.p) * 120;
  about.track.style.transform = `translateX(${x.toFixed(1)}px)`;
  about.cap.textContent = `translateX: ${Math.round(x)}px`;
}

// ---------------------------------------------------------------- FOOTER
function updateFooter(s) {
  if (MOBILE) {
    const ar = apertureRect(s);
    bubble.setExplode(s.active ? clamp((G.vh * 0.8 - ar.top) / (G.vh * 0.55)) : 0);
    return;
  }
  bubble.setExplode(s.active ? clamp((s.p - 0.12) / 0.7) : 0);
}

// ---------------------------------------------------------------- rulers
const ruler = { el: $('#ruler'), ticks: $('#ruler-ticks'), head: $('#ruler-head'), line: $('#ruler-line') };
function buildRuler() {
  const nBlocks = Math.round(G.maxW / G.K);
  const count = 10 * nBlocks + 1;
  let h = '';
  for (let i = 0; i < count; i++) {
    const edge = i % 10 === 0, mid = i % 10 === 5;
    h += `<i style="height:${edge ? 14 : mid ? 10 : 5}px;opacity:${edge ? 1 : mid ? 0.6 : 0.3}"></i>`;
  }
  ruler.ticks.innerHTML = h;
}
function updateRuler(cur) {
  const on = ready && cur && cur.pinned;
  ruler.el.classList.toggle('is-on', !!on);
  if (on) {
    const x = cur.p * G.maxW;
    ruler.head.style.transform = `translateX(${x.toFixed(1)}px)`;
    ruler.line.style.width = px(x);
  }
  const doc = document.documentElement;
  const dp = clamp(scrollY / Math.max(1, doc.scrollHeight - innerHeight));
  $('#scrollthumb').style.transform = `translateY(${(dp * (innerHeight - 10 - 40)).toFixed(1)}px)`;
}

// ---------------------------------------------------------------- smooth scroll (wheel → eased scrollTo)
const scroll = { target: 0, cur: 0, animating: false };
function maxScroll() { return document.documentElement.scrollHeight - innerHeight; }
addEventListener('wheel', (e) => {
  if (!G.pinning) return;
  e.preventDefault();
  const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
  if (!scroll.animating) { scroll.cur = scrollY; scroll.target = scrollY; }
  scroll.target = clamp(scroll.target + d, 0, maxScroll());
  scroll.animating = true;
}, { passive: false });
addEventListener('scroll', () => { if (!scroll.animating) { scroll.cur = scrollY; scroll.target = scrollY; } }, { passive: true });
function scrollTo0(y) {
  if (MOBILE) { window.scrollTo({ top: clamp(y, 0, maxScroll()), behavior: 'smooth' }); return; }
  scroll.cur = scrollY; scroll.target = clamp(y, 0, maxScroll()); scroll.animating = true;
}
function stepScroll() {
  if (!scroll.animating) return;
  scroll.cur += (scroll.target - scroll.cur) * 0.11;
  if (Math.abs(scroll.target - scroll.cur) < 0.4) { scroll.cur = scroll.target; scroll.animating = false; }
  window.scrollTo(0, scroll.cur);
}
$$('[data-goto]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const s = byName[a.dataset.goto];
  measureSections();
  scrollTo0(MOBILE ? s.top - G.K * 0.5 : s.top + 0.12 * (s.h - G.vh));
}));

// ---------------------------------------------------------------- header + hover corners
{
  $$('#header .nav, .cta, .work-bar .btn, .svc-test .nav button, .ft-bar .cell, .ft-bar .send').forEach((b) => {
    b.addEventListener('mouseenter', () => b.querySelector('.cb')?.classList.add('is-full'));
    b.addEventListener('mouseleave', () => { if (!b.closest('.blk')?.classList.contains('is-active')) b.querySelector('.cb')?.classList.remove('is-full'); });
  });
}

// ---------------------------------------------------------------- loader
let ready = false;
function buildLoaderGrid() {
  const grid = $('#loader-grid');
  const K = G.K;
  const left = ((G.vw / 2) % K) - K;
  const colsN = Math.ceil((G.vw + K) / K) + 1;
  const rowsN = G.rows;
  grid.style.left = px(left);
  grid.style.width = px(colsN * K);
  grid.style.gridTemplateRows = `repeat(${rowsN}, ${K}px)`;
  let h = '';
  for (let r = 0; r < rowsN; r++) {
    h += `<div class="lrow" style="grid-template-columns:repeat(${colsN}, ${K}px)">`;
    for (let c = 0; c < colsN; c++) h += `<div class="lcell" style="width:${K}px;height:${K}px"></div>`;
    h += '</div>';
  }
  grid.innerHTML = h;
}
async function runLoader() {
  const word = $('#loader-word');
  requestAnimationFrame(() => requestAnimationFrame(() => word.classList.add('is-visible')));
  setTimeout(() => word.classList.add('is-pulsing'), 800);
  const t0 = performance.now();
  await Promise.all([document.fonts.ready.catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  await new Promise((r) => setTimeout(r, Math.max(0, 1800 - (performance.now() - t0))));
  word.classList.add('is-exiting');
  const loader = $('#loader');
  setTimeout(() => loader.classList.add('is-exiting'), 250);
  setTimeout(() => { loader.remove(); }, 900);
  document.body.classList.add('is-ready');
  ready = true;
  $$('#header .cb').forEach((c) => c.classList.add('is-full'));
  // hero intro: corners open, labels & words rise
  const t1 = performance.now();
  const open = () => {
    heroIntro = easeOutCubic(clamp((performance.now() - t1) / 700));
    if (heroIntro < 1) requestAnimationFrame(open);
  };
  requestAnimationFrame(open);
  activate(byName.hero, true);
  probeAfterLoad();
}

// ---------------------------------------------------------------- main loop
let lastNow = 0;
let cur = null;
function frame(now) {
  const dt = Math.min(0.05, lastNow ? (now - lastNow) / 1000 : 0.016);
  lastNow = now;
  stepScroll();
  const y = scrollY;

  // section progress + pinned state
  cur = null;
  for (const s of SEC) {
    const range = Math.max(1, s.h - G.vh);
    s.p = clamp((y - s.top) / range);
    s.pinned = (y >= s.top - 1 || s === SEC[0]) && y < s.top + range;
    if (s.pinned) cur = s;
  }
  if (!cur && y < SEC[0].top + 1) cur = SEC[0];
  if (!cur && y >= SEC[SEC.length - 1].top) cur = SEC[SEC.length - 1];

  if (MOBILE) {
    // activation: a block is live from the first pixel on screen to the last —
    // a title that only appeared once a third of the viewport was in (02.09.26,
    // the owner's phone) is a title the visitor scrolls past unread.
    for (const s of SEC) {
      if (s === byName.hero && !ready) continue;
      const br = s.el.getBoundingClientRect();
      const vis = Math.min(br.bottom, G.vh) - Math.max(br.top, 0);
      activate(s, vis > 0);
      if (s.tail) s.tail.classList.toggle('is-active', s.active);
    }
    // the pinned rails: the section's progress picks the case / the card
    {
      const w = byName.work;
      if (w.track) {
        const i = clamp(Math.floor(w.p * 4), 0, 3);
        if (i !== work.idx) setCase(i);
        filmScrub(i, clamp(w.p * 4 - i));
      }
      const sv = byName.services;
      const cards = $('.svc-cards');
      if (sv.track && cards) {
        const i = clamp(Math.floor(sv.p * 6), 0, 5);
        if (cards.dataset.idx !== String(i)) { cards.dataset.idx = String(i); cards.scrollTo({ left: i * cards.clientWidth, behavior: 'smooth' }); }
      }
    }
    // the orb docks in the aperture with the most of itself on screen and scrolls with it
    if (ready) {
      let best = null, bestA = 0;
      for (const s of SEC) {
        if (!s.ap || s.ap.offsetParent === null) continue;
        const r = apertureRect(s);
        const a = Math.max(0, Math.min(r.bottom, G.vh) - Math.max(r.top, 0)) * r.width;
        if (a > bestA) { bestA = a; best = s; }
      }
      if (best) {
        const r = apertureRect(best);
        // screen-fixed: the hero hole's centre height, clamped into the viewport
        const ay = clamp(mobileAnchorY, G.vh * 0.3, G.vh * 0.82);   // the hero hole's centre is ~0.75vh on a phone
        const c = { x: r.left + r.width / 2, y: ay, size: Math.min(r.width, r.height) };
        if (anchor.name !== best.name) { anchor.name = best.name; bubble.setTarget(c.x, c.y, c.size, true); bubble.setSection(best.name); }
        else bubble.trackTarget(c.x, c.y, c.size);
      }
      bubble.setHeroPath(clamp(y / (G.vh * 0.9)));
    }
    heroFrame(0);
    // the word swap: "Autonomous Engineering" leaves upward as the page scrolls and
    // "Shipping Software" rises into the same slot (each line a beat behind the first)
    {
      const p = clamp((y - G.K * 0.3) / (G.vh * 0.4));
      const L = $$('.hero-words.l .rw > i'), R = $$('.hero-words.r .rw > i');
      // a short lift with a fade, not a full roll: the two phrases never read as four lines
      L.forEach((el, k) => {
        const e = easeInOut(clamp((p - k * 0.08) / 0.92));
        el.style.transition = p > 0 ? 'none' : '';
        el.style.transform = p > 0 ? `translateY(${(-14 * e).toFixed(1)}%)` : '';
        el.style.opacity = p > 0 ? String((1 - e).toFixed(3)) : '';
      });
      R.forEach((el, k) => {
        const e = easeInOut(clamp((p - k * 0.08) / 0.92));
        el.style.transition = 'none';
        el.style.transform = `translateY(${(14 * (1 - e)).toFixed(1)}%)`;
        el.style.opacity = String(e.toFixed(3));
      });
    }
    filmTick(now);
    updateServices(byName.services, now);
    updateAbout(byName.about, dt);
    updateFooter(byName.footer);
  } else {
    // activation (hero activates via the loader)
    for (const s of SEC) {
      if (s === byName.hero && !ready) continue;
      let on = s.pinned || (s === cur && s.name === 'footer');
      if (!on && s.active) {
        // keep the content while the block is still mostly on screen (leaving or re-entering)
        const br = s.blk.getBoundingClientRect();
        const visible = Math.min(br.bottom, G.vh) - Math.max(br.top, 0);
        if (visible > br.height * 0.6) on = true;
      }
      activate(s, on);
    }

    // orb anchor: stay with the current holder until its aperture has hidden the orb, then jump
    if (ready) {
      const holder = byName[anchor.name];
      const hr = apertureRect(holder);
      const c = pinnedCenter(holder);
      const r = c.size * 0.39;
      const hidden = hr.bottom < c.y - r || hr.top > c.y + r;
      const wanted = cur ? cur.name : anchor.name;
      if (wanted !== anchor.name && (hidden || !holder.pinned && Math.abs(SEC.indexOf(cur) - SEC.indexOf(holder)) > 1)) {
        setAnchor(wanted, hidden);
      } else if (!cur && hidden) {
        // between sections: pre-position at the next holder so it rises into place
        const hi = SEC.indexOf(holder);
        const next = y > holder.top ? SEC[hi + 1] : SEC[hi - 1];
        if (next) setAnchor(next.name, true);
      }
      if (holder.pinned || holder === cur) {
        const pc = pinnedCenter(holder);
        bubble.trackTarget(pc.x, pc.y, pc.size);
      }
    }

    // per-section behaviour
    heroFrame(byName.hero.p);
    if (ready && byName.hero.pinned) bubble.setHeroPath(clamp(byName.hero.p / 0.5));
    updateWork(byName.work);
    updateServices(byName.services, now);
    updateAbout(byName.about, dt);
    updateFooter(byName.footer);
  }

  updateMask();
  updateConnector();
  updateRuler(cur);
  bubble.render(now);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- probe (verification only)
// ?probe=1 paints script errors on screen and ?y=<px> / ?case=<i> place the page
// after the loader — so a real WebKit (the iPhone simulator) can be photographed
// at exact positions without gestures.
const PROBE = new URLSearchParams(location.search);
if (PROBE.has('probe')) {
  const box = document.createElement('pre');
  box.id = 'probe-errors';
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;margin:0;padding:6px 8px;background:#7f1d1d;color:#fff;font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap;display:none;max-height:40vh;overflow:auto';
  document.body.appendChild(box);
  const log = (m) => { box.style.display = 'block'; box.textContent += m + '\n'; };
  addEventListener('error', (e) => log(`ERR ${e.message} @${(e.filename || '').split('/').pop()}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => log(`REJ ${e.reason && e.reason.message ? e.reason.message : e.reason}`));
  log(`probe · ${innerWidth}×${innerHeight} · mobile=${MOBILE} · ua=${navigator.userAgent.slice(0, 60)}`);
  let n = 0;
  const tick = setInterval(() => { log(`t+${(n + 1) * 1.5}s scrollY=${Math.round(scrollY)} docH=${document.documentElement.scrollHeight}`); if (++n >= 6) clearInterval(tick); }, 1500);
}
function probeAfterLoad() {
  if (!PROBE.has('y') && !PROBE.has('case')) return;
  setTimeout(() => {
    measureSections();
    if (PROBE.has('case')) gotoCase(Number(PROBE.get('case')));
    if (PROBE.has('y')) window.scrollTo(0, Number(PROBE.get('y')));
  }, 1200);
}

// ---------------------------------------------------------------- boot
function boot() {
  layoutGrid();
  measureSections();
  if (MOBILE) measureMobileAnchor();
  buildRuler();
  buildLoaderGrid();
  setAnchor('hero', true);
  $$('[data-aperture] .cb').forEach((c) => { if (c.id !== 'hero-cb') c.classList.add('is-full'); });
  bubble.setVisible(true);
  requestAnimationFrame(frame);
  runLoader();
}
addEventListener('resize', () => { layoutGrid(); measureSections(); buildRuler(); if (MOBILE) measureMobileAnchor(); if (anchor.name) setAnchor(anchor.name, true); });
addEventListener('load', () => { measureSections(); });
$('#brand')?.addEventListener('click', (e) => { e.preventDefault(); scrollTo0(0); });
boot();
