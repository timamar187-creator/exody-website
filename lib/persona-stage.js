/**
 * <persona-stage> — the whole "talking character" site, so a design only has
 * to write the CHARACTER's dialogue and (optionally) its look.
 *
 * Transcribed from lisa.locomotive.ca (19.08.26 live session): one living
 * figure on a studio void, no scroll, no sections — the site IS a
 * conversation. Everything that grammar needs and gets wrong is here: the
 * click-to-start invitation, a data-driven dialogue graph with VARIANT lines
 * (so the character never repeats itself), typed captions with a caret and a
 * dimming history, choice chips as navigation, form fields inside the flow,
 * a gaze-tracked procedural character with an emoting screen face, camera
 * dolly between beats, restart / mute / progress chrome, and a dialogue-only
 * fallback when WebGL is unavailable.
 *
 * A design writes:
 *
 *   <script type="importmap">{"imports":{"three":"../lib/three.module.js",
 *     "three/addons/":"../lib/addons/"}}</script>
 *   <script type="module">
 *     import { mountPersona } from '../lib/persona-stage.js';
 *     mountPersona({
 *       start: 'intro',
 *       accent: '#b7c4ff',
 *       character: { mode: 'ascii', palette: 'dark' }, // 'ascii' (default; palette 'dark'|'paper') | 'crt' | 'glb' | 'image' | 'none'
 *       // character: { mode: 'glb', src: 'assets/bust.glb' },
 *       nodes: {
 *         intro: {
 *           lines: ['Hi, I am Nova.', 'Oh — a visitor. I am Nova.'],
 *           next: 'menu', progress: 0.1,
 *         },
 *         menu: {
 *           lines: ['What brings you here today?'],
 *           choices: [
 *             { label: 'Start a project', next: 'project' },
 *             { label: 'Just looking', next: 'browse' },
 *           ],
 *           progress: 0.3,
 *         },
 *         project: {
 *           lines: ['Before we build an empire together — your name?'],
 *           input: { key: 'name', placeholder: 'Your name', next: 'bye' },
 *           progress: 0.6,
 *         },
 *         bye: {
 *           lines: ['Perfect, {name}. My humans will take it from here.'],
 *           handoff: { email: 'hello@studio.com' }, progress: 1,
 *         },
 *       },
 *     });
 *   </script>
 *
 * Node fields: lines (REQUIRED, 2-5 variants — one is picked per visit),
 * choices | input | ask | handoff | next (one of them ends the beat), progress
 * (0..1 for the bottom hairline), title (document.title for the branch),
 * emote ('neutral'|'happy'|'think' — the CRT face reacts). {answers} from
 * earlier inputs interpolate into lines by {key}.
 *
 * ask — the ASK-ME-ANYTHING loop (visitor types, character answers):
 *   ask: { placeholder: 'Ask me anything…',
 *          faq: [{ match: ['price','cost'], lines: ['…','…'] }, …],
 *          fallback: { lines: ['Beyond me — ask my humans.'] },
 *          done: { label: "That's all", next: 'bye' } }
 *   Keyword-matched against the curated bank — honest for a static site; the
 *   faq can later be swapped for a live endpoint without touching the page.
 */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CSS = `
persona-stage{display:block;position:relative;width:100%;height:100vh;height:100dvh}
.ps-root{position:absolute;inset:0;overflow:hidden;font:400 16px/1.5 ui-sans-serif,system-ui,sans-serif;
  background:radial-gradient(120% 90% at 50% 30%,var(--ps-bg2,#b9b9bd) 0%,var(--ps-bg,#8e8e93) 100%);color:var(--ps-ink,#141416)}
.ps-canvas{position:absolute;inset:0}
.ps-canvas canvas{display:block;width:100%;height:100%}
.ps-dialogue{position:absolute;left:clamp(20px,4vw,64px);top:34%;width:min(46ch,42vw);z-index:3}
@media (max-width:820px){.ps-dialogue{width:auto;right:20px;top:auto;bottom:96px}}
.ps-history{min-height:3.2em}
.ps-history .ps-line{opacity:.34;filter:blur(.4px);font-size:.86em;margin:0 0 10px;transition:opacity .6s}
.ps-current{font-size:clamp(19px,2vw,26px);letter-spacing:-.01em;text-wrap:pretty;min-height:2.4em}
.ps-caret{display:inline-block;width:.52ch;height:1.05em;vertical-align:-.16em;background:currentColor;
  margin-left:2px;animation:ps-blink 1s steps(1) infinite}
@keyframes ps-blink{50%{opacity:0}}
.ps-choices{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.ps-chip{appearance:none;border:0;border-radius:999px;padding:10px 18px;font:500 14px/1 inherit;cursor:pointer;
  background:var(--ps-chip,#fff);color:var(--ps-ink,#141416);box-shadow:0 1px 2px rgba(0,0,0,.12);
  transition:transform .25s cubic-bezier(.19,1,.22,1),box-shadow .25s}
.ps-chip:hover{transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,0,0,.16)}
.ps-chip:focus-visible{outline:2px solid var(--ps-accent,#8ea2ff);outline-offset:2px}
.ps-form{display:flex;flex-direction:column;gap:14px;margin-top:22px;max-width:34ch}
.ps-input{background:none;border:0;border-bottom:1px solid currentColor;padding:8px 2px;font:inherit;color:inherit}
.ps-input:focus{outline:none;border-bottom-width:2px}
.ps-send{align-self:flex-end}
.ps-invite{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;
  background:none;border:0;cursor:pointer;color:transparent}
.ps-invite.ps-cue{color:var(--ps-ink,#141416);font:600 15px/1 ui-monospace,Menlo,monospace;
  letter-spacing:.18em;animation:ps-cue 2.4s ease-in-out infinite}
@keyframes ps-cue{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.ps-invite.ps-cue{animation:none}}
.ps-ctrl{position:absolute;z-index:4;display:flex;align-items:center;justify-content:center;border:0;cursor:pointer;
  border-radius:999px;background:var(--ps-ink,#141416);color:var(--ps-paper,#fff);width:44px;height:44px}
.ps-restart{left:clamp(16px,3vw,40px);bottom:clamp(16px,3vw,40px)}
.ps-mute{right:clamp(16px,3vw,40px);bottom:clamp(16px,3vw,40px);background:none;color:var(--ps-ink,#e8e8ec);font-size:17px;opacity:.85}
.ps-mute:hover{opacity:1}
.ps-thinkdots{display:inline-flex;gap:7px;align-items:center;height:1em}
.ps-thinkdots i{width:7px;height:7px;border-radius:50%;background:currentColor;opacity:.25;animation:ps-td 1.1s ease-in-out infinite}
.ps-thinkdots i:nth-child(2){animation-delay:.18s}
.ps-thinkdots i:nth-child(3){animation-delay:.36s}
@keyframes ps-td{40%{opacity:1;transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){.ps-thinkdots i{animation:none;opacity:.6}}
.ps-progress{position:absolute;left:0;bottom:0;height:3px;width:100%;z-index:4;background:rgba(0,0,0,.12)}
.ps-ctrl[hidden]{display:none}
.ps-progress i{display:block;height:100%;width:0;background:var(--ps-ink,#141416);transition:width .8s cubic-bezier(.19,1,.22,1)}
.ps-chrome{position:absolute;top:0;left:0;right:0;z-index:4;display:flex;justify-content:space-between;
  padding:clamp(14px,2.5vw,28px) clamp(18px,3vw,40px);font-weight:500}
.ps-chrome a{color:inherit;text-decoration:none}
@media (prefers-reduced-motion:reduce){.ps-caret{animation:none}}
`;

function pickLine(node, seen) {
  const lines = node.lines || [];
  const fresh = lines.filter((l) => !seen.has(l));
  const pool = fresh.length ? fresh : lines;
  const line = pool[Math.floor(Math.random() * pool.length)] || '';
  seen.add(line);
  return line;
}

function fill(text, answers) {
  return String(text).replace(/\{(\w+)\}/g, (_, k) => answers[k] ?? `{${k}}`);
}

/* ── The procedural CRT character (the built-in figure) ─────────────────── */

async function buildCrtCharacter(mount, accent) {
  const THREE = await import('three');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  camera.position.set(0, 1.52, 2.35);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1.6, 2.4, 2.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe4ff, 1.1);
  rim.position.set(-2, 1.4, -1.6);
  scene.add(rim);

  const fig = new THREE.Group();
  // Shoulders + turtleneck: a lathe silhouette reads as knitwear at this size.
  const lathePts = [];
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    lathePts.push(new THREE.Vector2(0.16 + 0.36 * Math.sin(t * 1.35), t * 0.62));
  }
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(lathePts, 48),
    new THREE.MeshStandardMaterial({ color: 0xcfc4bd, roughness: 0.95 }),
  );
  body.name = 'body';
  body.scale.y = -1;
  body.position.y = 1.02;
  fig.add(body);
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.117, 0.14, 0.34, 32),
    new THREE.MeshStandardMaterial({ color: 0xd9cfc8, roughness: 0.9 }),
  );
  neck.name = 'neck';
  neck.position.y = 1.12;
  fig.add(neck);

  // The head: a CRT shell whose SCREEN is a canvas texture — the face is
  // drawn in 2D (eyes, scanlines, glitches), exactly how the reference reads.
  const head = new THREE.Group();
  head.name = 'head';
  head.position.y = 1.52;
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.56, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xb9bcc6, roughness: 0.45, metalness: 0.25 }),
  );
  shell.name = 'crt-shell';
  head.add(shell);
  const face = document.createElement('canvas');
  face.width = 512;
  face.height = 432;
  const fctx = face.getContext('2d');
  const faceTex = new THREE.CanvasTexture(face);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.45),
    new THREE.MeshBasicMaterial({ map: faceTex }),
  );
  screen.name = 'screen';
  screen.position.z = 0.2503;
  head.add(screen);
  // Cable hair: a few catmull-rom tubes falling from the shell's sides.
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.6 });
  for (let i = 0; i < 5; i += 1) {
    const sx = (i % 2 ? 1 : -1) * (0.24 + 0.06 * Math.random());
    const pts = [
      new THREE.Vector3(sx, -0.1, 0.05),
      new THREE.Vector3(sx * 1.3, -0.32, 0.12 * Math.random()),
      new THREE.Vector3(sx * 0.7, -0.52, 0.06),
      new THREE.Vector3(sx * 0.9, -0.72, 0.02),
    ];
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 6),
      cableMat,
    );
    tube.name = `cable-${i}`;
    head.add(tube);
  }
  fig.add(head);
  scene.add(fig);

  /* The 2D face — state drives what the screen shows. */
  const faceState = { mode: 'invite', level: 0, glitchUntil: 0 };
  const stars = Array.from({ length: 70 }, () => [Math.random() * 512, Math.random() * 432, Math.random()]);
  function drawFace(t) {
    fctx.fillStyle = '#0a0a10';
    fctx.fillRect(0, 0, 512, 432);
    for (const [x, y, a] of stars) {
      fctx.fillStyle = `rgba(210,215,255,${0.14 + 0.12 * Math.sin(t / 900 + a * 9)})`;
      fctx.fillRect(x, y, 1.6, 1.6);
    }
    if (faceState.mode === 'invite') {
      fctx.font = '600 26px ui-monospace,monospace';
      fctx.fillStyle = accent;
      fctx.fillText('[CLICK] TO START', 116, 130);
    } else {
      // Eyes: two phosphor discs that blink and squash with emotion.
      const blink = Math.max(0.12, Math.abs(Math.sin(t / 2600)) > 0.05 ? 1 : 0.12);
      const happy = faceState.mode === 'happy' ? 0.72 : 1;
      for (const ex of [176, 336]) {
        fctx.save();
        fctx.translate(ex, 216);
        const g = fctx.createRadialGradient(0, 0, 6, 0, 0, 62);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.65, '#e8ecff');
        g.addColorStop(1, 'rgba(120,130,200,0)');
        fctx.fillStyle = g;
        fctx.scale(1, blink * happy);
        fctx.beginPath();
        fctx.arc(0, 0, 56, 0, Math.PI * 2);
        fctx.fill();
        fctx.restore();
      }
      // Speaking level lifts a soft "mouth" glow under the eyes.
      if (faceState.level > 0.02) {
        fctx.fillStyle = `rgba(230,236,255,${0.25 * faceState.level})`;
        fctx.fillRect(196, 306, 120 * faceState.level, 7);
      }
    }
    if (t < faceState.glitchUntil) {
      // Thinking glitch: slice-shift a few rows + a code flash column.
      for (let i = 0; i < 6; i += 1) {
        const y = Math.random() * 432;
        const img = fctx.getImageData(0, y, 512, 8);
        fctx.putImageData(img, (Math.random() - 0.5) * 34, y);
      }
      fctx.font = '400 9px ui-monospace,monospace';
      fctx.fillStyle = 'rgba(140,255,170,.5)';
      for (let i = 0; i < 10; i += 1) fctx.fillText('0x' + ((Math.random() * 65535) | 0).toString(16), 380, 40 + i * 12);
    }
    // Scanlines make it CRT — cheap, decisive.
    fctx.fillStyle = 'rgba(0,0,0,.16)';
    for (let y = 0; y < 432; y += 3) fctx.fillRect(0, y, 512, 1);
    faceTex.needsUpdate = true;
  }

  const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!REDUCED && !matchMedia('(pointer:coarse)').matches) {
    addEventListener('mousemove', (e) => {
      gaze.tx = (e.clientX / innerWidth) * 2 - 1;
      gaze.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }
  const dolly = { z: 2.35, tz: 2.35 };

  function resize() {
    const w = mount.clientWidth || innerWidth;
    const h = mount.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Keep the bust right-of-center on wide screens (captions live left).
    fig.position.x = w > 820 ? 0.34 : 0;
  }
  addEventListener('resize', resize);
  resize();

  let alive = true;
  (function tick(t) {
    if (!alive) return;
    requestAnimationFrame(tick);
    gaze.x += (gaze.tx - gaze.x) * 0.055;
    gaze.y += (gaze.ty - gaze.y) * 0.055;
    head.rotation.y = gaze.x * 0.42;
    head.rotation.x = gaze.y * 0.24;
    fig.rotation.y = gaze.x * 0.1;
    // Idle breath — barely there, but stillness reads as a screenshot.
    fig.position.y = REDUCED ? 0 : Math.sin(t / 1900) * 0.008;
    dolly.z += (dolly.tz - dolly.z) * 0.04;
    camera.position.z = dolly.z;
    camera.lookAt(fig.position.x, 1.42, 0);
    drawFace(t);
    renderer.render(scene, camera);
  })(0);

  return {
    setMode(m) { faceState.mode = m; },
    setLevel(v) { faceState.level = v; },
    think(ms) { faceState.glitchUntil = performance.now() + ms; },
    dollyTo(z) { dolly.tz = z; },
    dispose() { alive = false; renderer.dispose(); },
  };
}

/*
 * The ASCII digit-figure — the stage's SIGNATURE character (owner reference
 * set, 19.08.26: portraits dithered into live digits). A real 3D bust is
 * rendered every frame at glyph-grid resolution, and each cell becomes a
 * digit whose ink weight matches the luminance under it — so light, gaze,
 * the blinking eyes and the talking mouth all read THROUGH the characters.
 * Two palettes: 'dark' (white digits on near-black) and 'paper' (ink digits
 * on bone). Clicking the stage scrambles the glyph field and makes the
 * figure react; speech opens and closes the mouth through setLevel().
 */
async function buildAsciiCharacter(mount, opts = {}) {
  const paper = opts.palette === 'paper';
  // Digits ordered by ink weight — the ramp IS the shading.
  const RAMP = ' 1732540698';

  /*
   * PORTRAIT MODE (opts.src) — the human-grade path. The owner's references
   * are dithered PHOTOGRAPHS; no procedural head competes with that. A real
   * portrait (render_image or a user photo — MATERIALS LAW) is sampled into
   * the digit grid live: gaze becomes a parallax drift of the crop, the
   * camera dolly becomes zoom, speech makes the digits DANCE inside the
   * mouth region, clicks scramble the field. Regions are fractions of the
   * source image: regions: { mouth: {x,y,w,h}, eyes: [{x,y,w,h}, …] }.
   */
  if (opts.src) {
    /*
     * PORTRAIT MODE — the human-grade path, in TRUE 3D (owner bar, 19.08.26:
     * "לשמור על הפנים בתלת מימד… תנועה בכל כיוון"). The portrait plus its
     * DEPTH MAP (render_image generates both) become a displaced mesh with
     * the photo as its texture: the head rotates CONTINUOUSLY on both axes
     * toward the pointer — silhouette, occlusion and the baked studio light
     * all shift like a real head, and the digit grid samples the live render.
     * Mouth-speech and blinks are painted ON THE TEXTURE, so they ride the
     * rotation correctly. Without a depth map, a neck-pivot warp of the flat
     * portrait is the fallback. Frame-station crossfades are gone for good —
     * averaging two poses reads as a flat double-exposure.
     */
    const COLS = 184;
    const ROWS = 106;
    const CW = 9;
    const CHH = 13;
    const loadImg = (u) => new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("portrait not readable: " + u));
      i.src = u;
    });
    const front = await loadImg(opts.src);
    const depthImg = opts.depth ? await loadImg(opts.depth).catch(() => null) : null;
    const iw = front.naturalWidth;
    const ih = front.naturalHeight;

    // Live texture: the portrait redrawn each frame with mouth/blink ops.
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 1024;
    texCanvas.height = Math.round(1024 * (ih / iw));
    const tctx = texCanvas.getContext('2d');
    const R = (rg) => rg && {
      x: rg.x * texCanvas.width,
      y: rg.y * texCanvas.height,
      w: rg.w * texCanvas.width,
      h: rg.h * texCanvas.height,
    };
    const mouthR = R(opts.regions?.mouth);
    const eyesR = (opts.regions?.eyes || []).map(R).filter(Boolean);
    // Near-black zones inside the head (hair, shadow side) fell under the
    // glyph threshold and tore HOLES in the bust. A uniform luminance floor
    // fixed the holes but FLATTENED the relief — the depth read LIVES in
    // that tonal contrast (owner, 19.08.26). So: head pixels get an
    // invisible BLUE floor in texture space (glyph ink is fixed, so the tint
    // never shows), and the sampler dithers marked dark cells with SPARSE
    // faint digits whose density follows what light remains — shadows stay
    // shadows, the depth≈0 background stays empty, contiguous holes don't
    // survive. Mouth/blink overlays paint AFTER this on purpose: digits
    // vanishing into an open mouth is the design.
    let base = front;
    if (depthImg) {
      const bc = document.createElement('canvas');
      bc.width = texCanvas.width;
      bc.height = texCanvas.height;
      const bx = bc.getContext('2d');
      bx.drawImage(front, 0, 0, bc.width, bc.height);
      const dc = document.createElement('canvas');
      dc.width = bc.width;
      dc.height = bc.height;
      const dx = dc.getContext('2d');
      dx.drawImage(depthImg, 0, 0, dc.width, dc.height);
      const pd = dx.getImageData(0, 0, dc.width, dc.height).data;
      const pb = bx.getImageData(0, 0, bc.width, bc.height);
      const pp = pb.data;
      for (let i = 0; i < pp.length; i += 4) {
        const d = (pd[i] * 0.2126 + pd[i + 1] * 0.7152 + pd[i + 2] * 0.0722) / 255;
        if (d < 0.07) continue;
        pp[i + 2] = Math.max(pp[i + 2], 30);
      }
      bx.putImageData(pb, 0, 0);
      base = bc;
    }
    const paintTexture = (t, level, blink) => {
      tctx.drawImage(base, 0, 0, texCanvas.width, texCanvas.height);
      if (level > 0.02 && mouthR) {
        // A REAL mouth opening, painted on the texture (never the geometry —
        // depth warps distorted the chin): a feathered dark oval parts the
        // lips and grows with the voice, so the digits vanish into the open
        // mouth and re-close between syllables. Unmistakable, local, and it
        // rides the head rotation like every texture feature.
        const open = level * (0.55 + 0.45 * Math.sin(t / 40));
        const mw = mouthR.w * (0.62 + 0.14 * open);
        const mh = Math.max(mouthR.h * 0.14, mouthR.h * (0.16 + open * 1.4));
        const mcx = mouthR.x + mouthR.w / 2;
        const topY = mouthR.y + mouthR.h * 0.1;
        const mcy = topY + mh * 0.38;
        const mg = tctx.createRadialGradient(mcx, mcy, Math.min(mw, mh) * 0.18, mcx, mcy, Math.max(mw, mh) * 0.72);
        mg.addColorStop(0, 'rgba(4,4,7,' + (0.55 + 0.4 * open).toFixed(3) + ')');
        mg.addColorStop(0.75, 'rgba(4,4,7,' + (0.35 * open).toFixed(3) + ')');
        mg.addColorStop(1, 'rgba(4,4,7,0)');
        tctx.fillStyle = mg;
        tctx.beginPath();
        tctx.ellipse(mcx, mcy, mw / 2, mh / 2, 0, 0, Math.PI * 2);
        tctx.fill();
        // Lower-lip glint tracks the opening.
        tctx.strokeStyle = 'rgba(255,255,255,' + (0.24 * open).toFixed(3) + ')';
        tctx.lineWidth = Math.max(2, mouthR.h * 0.1);
        tctx.beginPath();
        tctx.ellipse(mcx, topY + mh * 0.78, mw * 0.32, mouthR.h * 0.1, 0, 0.15 * Math.PI, 0.85 * Math.PI);
        tctx.stroke();
      }
      if (blink) {
        for (const e of eyesR) {
          tctx.fillStyle = 'rgba(0,0,0,0.85)';
          tctx.fillRect(e.x, e.y, e.w, e.h);
        }
      }
    };

    const seeds = new Float32Array(COLS * ROWS);
    for (let i = 0; i < seeds.length; i += 1) seeds[i] = Math.random();
    let nudge = 0;
    mount.addEventListener('pointerdown', () => {
      for (let i = 0; i < seeds.length; i += 1) if (Math.random() < 0.34) seeds[i] = Math.random();
      nudge = 1;
    });
    const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
    if (!REDUCED && !matchMedia('(pointer:coarse)').matches) {
      addEventListener('mousemove', (e) => {
        gaze.tx = (e.clientX / innerWidth) * 2 - 1;
        gaze.ty = (e.clientY / innerHeight) * 2 - 1;
      }, { passive: true });
    }
    const dolly = { z: 2.3, tz: 2.3 };
    const state = { level: 0, glitchUntil: 0 };

    const out = document.createElement('canvas');
    out.style.cssText = 'position:absolute;inset:0';
    mount.appendChild(out);
    const octx = out.getContext('2d');
    const ink = paper ? '#181816' : '#e9e9ef';
    // Three weights: shadows carry faint small digits, highlights dense bold
    // ones — the tonal range that makes the reference read deep, not flat.
    const atlases = [
      { font: '400 9px ui-monospace,Menlo,monospace', alpha: 0.6 },
      { font: '600 11px ui-monospace,Menlo,monospace', alpha: 0.85 },
      { font: '800 12.5px ui-monospace,Menlo,monospace', alpha: 1 },
    ].map((sp) => {
      const a = document.createElement('canvas');
      a.width = CW * RAMP.length;
      a.height = CHH;
      const cx = a.getContext('2d');
      cx.font = sp.font;
      cx.textBaseline = 'top';
      cx.globalAlpha = sp.alpha;
      cx.fillStyle = ink;
      for (let i = 0; i < RAMP.length; i += 1) cx.fillText(RAMP[i], i * CW + 1, 0);
      return a;
    });
    const atlas = atlases[1];
    const samp = document.createElement('canvas');
    samp.width = COLS;
    samp.height = ROWS;
    const sctx = samp.getContext('2d', { willReadFrequently: true });

    function place() {
      const w = mount.clientWidth || innerWidth;
      const h = mount.clientHeight || innerHeight;
      out.width = COLS * CW;
      out.height = ROWS * CHH;
      const sc = Math.max(w / out.width, h / out.height);
      out.style.width = (out.width * sc) + 'px';
      out.style.height = (out.height * sc) + 'px';
      out.style.left = w > 820 ? (w - out.width * sc * 0.86) + 'px' : ((w - out.width * sc) / 2) + 'px';
      out.style.top = ((h - out.height * sc) / 2) + 'px';
    }
    addEventListener('resize', place);
    place();

    let alive = true;
    let frame = 0;

    if (depthImg) {
      const THREE = await import('three');
      const gl3 = new THREE.WebGLRenderer({ antialias: false });
      gl3.setSize(COLS, ROWS, false);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(paper ? 0xffffff : 0x000000);
      const camera = new THREE.PerspectiveCamera(36, COLS / ROWS, 0.1, 20);
      // The photo carries its baked studio light; a LIVE key on top re-carves
      // the displaced relief as the head turns — moving shadows are the depth
      // cue a flat sample can never give.
      scene.add(new THREE.AmbientLight(0xffffff, 2.6));
      const key3 = new THREE.DirectionalLight(0xffffff, 0.85);
      key3.position.set(-1.4, 1.6, 1.8);
      scene.add(key3);
      const texture = new THREE.CanvasTexture(texCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const depthTex = new THREE.Texture(depthImg);
      depthTex.needsUpdate = true;
      const H = ih / iw;
      const geo = new THREE.PlaneGeometry(1.9, 1.9 * H, 220, 160);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        displacementMap: depthTex,
        displacementScale: 0.45,
        roughness: 1,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const rig = new THREE.Group();
      rig.add(mesh);
      scene.add(rig);
      // Frame the bust: camera slightly above center, looking at the face.
      camera.position.set(0, 0.06, 1.9);
      camera.lookAt(0, 0.05, 0);

      (function tick(t) {
        if (!alive) return;
        requestAnimationFrame(tick);
        frame += 1;
        if (frame % 2) return;
        gaze.x += (gaze.tx - gaze.x) * 0.11;
        gaze.y += (gaze.ty - gaze.y) * 0.11;
        nudge *= 0.86;
        dolly.z += (dolly.tz - dolly.z) * 0.04;
        camera.position.z = dolly.z;
        // CONTINUOUS two-axis turn toward the pointer — the whole point.
        rig.rotation.y = (REDUCED ? 0 : gaze.x) * 0.52 + nudge * 0.12;
        rig.rotation.x = (REDUCED ? 0 : gaze.y) * 0.34;
        rig.position.y = REDUCED ? 0 : Math.sin(t / 1900) * 0.012;
        const speaking = state.level > 0.02;
        const blink = eyesR.length > 0 && Math.abs(Math.sin(t / 2600)) < 0.04;
        paintTexture(t, state.level, blink);
        texture.needsUpdate = true;
        gl3.render(scene, camera);
        sctx.drawImage(gl3.domElement, 0, 0, COLS, ROWS);
        const px = sctx.getImageData(0, 0, COLS, ROWS).data;
        octx.clearRect(0, 0, out.width, out.height);
        const glitch = t < state.glitchUntil;
        for (let r = 0; r < ROWS; r += 1) {
          const shift = glitch && Math.random() < 0.1 ? ((Math.random() * 4) | 0) - 2 : 0;
          for (let c = 0; c < COLS; c += 1) {
            const i = (r * COLS + Math.min(COLS - 1, Math.max(0, c + shift))) * 4;
            let L = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
            if (paper) L = 1 - L;
            L = Math.pow(L, 1.35);
            if (L < 0.05) {
              // Blue-marked head cell: sparse faint dither instead of a hole
              // — and instead of the uniform carpet that flattened the head.
              if (paper || !(px[i + 2] > 24 && px[i + 2] > px[i] * 1.8)) continue;
              const s = seeds[r * COLS + c];
              if (s > 0.3 + L * 5) continue;
              octx.globalAlpha = 0.75;
              octx.drawImage(atlases[0], (s < 0.1 ? 2 : 1) * CW, 0, CW, CHH, c * CW, r * CHH, CW, CHH);
              octx.globalAlpha = 1;
              continue;
            }
            const gi = Math.min(
              RAMP.length - 1,
              Math.max(1, Math.round(L * (RAMP.length - 1) + (seeds[r * COLS + c] - 0.5) * 1.6)),
            );
            const wA = L > 0.68 ? atlases[2] : L > 0.32 ? atlases[1] : atlases[0];
            octx.drawImage(wA, gi * CW, 0, CW, CHH, c * CW, r * CHH, CW, CHH);
          }
        }
        void speaking;
      })(0);

      return {
        setMode() {},
        setLevel(v) { state.level = v; },
        think(ms) { state.glitchUntil = performance.now() + ms; },
        dollyTo(z) { dolly.tz = Math.max(1.45, z); },
        dispose() { alive = false; gl3.dispose(); },
      };
    }

    // No depth map: flat-sample the portrait with a neck-pivot warp.
    const s2 = Math.max(COLS / iw, ROWS / ih);
    const sw = COLS / s2;
    const sh = ROWS / s2;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) * 0.3;
    const toGrid = (rg) => rg && {
      c0: ((rg.x * iw - sx) / sw) * COLS,
      c1: (((rg.x + rg.w) * iw - sx) / sw) * COLS,
      r0: ((rg.y * ih - sy) / sh) * ROWS,
      r1: (((rg.y + rg.h) * ih - sy) / sh) * ROWS,
    };
    const mouth = toGrid(opts.regions?.mouth);
    const eyes = (opts.regions?.eyes || []).map(toGrid).filter(Boolean);
    const neckRow = (toGrid(opts.regions?.head)?.r1 ?? 0.58 * ROWS);
    sctx.drawImage(front, sx, sy, sw, sh, 0, 0, COLS, ROWS);
    const px0 = sctx.getImageData(0, 0, COLS, ROWS).data;
    const Lgrid = new Float32Array(COLS * ROWS);
    for (let i = 0, n = COLS * ROWS; i < n; i += 1) {
      const j = i * 4;
      let L = (px0[j] * 0.2126 + px0[j + 1] * 0.7152 + px0[j + 2] * 0.0722) / 255;
      if (paper) L = 1 - L;
      Lgrid[i] = L;
    }
    (function tick(t) {
      if (!alive) return;
      requestAnimationFrame(tick);
      frame += 1;
      if (frame % 2) return;
      gaze.x += (gaze.tx - gaze.x) * 0.11;
      gaze.y += (gaze.ty - gaze.y) * 0.11;
      nudge *= 0.88;
      dolly.z += (dolly.tz - dolly.z) * 0.04;
      const zoom = 1 + (2.3 - dolly.z) * 0.4;
      const breathe = REDUCED ? 0 : Math.sin(t / 1900) * 3;
      out.style.transformOrigin = '50% 28%';
      out.style.transform = 'translateY(' + breathe.toFixed(2) + 'px) scale(' + zoom.toFixed(4) + ')';
      const g = Math.max(-1, Math.min(1, REDUCED ? 0 : gaze.x));
      const gy2 = REDUCED ? 0 : gaze.y;
      const speaking = state.level > 0.02;
      const blink = Math.abs(Math.sin(t / 2600)) < 0.04;
      const glitch = t < state.glitchUntil;
      octx.clearRect(0, 0, out.width, out.height);
      for (let r = 0; r < ROWS; r += 1) {
        const shift = glitch && Math.random() < 0.1 ? ((Math.random() * 4) | 0) - 2 : 0;
        const hn = Math.max(0, (neckRow - r) / neckRow);
        const swing = hn * hn * 9;
        const nod = gy2 * hn * hn * 5;
        for (let c = 0; c < COLS; c += 1) {
          const here = Lgrid[r * COLS + c];
          const sc2 = Math.min(COLS - 1, Math.max(0, Math.round(c + shift - g * (swing + here * hn * 4))));
          const sr2 = Math.min(ROWS - 1, Math.max(0, Math.round(r - nod)));
          const cell = sr2 * COLS + sc2;
          let L = Lgrid[cell];
          if (speaking && mouth && sc2 >= mouth.c0 && sc2 <= mouth.c1 && sr2 >= mouth.r0 && sr2 <= mouth.r1) {
            L *= 0.55 + 0.9 * state.level * (0.5 + 0.5 * Math.sin(t / 42 + r * 0.9 + c * 0.3));
          }
          if (blink && eyes.some((e2) => sc2 >= e2.c0 && sc2 <= e2.c1 && sr2 >= e2.r0 && sr2 <= e2.r1)) {
            L *= 0.12;
          }
          L = Math.pow(L, 1.35);
          if (L < 0.05) continue;
          const gi = Math.min(
            RAMP.length - 1,
            Math.max(1, Math.round(L * (RAMP.length - 1) + (seeds[r * COLS + c] - 0.5) * 1.6)),
          );
          const wA = typeof atlases !== "undefined" ? (L > 0.68 ? atlases[2] : L > 0.32 ? atlases[1] : atlases[0]) : atlas;
          octx.drawImage(wA, gi * CW, 0, CW, CHH, c * CW, r * CHH, CW, CHH);
        }
      }
    })(0);

    return {
      setMode() {},
      setLevel(v) { state.level = v; },
      think(ms) { state.glitchUntil = performance.now() + ms; },
      dollyTo(z) { dolly.tz = Math.max(1.9, z); },
      dispose() { alive = false; },
    };
  }

  const THREE = await import('three');
  const COLS = 148;
  const ROWS = 86;

  const gl = new THREE.WebGLRenderer({ antialias: false });
  gl.setSize(COLS, ROWS, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(paper ? 0xffffff : 0x000000);
  const camera = new THREE.PerspectiveCamera(30, COLS / ROWS, 0.1, 20);
  camera.position.set(0, 1.56, 2.3);
  scene.add(new THREE.AmbientLight(0xffffff, paper ? 1.5 : 0.55));
  const key = new THREE.DirectionalLight(0xffffff, paper ? 1.4 : 2.6);
  key.position.set(1.4, 2.2, 1.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, paper ? 0.4 : 1.2);
  rim.position.set(-2.2, 1.2, -1.4);
  scene.add(rim);

  const fig = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.85 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x000000 });
  // Shoulders — same knitwear silhouette as the CRT figure.
  const pts = [];
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    pts.push(new THREE.Vector2(0.16 + 0.38 * Math.sin(t * 1.35), t * 0.6));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), skin);
  body.name = 'body';
  body.scale.y = -1;
  body.position.y = 1.04;
  fig.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.3, 24), skin);
  neck.position.y = 1.18;
  fig.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.58;
  // An egg skull + jaw + nose is ALL a digit grid needs to read as a person.
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 40, 30), skin);
  skull.scale.set(0.8, 1.06, 0.86);
  head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.19, 30, 22), skin);
  jaw.scale.set(0.86, 0.9, 0.8);
  jaw.position.set(0, -0.19, 0.05);
  head.add(jaw);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 12), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.03, 0.3);
  head.add(nose);
  // Eyes and mouth are HOLES in the light — dense ink in paper mode, dropped
  // glyphs in dark mode. Both read; the flash flips them for a beat.
  const eyeGeo = new THREE.SphereGeometry(0.052, 16, 12);
  const eyeL = new THREE.Mesh(eyeGeo, dark.clone());
  const eyeR = new THREE.Mesh(eyeGeo, dark.clone());
  eyeL.position.set(-0.105, 0.045, 0.245);
  eyeR.position.set(0.105, 0.045, 0.245);
  head.add(eyeL, eyeR);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.028, 0.03), dark.clone());
  mouth.position.set(0, -0.235, 0.235);
  head.add(mouth);
  fig.add(head);
  scene.add(fig);

  // Visible glyph canvas + a pre-rendered atlas (fillText per cell melts).
  const out = document.createElement('canvas');
  out.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  mount.appendChild(out);
  const octx = out.getContext('2d');
  const ink = paper ? '#181816' : '#e9e9ef';
  const CW = 9;
  const CHH = 13;
  const atlas = document.createElement('canvas');
  atlas.width = CW * RAMP.length;
  atlas.height = CHH;
  const actx = atlas.getContext('2d');
  actx.font = '700 11px ui-monospace,Menlo,monospace';
  actx.textBaseline = 'top';
  actx.fillStyle = ink;
  for (let i = 0; i < RAMP.length; i += 1) actx.fillText(RAMP[i], i * CW + 1, 1);

  const samp = document.createElement('canvas');
  samp.width = COLS;
  samp.height = ROWS;
  const sctx = samp.getContext('2d', { willReadFrequently: true });

  // Per-cell jitter seeds keep digits STABLE frame to frame (no strobing);
  // a click rerolls a third of them — the scramble-react the refs promise.
  const seeds = new Float32Array(COLS * ROWS);
  for (let i = 0; i < seeds.length; i += 1) seeds[i] = Math.random();
  let flashUntil = 0;
  let nod = 0;
  mount.addEventListener('pointerdown', () => {
    for (let i = 0; i < seeds.length; i += 1) if (Math.random() < 0.34) seeds[i] = Math.random();
    flashUntil = performance.now() + 260;
    nod = 1;
  });

  const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!REDUCED && !matchMedia('(pointer:coarse)').matches) {
    addEventListener('mousemove', (e) => {
      gaze.tx = (e.clientX / innerWidth) * 2 - 1;
      gaze.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }
  const dolly = { z: 2.3, tz: 2.3 };
  const state = { level: 0, mode: 'neutral', glitchUntil: 0 };

  function resize() {
    const w = mount.clientWidth || innerWidth;
    const h = mount.clientHeight || innerHeight;
    out.width = COLS * CW;
    out.height = ROWS * CHH;
    // Cover the viewport, keep cells square-ish, bust right-of-center wide.
    const s = Math.max(w / out.width, h / out.height);
    out.style.width = `${out.width * s}px`;
    out.style.height = `${out.height * s}px`;
    out.style.left = w > 820 ? `${w - out.width * s * 0.82}px` : `${(w - out.width * s) / 2}px`;
    out.style.top = `${(h - out.height * s) / 2}px`;
  }
  addEventListener('resize', resize);
  resize();

  let alive = true;
  let frame = 0;
  (function tick(t) {
    if (!alive) return;
    requestAnimationFrame(tick);
    frame += 1;
    gaze.x += (gaze.tx - gaze.x) * 0.06;
    gaze.y += (gaze.ty - gaze.y) * 0.06;
    head.rotation.y = gaze.x * 0.5;
    head.rotation.x = gaze.y * 0.28 + nod * 0.18;
    nod *= 0.86;
    fig.rotation.y = gaze.x * 0.12;
    fig.position.y = REDUCED ? 0 : Math.sin(t / 1900) * 0.008;
    dolly.z += (dolly.tz - dolly.z) * 0.04;
    camera.position.z = dolly.z;
    camera.lookAt(0, 1.5, 0);
    // The talking mouth: open follows the speech level, with a light idle.
    const open = 1 + state.level * 7 + (state.level > 0.02 ? Math.sin(t / 55) * 2.2 : 0);
    mouth.scale.y = Math.max(0.7, open);
    mouth.scale.x = 1 - state.level * 0.25;
    const blink = Math.abs(Math.sin(t / 2400)) < 0.045 ? 0.12 : 1;
    eyeL.scale.y = blink;
    eyeR.scale.y = blink;
    const flash = t < flashUntil;
    for (const eye of [eyeL, eyeR]) eye.material.color.setHex(flash ? 0xffffff : 0x000000);

    gl.render(scene, camera);
    // Read the tiny frame and repaint the glyph field (every other frame —
    // 30fps of digits reads identically and halves the sampling cost).
    if (frame % 2) return;
    sctx.drawImage(gl.domElement, 0, 0, COLS, ROWS);
    const px = sctx.getImageData(0, 0, COLS, ROWS).data;
    octx.clearRect(0, 0, out.width, out.height);
    const glitch = t < state.glitchUntil;
    for (let r = 0; r < ROWS; r += 1) {
      const shift = glitch && Math.random() < 0.12 ? ((Math.random() * 4) | 0) - 2 : 0;
      for (let c = 0; c < COLS; c += 1) {
        const i = (r * COLS + Math.min(COLS - 1, Math.max(0, c + shift))) * 4;
        let L = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255;
        if (paper) L = 1 - L;
        if (L < 0.045) continue;
        const cell = r * COLS + c;
        const gi = Math.min(
          RAMP.length - 1,
          Math.max(1, Math.round(L * (RAMP.length - 1) + (seeds[cell] - 0.5) * 1.6)),
        );
        octx.drawImage(atlas, gi * CW, 0, CW, CHH, c * CW, r * CHH, CW, CHH);
      }
    }
  })(0);

  return {
    setMode(m) { state.mode = m; },
    setLevel(v) { state.level = v; },
    think(ms) { state.glitchUntil = performance.now() + ms; },
    dollyTo(z) { dolly.tz = Math.max(1.9, z); },
    dispose() { alive = false; gl.dispose(); },
  };
}

async function buildGlbCharacter(mount, src) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(1.5, 2.5, 2);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 50);
  const gltf = await new GLTFLoader().loadAsync(src);
  const root = gltf.scene;
  // Frame whatever bounds arrive — user models come in any unit.
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  const dist = Math.max(size.x, size.y, size.z) * 1.35;
  camera.position.set(0, size.y * 0.12, dist);
  scene.add(root);
  const gaze = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!REDUCED && !matchMedia('(pointer:coarse)').matches) {
    addEventListener('mousemove', (e) => {
      gaze.tx = (e.clientX / innerWidth) * 2 - 1;
      gaze.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }
  function resize() {
    const w = mount.clientWidth || innerWidth;
    const h = mount.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();
  let alive = true;
  (function tick() {
    if (!alive) return;
    requestAnimationFrame(tick);
    gaze.x += (gaze.tx - gaze.x) * 0.055;
    gaze.y += (gaze.ty - gaze.y) * 0.055;
    root.rotation.y = gaze.x * 0.4;
    root.rotation.x = gaze.y * 0.18;
    renderer.render(scene, camera);
  })();
  return {
    setMode() {}, setLevel() {}, think() {}, dollyTo() {},
    dispose() { alive = false; renderer.dispose(); },
  };
}

/* ── The dialogue engine + chrome ───────────────────────────────────────── */

export async function mountPersona(config) {
  const host = document.querySelector('persona-stage') || document.body.appendChild(document.createElement('persona-stage'));
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const accent = config.accent || '#b7c4ff';

  const root = document.createElement('div');
  root.className = 'ps-root';
  root.style.setProperty('--ps-accent', accent);
  root.innerHTML =
    '<div class="ps-canvas" aria-hidden="true"></div>' +
    '<div class="ps-dialogue"><div class="ps-history"></div>' +
    '<p class="ps-current" aria-live="polite"></p><div class="ps-slot"></div></div>' +
    '<button class="ps-invite" aria-label="Start the conversation"></button>' +
    '<button class="ps-ctrl ps-restart" aria-label="Restart" hidden>↺</button>' +
    '<button class="ps-ctrl ps-mute" aria-label="Mute voice" hidden>🔊</button>' +
    '<div class="ps-progress" role="progressbar" aria-valuemin="0" aria-valuemax="1"><i></i></div>';
  host.appendChild(root);
  const $ = (sel) => root.querySelector(sel);

  // The character never blocks the conversation: any failure (no WebGL, a
  // bad .glb path) falls back to dialogue-only with the stage's gradient.
  let character = { setMode() {}, setLevel() {}, think() {}, dollyTo() {}, dispose() {} };
  // 'ascii' is the signature default — the digit-figure from the owner's
  // reference set. 'crt', 'glb' and 'image' remain explicit choices.
  const mode = config.character?.mode ?? 'ascii';
  if (mode === 'ascii') {
    const paper = config.character?.palette === 'paper';
    root.style.setProperty('--ps-bg', paper ? '#efece3' : '#0b0b0e');
    root.style.setProperty('--ps-bg2', paper ? '#faf8f2' : '#17171d');
    root.style.setProperty('--ps-ink', paper ? '#181816' : '#ececf1');
    root.style.setProperty('--ps-paper', paper ? '#faf8f2' : '#101014');
    root.style.setProperty('--ps-chip', paper ? '#ffffff' : '#1e1e26');
  }
  if (mode !== 'crt') {
    const invite = $('.ps-invite');
    invite.classList.add('ps-cue');
    invite.textContent = '[CLICK] TO START';
  }
  try {
    if (mode === 'ascii') character = await buildAsciiCharacter($('.ps-canvas'), config.character || {});
    else if (mode === 'crt') character = await buildCrtCharacter($('.ps-canvas'), accent);
    else if (mode === 'glb' && config.character?.src) character = await buildGlbCharacter($('.ps-canvas'), config.character.src);
    else if (mode === 'image' && config.character?.src) {
      const img = document.createElement('img');
      img.src = config.character.src;
      img.alt = '';
      img.style.cssText = 'position:absolute;inset:0;margin:auto;max-height:88%;max-width:60%;object-fit:contain';
      img.setAttribute('data-ck-gaze', '');
      $('.ps-canvas').appendChild(img);
    }
  } catch (err) {
    console.warn('[persona-stage] character unavailable, dialogue continues:', err);
  }

  const answers = {};
  const seenLines = new Set();
  let muted = REDUCED;
  // Voice: config.speakWith(text, onLevel) → Promise, when the page supplies
  // a REAL voice (cloud TTS); it drives the mouth through onLevel and the
  // browser synth stays the fallback. 'synth' alone keeps the old behaviour.
  const speakHook = typeof config.speakWith === 'function' ? config.speakWith : null;
  const synthOk = (config.voice === 'synth' || speakHook) && 'speechSynthesis' in window;
  if ((synthOk || speakHook) && !config.hideMute) {
    $('.ps-mute').hidden = false;
    $('.ps-mute').addEventListener('click', () => {
      muted = !muted;
      $('.ps-mute').textContent = muted ? '🔇' : '🔊';
      if (muted) {
        try { speechSynthesis.cancel(); } catch { /* no synth */ }
        if (typeof config.stopSpeak === "function") config.stopSpeak();
        character.setLevel(0);
      }
    });
  }

  // The synth fallback must not change the character's GENDER mid-scene —
  // the default browser voice is often female while the cloud voice is male
  // (19.08.26: one slow TTS answer flipped EXO to a woman for a sentence).
  let synthVoice; // undefined = list not loaded yet; null = nothing usable
  function pickSynthVoice() {
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return undefined; // iOS loads the list LATE — see below
    if (synthVoice !== undefined) return synthVoice;
    synthVoice =
      vs.find((v) => /^en/i.test(v.lang) && /daniel|alex|arthur|george|fred|aaron|male/i.test(v.name)) ||
      vs.find((v) => /^en-(GB|US)/i.test(v.lang)) ||
      vs.find((v) => /^en/i.test(v.lang)) ||
      null;
    return synthVoice;
  }
  if ('speechSynthesis' in window) {
    // Warm the list early; once a voice is LOCKED it never re-picks — a
    // mid-scene voice change is the one unforgivable thing here.
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.('voiceschanged', () => {
      if (synthVoice === undefined) pickSynthVoice();
    });
  }
  function speakSynth(text) {
    if (speakHook) return; // ONE voice: cloud or silence, never the synth
    if (!synthOk || muted) return;
    const v = pickSynthVoice();
    // List not ready (iOS): SILENCE beats speaking whatever default the OS
    // grabs first — that is exactly the woman-then-robot flip on mobile.
    if (v === undefined) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (v) u.voice = v;
    u.rate = 1.0;
    u.pitch = 0.82;
    u.onboundary = () => character.setLevel(0.4 + Math.random() * 0.6);
    u.onend = () => character.setLevel(0);
    speechSynthesis.speak(u);
  }

  /**
   * Prepared speech: resolves a start() to fire WITH the typing. A cloud
   * voice is fetched first (bounded — a slow TTS must not freeze the beat);
   * each start stops the previous line, so voices never overlap.
   */
  let speakGen = 0;
  async function speak(text) {
    if (muted) return () => {};
    if (speakHook) {
      const gen = ++speakGen;
      const pending = speakHook(text, (v) => character.setLevel(muted ? 0 : v));
      try {
        const prepared = await Promise.race([
          pending,
          new Promise((resolve) => setTimeout(() => resolve("timeout"), 9000)),
        ]);
        // ONE voice or SILENCE — but a voice that finishes preparing late
        // JOINS late instead of being thrown away (a mouth moving silently
        // through a whole answer reads broken; owner, 19.08.26). The
        // generation guard keeps a late voice from speaking over the NEXT
        // line.
        if (prepared === "timeout") {
          pending
            .then((late) => {
              if (gen === speakGen && !muted && late && typeof late.start === "function") {
                void late.start();
              }
            })
            .catch(() => undefined);
          return () => Promise.resolve();
        }
        if (prepared && typeof prepared.start === "function") {
          return () => (muted ? Promise.resolve() : Promise.resolve(prepared.start()));
        }
        return () => Promise.resolve();
      } catch {
        return () => Promise.resolve();
      }
    }
    return () => { speakSynth(text); return Promise.resolve(); };
  }

  function typeInto(el, text) {
    return new Promise((resolve) => {
      el.textContent = '';
      const caret = document.createElement('span');
      caret.className = 'ps-caret';
      el.appendChild(caret);
      if (REDUCED) {
        el.textContent = text;
        resolve();
        return;
      }
      let i = 0;
      const step = () => {
        i += 1 + (Math.random() < 0.25 ? 1 : 0);
        el.textContent = text.slice(0, i);
        el.appendChild(caret);
        character.setLevel(0.3 + Math.random() * 0.7);
        if (i < text.length) setTimeout(step, 26 + Math.random() * 30);
        else {
          character.setLevel(0);
          setTimeout(() => { caret.remove(); resolve(); }, 350);
        }
      };
      step();
    });
  }

  let depth = 0;
  async function playNode(id) {
    const node = config.nodes?.[id];
    if (!node) return;
    if (node.title) document.title = node.title;
    if (typeof node.progress === 'number') {
      $('.ps-progress i').style.width = `${Math.min(1, node.progress) * 100}%`;
      $('.ps-progress').setAttribute('aria-valuenow', String(node.progress));
    }
    // Previous line joins the dimming history (keep the last two).
    const current = $('.ps-current');
    if (current.textContent.trim()) {
      const past = document.createElement('p');
      past.className = 'ps-line';
      past.textContent = current.textContent;
      const hist = $('.ps-history');
      hist.appendChild(past);
      while (hist.children.length > 2) hist.firstChild.remove();
    }
    $('.ps-slot').innerHTML = '';
    character.setMode(node.emote || 'neutral');
    character.think(500 + Math.random() * 500);
    depth += 1;
    character.dollyTo(Math.max(1.55, 2.35 - depth * 0.12));
    // The "composing" dots bridge the voice-preparation gap on EVERY node —
    // preset-question chips included, not only the typed ask (owner,
    // 19.08.26). typeInto overwrites them the moment the line starts.
    current.innerHTML = '<span class="ps-thinkdots"><i></i><i></i><i></i></span>';
    const line = fill(pickLine(node, seenLines), answers);
    const startVoice = await speak(line);
    const voiceDone = startVoice() || Promise.resolve();
    await typeInto(current, line);
    if (node.next) await voiceDone.catch(() => undefined);

    if (node.choices?.length) {
      const wrap = document.createElement('div');
      wrap.className = 'ps-choices';
      for (const c of node.choices) {
        const b = document.createElement('button');
        b.className = 'ps-chip';
        b.type = 'button';
        b.textContent = c.label;
        b.addEventListener('click', () => {
          answers[c.key || c.label] = c.label;
          // The visitor's pick joins the transcript — a chosen door should
          // read like something YOU said, exactly like a typed question.
          const hist = $('.ps-history');
          const said = document.createElement('p');
          said.className = 'ps-line';
          said.textContent = `— ${c.label}`;
          hist.appendChild(said);
          while (hist.children.length > 2) hist.firstChild.remove();
          void playNode(c.next);
        });
        wrap.appendChild(b);
      }
      $('.ps-slot').appendChild(wrap);
    } else if (node.input) {
      const form = document.createElement('form');
      form.className = 'ps-form';
      const input = document.createElement('input');
      input.className = 'ps-input';
      input.placeholder = node.input.placeholder || '';
      input.setAttribute('aria-label', node.input.placeholder || node.input.key);
      input.required = true;
      const send = document.createElement('button');
      send.className = 'ps-chip ps-send';
      send.type = 'submit';
      send.textContent = '→';
      send.setAttribute('aria-label', 'Send');
      form.append(input, send);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        answers[node.input.key] = input.value.trim();
        void playNode(node.input.next);
      });
      $('.ps-slot').appendChild(form);
      input.focus();
    } else if (node.ask) {
      // ASK-ME-ANYTHING loop: free text matched against a curated FAQ bank.
      // Static-site honest: no model behind it — `match` keywords score each
      // entry, the best one answers in the character's voice, and a miss gets
      // the fallback (which should deflect with personality, never pretend).
      // A `done` chip exits the loop to the next branch.
      renderAsk(node);
    } else if (node.handoff) {
      const wrap = document.createElement('div');
      wrap.className = 'ps-choices';
      // A plain LINK chip (download, docs) rides first when `href` is given;
      // the mailto chip carries the collected answers as the message body.
      if (node.handoff.href) {
        const link = document.createElement('a');
        link.className = 'ps-chip';
        link.href = node.handoff.href;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = node.handoff.label || 'Open →';
        wrap.appendChild(link);
      }
      if (node.handoff.email) {
        const summary = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join('\n');
        const mail = document.createElement('a');
        mail.className = 'ps-chip';
        mail.href = `mailto:${node.handoff.email}?subject=${encodeURIComponent(node.handoff.subject || 'Hello')}&body=${encodeURIComponent(summary)}`;
        mail.textContent = node.handoff.href
          ? `Write us: ${node.handoff.email}`
          : node.handoff.label || `Write us: ${node.handoff.email}`;
        wrap.appendChild(mail);
      }
      $('.ps-slot').appendChild(wrap);
    } else if (node.next) {
      setTimeout(() => void playNode(node.next), node.holdMs ?? 1400);
    }
  }

  function renderAsk(node) {
    const slot = $('.ps-slot');
    slot.innerHTML = '';
    const form = document.createElement('form');
    form.className = 'ps-form';
    const input = document.createElement('input');
    input.className = 'ps-input';
    input.placeholder = node.ask.placeholder || 'Ask me anything…';
    input.setAttribute('aria-label', input.placeholder);
    input.required = true;
    const send = document.createElement('button');
    send.className = 'ps-chip ps-send';
    send.type = 'submit';
    send.textContent = '→';
    send.setAttribute('aria-label', 'Ask');
    form.append(input, send);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      // The box empties the moment the question is taken — a submitted form
      // that still shows the text reads as stuck (owner, 19.08.26) — and the
      // dots say "composing" until the real answer types over them.
      input.value = '';
      input.disabled = true;
      send.disabled = true;
      $('.ps-current').innerHTML = '<span class="ps-thinkdots"><i></i><i></i><i></i></span>';
      // The visitor's words join the history — a Q&A with an invisible
      // question reads as the character talking to itself.
      const hist = $('.ps-history');
      const asked = document.createElement('p');
      asked.className = 'ps-line';
      asked.textContent = `— ${q}`;
      hist.appendChild(asked);
      while (hist.children.length > 2) hist.firstChild.remove();
      const canned = () => {
        const words = q.toLowerCase().match(/[\p{L}\p{N}']{2,}/gu) ?? [];
        let best = null;
        let bestScore = 0;
        for (const entry of node.ask.faq || []) {
          let score = 0;
          for (const kw of entry.match || []) {
            const k = kw.toLowerCase();
            if (words.some((w) => w === k || w.startsWith(k) || k.startsWith(w))) score += 1;
          }
          if (score > bestScore) { bestScore = score; best = entry; }
        }
        return best && bestScore > 0 ? best : (node.ask.fallback || { lines: ["That one's beyond me — ask my humans."] });
      };
      const finish = (line) => {
        void speak(line).then((startVoice) => {
          startVoice();
          void typeInto($('.ps-current'), line).then(() => renderAsk(node));
        });
      };
      character.think(700);
      if (typeof node.ask.resolve === 'function') {
        // A LIVE mind behind the face — the page supplies the model call
        // (node.ask.resolve(question, answers) → Promise<string|null>); the
        // curated bank answers whenever it fails, so the character never
        // stalls on a dead key or a slow network.
        const thinking = setInterval(() => character.think(400), 450);
        Promise.resolve(node.ask.resolve(q, { ...answers }))
          .catch(() => null)
          .then((ans) => {
            clearInterval(thinking);
            const line = typeof ans === 'string' && ans.trim()
              ? ans.trim()
              : fill(pickLine(canned(), seenLines), answers);
            finish(line);
          });
      } else {
        finish(fill(pickLine(canned(), seenLines), answers));
      }
    });
    slot.appendChild(form);
    if (node.ask.done) {
      const doneWrap = document.createElement('div');
      doneWrap.className = 'ps-choices';
      const done = document.createElement('button');
      done.className = 'ps-chip';
      done.type = 'button';
      done.textContent = node.ask.done.label || "That's all";
      done.addEventListener('click', () => void playNode(node.ask.done.next));
      doneWrap.appendChild(done);
      slot.appendChild(doneWrap);
    }
    input.focus();
  }

  $('.ps-invite').addEventListener('click', () => {
    $('.ps-invite').remove();
    $('.ps-restart').hidden = false;
    character.setMode('neutral');
    void playNode(config.start);
  }, { once: true });
  $('.ps-restart').addEventListener('click', () => {
    depth = 0;
    seenLines.clear();
    $('.ps-history').innerHTML = '';
    $('.ps-current').textContent = '';
    character.dollyTo(2.35);
    void playNode(config.start);
  });

  function setMuted(v) {
    muted = Boolean(v);
    if (muted) {
      try { speechSynthesis.cancel(); } catch { /* no synth */ }
      if (typeof config.stopSpeak === 'function') config.stopSpeak();
      character.setLevel(0);
    }
    const rail = $('.ps-mute');
    if (rail && !rail.hidden) rail.textContent = muted ? '🔇' : '🔊';
  }

  return { playNode, answers, setMuted };
}

customElements.define('persona-stage', class extends HTMLElement {});
