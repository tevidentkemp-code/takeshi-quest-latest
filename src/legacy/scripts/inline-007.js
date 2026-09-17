
/*
  SQ Pinball DMD (Round-Dot, HiDPI) — Top Bar Display
  --------------------------------------------------
  - Native buffer: 256×64 (hi-def DMD)
  - Round-dot mask: precomputed at output resolution
  - HiDPI: output canvas = CSS px × devicePixelRatio
  - Crisp scaling: imageSmoothingEnabled=false
  - Idle loop never stops
  - Public API:
      window.sqDmdShow(top, bottom, opts)
      window.sqDmdSetIdle(text)
      window.sqDmdStop()
      window.sqDmdSetPlayerMeta(meta)
*/

function __sqDmdInitV7(){
  "use strict";

  // ---------- Config ----------
  // Double-density native buffer for smoother DMD text (still dot-matrix after masking)
  const NATIVE_W = 640;
  const NATIVE_H = 160;

  const DEFAULTS = {
    fps: 60,
    stepMs: 1000 / 30,      // DMD frame-step cadence (30fps feel inside 60fps loop)
    glowAlpha: 0.45,
    glowPasses: 2,
    // speed is in NATIVE pixels/sec; doubled to maintain similar on-screen scroll speed
    idleSpeedPxPerSec: 52,
    flashMs: 900,
    holdMs: 900,
    paddingPx: 2
  };

  // ---------- DOM ----------
  const wrap = document.getElementById("sqDmdWrap");
  const canvas = document.getElementById("sqDmdCanvas");

  // Late-init safe: header/game UI may be constructed AFTER this script executes.
  if (!wrap || !canvas){
    if (!window.__sqDmdInitV7_hooked){
      window.__sqDmdInitV7_hooked = true;

      const retry = () => {
        const w = document.getElementById("sqDmdWrap");
        const c = document.getElementById("sqDmdCanvas");
        if (w && c) {
          setTimeout(() => { __sqDmdInitV7(); }, 0);
        }
      };

      if (document.readyState === "loading"){
        document.addEventListener("DOMContentLoaded", retry);
      } else {
        setTimeout(retry, 0);
      }

      const mo = new MutationObserver(retry);
      mo.observe(document.documentElement, { childList:true, subtree:true });
      window.__sqDmdInitV7_mo = mo;
    }
    return;
  }

  // Guard: only boot once when DOM exists
  if (window.__sqDmdInitV7_started) return;
  window.__sqDmdInitV7_started = true;
  if (window.__sqDmdInitV7_mo){ try { window.__sqDmdInitV7_mo.disconnect(); } catch(e){} }

  const ctx = canvas.getContext("2d", { alpha: true });

  // ---------- Offscreens ----------
  const native = document.createElement("canvas");
  native.width = NATIVE_W;
  native.height = NATIVE_H;
  const nctx = native.getContext("2d", { alpha: true });

  const scaled = document.createElement("canvas"); // reused buffer at output resolution
  const sctx = scaled.getContext("2d", { alpha: true });

  const mask = document.createElement("canvas");   // round-dot mask at output resolution
  const mctx = mask.getContext("2d", { alpha: true });

  const prevScaled = document.createElement("canvas"); // for subtle persistence
  const pctx = prevScaled.getContext("2d", { alpha: true });

  // ---------- State ----------
  let DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  let outW = 0, outH = 0;

  let isRunning = false;
  let rafId = 0;

  const q = [];
  let active = null;

  let idleText = "";
  let idleOffset = 0;

  // ---------- Phase A: Player Meta (full name + nickname) ----------
  const playerMeta = Object.create(null);
  function setPlayerMeta(meta){
    if (!meta || typeof meta !== 'object') return;
    for (const k of Object.keys(meta)){
      const v = meta[k] || {};
      playerMeta[k] = {
        code: k,
        full: (v.full || v.name || k).toString(),
        nick: (v.nick || v.nickname || k).toString(),
      };
    }
  }
  function getPlayerMeta(code){
    const c = (code || '').toString().trim().toUpperCase();
    return playerMeta[c] || { code: c || '?', full: c || '?', nick: c || '?' };
  }

  // ---------- Text rendering (vector → thresholded pixels) ----------
// We render text with canvas fillText at native resolution, then threshold to on/off pixels.
// This gives smoother curves while still remaining true dot-matrix once masked.
const TEXT = {
  family: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  // keep proportions consistent as native resolution changes
  topPx: Math.max(18, Math.round(NATIVE_H * 0.375)),   // 24 @ 64, 48 @ 128
  botPx: Math.max(16, Math.round(NATIVE_H * 0.3125)),  // 20 @ 64, 40 @ 128
  weight: 800,
  threshold: 28, // 0–255; higher = fewer lit pixels
  letterSpacingPx: Math.max(1, Math.round(NATIVE_H / 64))
};

/* >>> PATCH:SQ_DMD_ZONES_V1 START
   Three-zone layout (per DOT MATRIX LAYOUT spec)
   - Zone 1: left column, full height
   - Zone 2: right-top
   - Zone 3: right-bottom
   Notes:
   - Backwards compatible: sqDmdShow(top,bottom) maps to Z2(top) + Z3(bottom)
   - Zone APIs:
       sqDmdShowZ1(text, opts)
       sqDmdShowZ2(text, opts)
       sqDmdShowZ3(text, opts)
       sqDmdShowZones({z1,z2,z3}, opts)
>>> PATCH:SQ_DMD_ZONES_V1 END */
const ZONES = {
  // tuned for 640×160 native buffer (higher dot density)
  z1w: 78,
  z2h: 80,
  z3h: 80
};

// >>> PATCH:DMD_ZONE1_LOCK START
// Zone 1 is pinned: ONLY "ROUND" (small) + target (big).
window.__sqDmdPinnedZ1Text = "ROUND\n--";
window.sqDmdSetRoundTarget = function(bottomText){
  const b = (bottomText == null ? "--" : String(bottomText)).trim();
  window.__sqDmdPinnedZ1Text = "ROUND\n" + b;
};
// >>> PATCH:DMD_ZONE1_LOCK END
function zoneRects(){
  const z1 = { x:0, y:0, w:ZONES.z1w, h:NATIVE_H };
  const z2 = { x:ZONES.z1w, y:0, w:(NATIVE_W - ZONES.z1w), h:ZONES.z2h };
  const z3 = { x:ZONES.z1w, y:ZONES.z2h, w:(NATIVE_W - ZONES.z1w), h:ZONES.z3h };
  return { z1, z2, z3, right:{ x:ZONES.z1w, y:0, w:(NATIVE_W - ZONES.z1w), h:NATIVE_H } };
}

function drawZ1Target(z1Text, rect){
  const t = (z1Text || "").toString().toUpperCase().trim();
  if (!t) return;
  const parts = t.split(/\n/).filter(Boolean);
  const target = (parts.length ? parts[parts.length - 1] : t).trim();
  if (!target) return;

  // SC-045: make the visible pinball indicator actually read ROUND + target.
  // The label stays small and the target remains the dominant element.
  const top = { x:rect.x, y:rect.y + 3, w:rect.w, h:42 };
  const body = { x:rect.x, y:rect.y + 38, w:rect.w, h:rect.h - 38 };
  drawTextInRect('ROUND', top, 15, "center", "middle", 800);
  drawTextInRect(target, body, 46, "center", "middle", 750);
}

function drawTextInRect(str, rect, px, align="center", v="middle", weight, yOff=0){
  const t = (str || "").toString().toUpperCase();
  if (!t) return;

  // Fit complete callouts/names inside their zone. Clipping alone used to cut
  // off both ends of longer messages, especially with the monospace font.
  const inset = 6;
  const available = Math.max(1, rect.w - inset * 2);
  while (px > 8 && measureTextPx(t, px, weight) > available) px -= 1;
  const measured = measureTextPx(t, px, weight);
  const scaleX = Math.min(1, available / Math.max(1, measured));
  const w = measured * scaleX;
  let x = rect.x + inset;
  if (align === "center") x = Math.floor(rect.x + (rect.w - w) / 2);
  else if (align === "right") x = Math.floor(rect.x + rect.w - inset - w);

  // baseline handling
  let yBase = rect.y + rect.h - 6; // default bottom-ish
  if (v === "middle") yBase = Math.floor(rect.y + rect.h/2 + px*0.35);
  else if (v === "top") yBase = Math.floor(rect.y + px + 6);
  yBase += (yOff|0);

  nctx.save();
  nctx.beginPath();
  nctx.rect(rect.x, rect.y, rect.w, rect.h);
  nctx.clip();

  nctx.translate(x, yBase);
  nctx.scale(scaleX, 1);
  drawTextPx(t, 0, 0, px, weight);

  nctx.restore();
}

function setFont(px, weight){
  const w = (typeof weight === "number" ? weight : TEXT.weight);
  nctx.font = `${w} ${px}px ${TEXT.family}`;
  nctx.textBaseline = "alphabetic";
  nctx.textAlign = "left";
}

function measureTextPx(str, px, weight){
  setFont(px, weight);
  // simple letter spacing approximation
  const t = (str || "").toUpperCase();
  // drawTextPx paints individual characters, so measure those same advances
  // rather than a differently kerned whole string.
  const width = Array.from(t).reduce((sum, ch) => sum + nctx.measureText(ch).width, 0);
  return Math.ceil(width + Math.max(0, t.length-1) * TEXT.letterSpacingPx);
}

function drawTextPx(str, x, yBaseline, px, weight){
  setFont(px, weight);
  const t = (str || "").toUpperCase();
  // manual letter spacing by drawing char-by-char
  let cx = x;
  for (let i=0;i<t.length;i++){
    const ch=t[i];
    nctx.fillText(ch, cx, yBaseline);
    cx += nctx.measureText(ch).width + TEXT.letterSpacingPx;
  }
  return cx - x;
}

function thresholdNativeToAmber(){
  const img = nctx.getImageData(0,0,NATIVE_W,NATIVE_H);
  const d = img.data;
  const thr = TEXT.threshold|0;
  for (let i=0;i<d.length;i+=4){
    const a = d[i+3];
    if (a > thr){
      // lit pixel
      d[i]   = 255; // R
      d[i+1] = 170; // G
      d[i+2] = 40;  // B
      d[i+3] = 255; // A
    } else {
      d[i+3] = 0;
    }
  }
  nctx.putImageData(img,0,0);
}

// ---------- Layout / HiDPI ----------
  function resize() {
    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));

    DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    outW = Math.floor(cssW * DPR);
    outH = Math.floor(cssH * DPR);

    canvas.width = outW;
    canvas.height = outH;

    scaled.width = outW;
    scaled.height = outH;

    prevScaled.width = outW;
    prevScaled.height = outH;

    mask.width = outW;
    mask.height = outH;

    // Critical: crisp scaling
    ctx.imageSmoothingEnabled = false;
    sctx.imageSmoothingEnabled = false;
    pctx.imageSmoothingEnabled = false;

    buildDotMask();
  }

  function buildDotMask() {
    mctx.clearRect(0, 0, outW, outH);

    // Map each native pixel to an output cell.
    const cellW = outW / NATIVE_W;
    const cellH = outH / NATIVE_H;

    // If layout is still unstable (Safari zoom/viewport settling), avoid building a 1px mask.
    // We’ll get a ResizeObserver/visualViewport ping and rebuild when real sizes land.
    if (cellW < 0.5 || cellH < 0.5) return;

    // ---- FAST MASK BUILD (Safari-friendly) ----
    // Create ONE dot tile (with gradient) then stamp it across the grid.
    // This avoids creating 65k radial gradients which can stall Safari for seconds.
    const tileW = Math.max(1, Math.ceil(cellW));
    const tileH = Math.max(1, Math.ceil(cellH));
    const dotTile = document.createElement('canvas');
    dotTile.width = tileW;
    dotTile.height = tileH;
    const dctx = dotTile.getContext('2d', { alpha: true });

    const cx0 = tileW * 0.5;
    const cy0 = tileH * 0.5;
    const r0 = Math.max(0.5, Math.min(tileW, tileH) * 0.49);
    const edge0 = Math.max(0.8, Math.min(tileW, tileH) * 0.10);

    const grad0 = dctx.createRadialGradient(cx0, cy0, Math.max(0.1, r0 - edge0), cx0, cy0, r0);
    grad0.addColorStop(0, 'rgba(255,255,255,1)');
    grad0.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = grad0;
    dctx.beginPath();
    dctx.arc(cx0, cy0, r0, 0, Math.PI * 2);
    dctx.fill();

    // Stamp the tile grid
    for (let y = 0; y < NATIVE_H; y++) {
      const dy = y * cellH;
      for (let x = 0; x < NATIVE_W; x++) {
        mctx.drawImage(dotTile, x * cellW, dy, cellW, cellH);
      }
    }
  }

  // Resize + rebuild when Safari finishes viewport settling / zoom.
  // (This is the root cause of “flashes then catches up”.)
  try {
    const ro = new ResizeObserver(() => { resize(); });
    ro.observe(wrap);
    window.__sqDmdInitV7_ro = ro;
  } catch(_e) {}
  if (window.visualViewport){
    try {
      window.visualViewport.addEventListener('resize', () => { resize(); }, { passive:true });
    } catch(_e) {}
  }

  // ---------- Scene Queue ----------
  function enqueue(scene) {
    q.push(scene);
    // Idle is an infinite scene; it must be interruptible or queued messages will never show.
    if (!active || (active && active.type === "idle")) nextScene();
    start();
  }

  function nextScene() {
    active = q.shift() || null;
    if (!active) {
      // fall back to idle
      active = { type: "idle", z1: (__sqDmdLastZ1||""), z2: idleText, z3: (__sqDmdLastZ3||""), start: performance.now() };
      idleOffset = 0;
    } else {
      active.start = performance.now();
    }
  }

  function setIdle(text) {
    idleText = (text || "").toUpperCase();
    if (!active || active.type === "idle") {
      active = { type: "idle", z1: (__sqDmdLastZ1||""), z2: idleText, z3: (__sqDmdLastZ3||""), start: performance.now() };
      idleOffset = 0;
    }
    start();
  }

  function stop() {
    q.length = 0;
    active = null;
    isRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---------- Rendering ----------
  // >>> PATCH:SQ_DMD_VOLDY_IMG START
  const __SQ_VOLDY_SRC = 'data:image/jpeg;base64,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';
  let __sqVoldyImg = null;
  function __sqLoadVoldy(){
    if (__sqVoldyImg) return __sqVoldyImg;
    const im = new Image();
    im.decoding = 'async';
    im.src = __SQ_VOLDY_SRC;
    __sqVoldyImg = im;
    return im;
  }
  __sqLoadVoldy();
  // <<< PATCH:SQ_DMD_VOLDY_IMG END

  // >>> PATCH:SQ_DMD_DESMOND_IMG START
  const __SQ_DESMOND_SRC = 'data:image/jpeg;base64,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';
  let __sqDesmondImg = null;
  function __sqLoadDesmond(){
    if (__sqDesmondImg) return __sqDesmondImg;
    try {
      __sqDesmondImg = new Image();
      __sqDesmondImg.decoding = 'async';
      __sqDesmondImg.src = __SQ_DESMOND_SRC;
    } catch(_){
      __sqDesmondImg = null;
    }
    return __sqDesmondImg;
  }
  // <<< PATCH:SQ_DMD_DESMOND_IMG END

  // >>> PATCH:SQ_DMD_LASTDART_IMG START
  const __SQ_LASTDART_SRC = 'data:image/jpeg;base64,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';
  let __sqLastDartImg = null;
  function __sqLoadLastDartHero(){
    if (__sqLastDartImg) return __sqLastDartImg;
    try {
      __sqLastDartImg = new Image();
      __sqLastDartImg.decoding = 'async';
      __sqLastDartImg.src = __SQ_LASTDART_SRC;
    } catch(_){
      __sqLastDartImg = null;
    }
    return __sqLastDartImg;
  }
  // <<< PATCH:SQ_DMD_LASTDART_IMG END

  let lastStepAt = 0;

  function render(now) {
    rafId = requestAnimationFrame(render);
    if (!active) nextScene();

    // 1) update internal “DMD step” cadence
    if (!lastStepAt) lastStepAt = now;
    const stepDue = (now - lastStepAt) >= DEFAULTS.stepMs;
    if (stepDue) lastStepAt = now;

    // 2) draw native buffer (128×32)
    if (stepDue) drawNative(now);

    // 3) upscale native → scaled (crisp)
    sctx.clearRect(0, 0, outW, outH);
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(native, 0, 0, outW, outH);
    // >>> PATCH:SQ_DMD_ANIME_FX_PACK_STAGE4 START
    // Additional “anime finisher” style FX (speedlines / lightning / impact flash)
    // Runs on the SCALED buffer so everything still becomes round-dots after masking.
    if (active && active.fx) {
      let fx = String(active.fx);
      // Auto-upgrade IMPACT to FINISHER when the callout is a big moment.
      const callout = ((active && typeof active.z2 === 'string') ? active.z2 : '') + ' ' + ((active && typeof active.z3 === 'string') ? active.z3 : '');
      if (fx === 'impact' && /TRIPLE|BULL|CRITICAL|FINISH|KO|ON FIRE|LEADER|PB|HS/i.test(callout)) fx = 'finisher';
      const age = (active && active.start) ? (now - active.start) : 0;

      // Utility: clamp 0..1
      const clamp01 = (v) => (v < 0 ? 0 : (v > 1 ? 1 : v));
      const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);

      // Define Zone2 rect in OUTPUT px (right side, top half)
      // Keep proportional to native zones: z1w is defined in drawNative; here we derive from NATIVE ratio.
      const z1wPx = Math.floor(outW * (ZONES.z1w / NATIVE_W));
      const z2x = z1wPx;
      const z2y = 0;
      const z2w = outW - z1wPx;
      const z2h = Math.floor(outH * 0.5);

      // --- FX: SMEAR (subtle motion trails) ---
      if (fx === "smear") {
        const a = 0.18;
        sctx.save();
        sctx.globalAlpha = a;
        sctx.imageSmoothingEnabled = false;
        // two trailing copies
        sctx.drawImage(scaled, -2 * DPR, 0);
        sctx.drawImage(scaled, -4 * DPR, 0);
        sctx.restore();
      }

      // --- FX: IMPACT (brief strobe + dot burst in Zone2) ---
      if (fx === "impact" || fx === "finisher") {
        const p = easeOut(age / 220);
        const flashA = 0.55 * (1 - p);

        // Strobe fill (will be dotted by mask)
        sctx.save();
        sctx.globalAlpha = flashA;
        sctx.fillStyle = "rgba(255,255,255,1)";
        sctx.fillRect(z2x, z2y, z2w, z2h);
        sctx.restore();

        // Dot burst (deterministic)
        const burstN = (fx === "finisher") ? 36 : 22;
        const cx = z2x + Math.floor(z2w * 0.55);
        const cy = z2y + Math.floor(z2h * 0.55);
        const rMax = (fx === "finisher") ? (z2h * 0.62) : (z2h * 0.45);

        sctx.save();
        sctx.globalAlpha = 0.55 * (1 - p);
        sctx.fillStyle = "rgba(255,255,255,1)";
        for (let i = 0; i < burstN; i++) {
          const ang = (i * 0.61803398875) * Math.PI * 2; // golden-angle
          const rr = rMax * (i / burstN);
          const x = Math.round(cx + Math.cos(ang) * rr);
          const y = Math.round(cy + Math.sin(ang) * rr);
          sctx.fillRect(x, y, 2, 2);
        }
        sctx.restore();
      }

      // --- FX: MINI SPEEDLINES (visible even on IMPACT) ---
      if (fx === "impact") {
        const p = easeOut(age / 260);
        const a = 0.18 * (1 - p);
        sctx.save();
        sctx.globalAlpha = a;
        sctx.fillStyle = "rgba(255,255,255,1)";
        for (let i = 0; i < 5; i++) {
          const y0 = z2y + Math.floor((0.15 + i*0.17) * z2h);
          const x0 = z2x + Math.floor((1 - p) * z2w);
          const len = Math.floor(z2w * 0.22);
          for (let k = 0; k < len; k += 7) {
            const x = x0 + k;
            const y = y0 + Math.floor(k * 0.16);
            sctx.fillRect(x, y, 4, 2);
          }
        }
        sctx.restore();
      }
      // --- FX: SPEEDLINES (diagonal streaks in Zone2) ---
      if (fx === "finisher") {
        const p = easeOut(age / 360);
        const a = 0.28 * (1 - p);

        sctx.save();
        sctx.globalAlpha = a;
        sctx.fillStyle = "rgba(255,255,255,1)";

        // draw 9 diagonal streaks
        for (let i = 0; i < 9; i++) {
          const y0 = z2y + Math.floor((i / 9) * z2h);
          const x0 = z2x + Math.floor((1 - p) * z2w);
          // streak length
          const len = Math.floor(z2w * (0.35 + 0.25 * (i % 2)));
          for (let k = 0; k < len; k += 6) {
            const x = x0 + k;
            const y = y0 + Math.floor(k * 0.18);
            sctx.fillRect(x, y, 5, 2);
          }
        }
        sctx.restore();
      }

      // --- FX: LIGHTNING (zigzag bolt in Zone2) ---
      if (fx === "finisher") {
        const p = easeOut(age / 420);
        const a = 0.35 * (1 - p);

        const xStart = z2x + Math.floor(z2w * 0.18);
        const xEnd   = z2x + Math.floor(z2w * 0.92);
        const yMid   = z2y + Math.floor(z2h * 0.42);

        sctx.save();
        sctx.globalAlpha = a;
        sctx.fillStyle = "rgba(255,255,255,1)";

        // deterministic zigzag segments
        let x = xStart;
        let y = yMid;
        const steps = 14;
        for (let i = 0; i < steps; i++) {
          const t = i / steps;
          const nx = Math.floor(xStart + (xEnd - xStart) * t);
          const ny = yMid + Math.floor(Math.sin((i + 1) * 1.7) * (8 + (i % 3) * 4));
          // draw “thick” bolt as small rects
          const w = 5 + (i % 2);
          const h = 2 + (i % 3 === 0 ? 1 : 0);
          sctx.fillRect(nx, ny, w, h);
          x = nx; y = ny;
        }
        sctx.restore();
      }

      // --- FX: EXPLOSION END-CAP (bigger finish) ---
      if (fx === "finisher") {
        const t2 = clamp01((age - 520) / 320);
        const a2 = 0.55 * (t2) * (1 - t2);
        const cx2 = z2x + Math.floor(z2w * 0.58);
        const cy2 = z2y + Math.floor(z2h * 0.55);
        const r2 = (z2h * 0.18) + (z2h * 0.72) * t2;

        sctx.save();
        // Big white flash at peak
        sctx.globalAlpha = 0.38 * (t2 > 0.85 ? (1 - t2) * 6 : 0);
        sctx.fillStyle = "rgba(255,255,255,1)";
        sctx.fillRect(z2x, z2y, z2w, z2h);
        sctx.restore();

        // Expanding ring burst
        sctx.save();
        sctx.globalAlpha = a2;
        sctx.fillStyle = "rgba(255,255,255,1)";
        const n2 = 46;
        for (let i = 0; i < n2; i++) {
          const ang = (i * 0.61803398875) * Math.PI * 2;
          const x = Math.round(cx2 + Math.cos(ang) * r2);
          const y = Math.round(cy2 + Math.sin(ang) * r2);
          sctx.fillRect(x, y, 3, 2);
        }
        sctx.restore();
      }

    }
    // <<< PATCH:SQ_DMD_ANIME_FX_PACK_STAGE4 END

    // 4) clear output
    ctx.clearRect(0, 0, outW, outH);

    
    // >>> PATCH:SQ_DMD_ANIM_PACK1_CTXFX START
    // Scene-level canvas effects (wipe + shake). Applied at output stage to keep native text logic simple.
    const ageFx = (active && active.start) ? (now - active.start) : 0;
    let fxDx = 0, fxDy = 0;

    // SHAKE: small deterministic shake (no random allocations)
    if (active && active.type === "shake") {
      const amp = (typeof active.amp === "number" ? active.amp : 2.0) * DPR;
      fxDx = Math.round(Math.sin(ageFx * 0.06) * amp);
      fxDy = Math.round(Math.cos(ageFx * 0.07) * (amp * 0.65));
    }

    // Wipe: reveal left→right (or reverse) via clip rect
    let doClip = false, clipX = 0, clipW = outW;
    if (active && active.type === "wipe") {
      const revealMs = (typeof active.revealMs === "number" ? active.revealMs : 260);
      const p = Math.max(0, Math.min(1, ageFx / Math.max(60, revealMs)));
      doClip = true;
      if (active.dir === "rev") {
        clipW = Math.floor(outW * p);
        clipX = outW - clipW;
      } else {
        clipW = Math.floor(outW * p);
        clipX = 0;
      }
    }

    ctx.save();
    if (fxDx || fxDy) ctx.translate(fxDx, fxDy);
    if (doClip) {
      ctx.beginPath();
      ctx.rect(clipX, 0, Math.max(1, clipW), outH);
      ctx.clip();
    }
    // <<< PATCH:SQ_DMD_ANIM_PACK1_CTXFX END

    // 5) subtle persistence (previous frame)
    ctx.globalAlpha = 0.25;
    ctx.drawImage(prevScaled, 0, 0);
    ctx.globalAlpha = 1;

    // 6) glow pass (behind dots)
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = DEFAULTS.glowAlpha;
    for (let i = 0; i < DEFAULTS.glowPasses; i++) {
      ctx.drawImage(scaled, i ? 1 : 0, i ? 1 : 0);
      ctx.drawImage(scaled, i ? -1 : 0, i ? 0 : -1);
    }
    ctx.restore();

    // 7) apply round-dot mask
    // mask (white circles) + source-in with scaled pixels = round dots
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.drawImage(scaled, 0, 0);
    ctx.restore();

    // 8) glass overlay (scan + sheen)
    drawGlassOverlay();

    
    // >>> PATCH:SQ_DMD_ANIM_PACK1_CTXFX_RESTORE START
    ctx.restore();
    // <<< PATCH:SQ_DMD_ANIM_PACK1_CTXFX_RESTORE END

    // 9) snapshot to prevScaled for persistence
    pctx.clearRect(0, 0, outW, outH);
    pctx.drawImage(canvas, 0, 0);

    // 10) scene end / transition
    if (active && active.type !== "idle") {
      const age = now - active.start;
      const dur = active.ms || DEFAULTS.holdMs;
      if (age >= dur) nextScene();
    }
  }

  // Special artwork is a DMD banner, not a contained thumbnail: keep its
  // natural aspect ratio, fill the usable width at every pulse phase, and let
  // the native canvas crop excess height symmetrically. Small shake/pulse
  // excursions may crop a few horizontal edge pixels, which is intentional.
  function drawDmdSceneImage(im, age, amp, rateX, rateY, pulseAmp, yAmp){
    if (!im || !im.complete || !im.naturalWidth || !im.naturalHeight) return;
    amp = Math.min(12, Math.max(0, Number(amp) || 0));
    const insetX = 4;
    const safeWidth = Math.max(1, NATIVE_W - insetX * 2);
    const minPulse = Math.max(.8, 1 - Math.abs(Number(pulseAmp) || 0));
    const scale = safeWidth / im.naturalWidth / minPulse;
    const pulse = 1 + Math.sin(age * .028) * pulseAmp;
    const w = im.naturalWidth * scale * pulse;
    const h = im.naturalHeight * scale * pulse;
    const x = (NATIVE_W - w) / 2 + Math.sin(age * rateX) * amp;
    const y = (NATIVE_H - h) / 2 + Math.cos(age * rateY) * amp * yAmp;
    nctx.save();
    nctx.globalAlpha = 1;
    nctx.imageSmoothingEnabled = true;
    nctx.drawImage(im, x, y, w, h);
    nctx.restore();
  }

  // >>> PATCH:SC045_PINBALL_PROCEDURAL_SCENES START
  // SC-045 premium pinball art direction.
  // Special scenes are composed on a coarse 128x32 logical DMD grid (5 native
  // pixels per logical dot), then passed through the existing amber-dot mask.
  // This deliberately favours bold silhouettes, chunky 1-bit timing and staged
  // impact beats over smooth web-canvas illustration.
  const __sqSc045ReducedMotion = () => {
    try{ return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; }catch(_){ return false; }
  };
  const __SQ45_PX = 5;
  const __sq45Rect = (x,y,w=1,h=1) => {
    nctx.fillRect(Math.round(x)*__SQ45_PX, Math.round(y)*__SQ45_PX, Math.max(1,Math.round(w))*__SQ45_PX, Math.max(1,Math.round(h))*__SQ45_PX);
  };
  const __sq45Clear = (x,y,w=1,h=1) => {
    nctx.clearRect(Math.round(x)*__SQ45_PX, Math.round(y)*__SQ45_PX, Math.max(1,Math.round(w))*__SQ45_PX, Math.max(1,Math.round(h))*__SQ45_PX);
  };
  const __sq45Line = (x0,y0,x1,y1,th=1) => {
    x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1);
    const dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
    let err=dx+dy;
    while(true){
      __sq45Rect(x0-Math.floor((th-1)/2), y0-Math.floor((th-1)/2), th, th);
      if(x0===x1 && y0===y1) break;
      const e2=2*err;
      if(e2>=dy){ err+=dy; x0+=sx; }
      if(e2<=dx){ err+=dx; y0+=sy; }
    }
  };
  const __sq45Circle = (cx,cy,r,th=1) => {
    let x=r, y=0, err=0;
    const dot=(px,py)=>__sq45Rect(px-Math.floor((th-1)/2), py-Math.floor((th-1)/2), th, th);
    while(x>=y){
      [[x,y],[y,x],[-y,x],[-x,y],[-x,-y],[-y,-x],[y,-x],[x,-y]].forEach(([dx,dy])=>dot(cx+dx,cy+dy));
      y+=1;
      if(err<=0) err += 2*y+1;
      if(err>0){ x-=1; err -= 2*x+1; }
    }
  };
  const __sq45Poly = (pts, ox=0, oy=0, scale=1, flip=false) => {
    if(!Array.isArray(pts) || !pts.length) return;
    nctx.save();
    nctx.translate(Math.round(ox*__SQ45_PX), Math.round(oy*__SQ45_PX));
    nctx.scale((flip?-1:1)*scale, scale);
    nctx.beginPath();
    pts.forEach(([x,y],i)=>{
      const px=Math.round(x*__SQ45_PX), py=Math.round(y*__SQ45_PX);
      if(i===0) nctx.moveTo(px,py); else nctx.lineTo(px,py);
    });
    nctx.closePath(); nctx.fill();
    nctx.restore();
  };
  const __sq45Eye = (x,y,pupil=0,blink=false) => {
    if(blink){ __sq45Line(x,y+4,x+10,y+4,1); __sq45Line(x+1,y+3,x+9,y+3,1); return; }
    __sq45Rect(x+2,y,6,1); __sq45Rect(x+1,y+1,8,1); __sq45Rect(x,y+2,10,5); __sq45Rect(x+1,y+7,8,1); __sq45Rect(x+2,y+8,6,1);
    __sq45Clear(x+2,y+2,6,5);
    __sq45Rect(x+4+pupil,y+3,2,3);
  };
  const __sq45Dolphin = (x,y,scale=.7,flip=false,phase=0) => {
    const kick=(phase%2===0)?0:2;
    // Deliberately exaggerated dolphin profile for instant cabinet-distance recognition:
    // rounded melon + long beak, small dorsal fin, pectoral fin and forked tail.
    const pts=[
      [14,14],[25,12],[38,8],[48,7],[52,3],[59,8],[72,9],[83,10],[90,12],[96,12],[103,11],[112,13],
      [104,16],[96,16],[90,17],[80,19],[68,21],[72,26+kick],[62,22],[45,23],[30,20],[18,18],
      [10,23+kick],[13,18],[4,20],[10,16],[3,11-kick]
    ];
    __sq45Poly(pts,x,y,scale,flip);
    nctx.save(); nctx.translate(Math.round(x*__SQ45_PX),Math.round(y*__SQ45_PX)); nctx.scale((flip?-1:1)*scale,scale);
    nctx.clearRect(88*__SQ45_PX,12*__SQ45_PX,2*__SQ45_PX,2*__SQ45_PX);
    nctx.restore();
  };
  const __sq45Dart = (tipX,tipY) => {
    __sq45Line(tipX,tipY,tipX+20,tipY-2,1);
    __sq45Rect(tipX-1,tipY-1,2,2);
    __sq45Line(tipX+16,tipY-2,tipX+22,tipY-6,1);
    __sq45Line(tipX+16,tipY-1,tipX+23,tipY+3,1);
    __sq45Line(tipX+18,tipY-2,tipX+23,tipY-1,1);
  };
  // <<< PATCH:SC045_PINBALL_PROCEDURAL_SCENES END

  function drawNative(now) {
    nctx.clearRect(0, 0, NATIVE_W, NATIVE_H);

    // Draw in white first (alpha), then threshold to amber pixels.
    nctx.fillStyle = "rgba(255,255,255,1)";

    const pad = DEFAULTS.paddingPx;
    const z1t = (window.__sqDmdPinnedZ1Text ? String(window.__sqDmdPinnedZ1Text) : "ROUND\n--").toUpperCase();
    const __pZ2 = (window.__sqDmdPinnedZ2Text ? String(window.__sqDmdPinnedZ2Text) : "");
    const z2t = ((active && typeof active.z2 === "string") ? String(active.z2) : (__pZ2 || "")).toUpperCase();
    const z3t = (active && typeof active.z3 === "string") ? String(active.z3).toUpperCase() : "";


    // >>> PATCH:SC045_PINBALL_SCENE_TYPES START
    if (active && active.type === 'anticipationEyes') {
      const age=Math.max(0,now-active.start), dur=Math.max(700,Number(active.ms||1150)), reduce=__sqSc045ReducedMotion();
      const p=reduce?.36:Math.max(0,Math.min(1,age/dur));
      const text=(z2t||'CAN HE......?').toUpperCase();
      const px=Math.max(34,TEXT.topPx-8), w=measureTextPx(text,px,900);
      let x;
      if(reduce) x=28;
      else if(p<.22) x=Math.round(NATIVE_W+20-(p/.22)*(NATIVE_W-8));
      else if(p<.78) x=Math.round(28-((p-.22)/.56)*42);
      else x=Math.round(-14-((p-.78)/.22)*(w+36));
      const y=Math.floor(NATIVE_H*.60);
      drawTextPx(text,x,y,px,900);
      const blink=!reduce && ((Math.floor(age/170)%7)===5);
      const pupil=reduce?-1:(x<60?-2:(x>220?1:0));
      __sq45Line(101,6,110,5,1); __sq45Line(115,5,124,6,1);
      __sq45Eye(101,9,pupil,blink); __sq45Eye(115,9,pupil,blink);
      if(!reduce){
        const tick=Math.floor(age/95)%3;
        for(let i=0;i<3;i++) if(i!==tick) __sq45Rect(96+i*2,25+i%2,1,1);
      }
      thresholdNativeToAmber(); return;
    }
    if (active && active.type === 'dolphinSwim') {
      const age=Math.max(0,now-active.start), dur=Math.max(1300,Number(active.ms||2000)), reduce=__sqSc045ReducedMotion();
      const p=reduce?.52:Math.max(0,Math.min(1,age/dur)), phase=Math.floor(age/150)%2;
      const x1=reduce?24:(-38+p*132), y1=reduce?2:(8-Math.sin(Math.PI*p)*8);
      const x2=reduce?108:(154-p*126), y2=reduce?12:(11+Math.sin(Math.PI*p)*5);
      __sq45Dolphin(x1,y1,.72,false,phase);
      __sq45Dolphin(x2,y2,.46,true,phase+1);
      // scrolling water line and spray dots create the classic 1-bit cabinet motion cue
      for(let i=0;i<8;i++){
        const wx=((i*20-Math.round(p*70))%160+160)%160-16;
        __sq45Line(wx,30,wx+5,28,1); __sq45Line(wx+5,28,wx+10,30,1);
      }
      const sx=Math.round(x1+12), sy=Math.round(y1+20);
      [[0,0],[-3,-3],[-7,-1],[-10,-5],[-13,-2]].forEach(([dx,dy],i)=>{ if(reduce||((i+phase)%2===0)) __sq45Rect(sx+dx,sy+dy,1,1); });
      thresholdNativeToAmber(); return;
    }
    if (active && active.type === 'bullseyeHit') {
      const age=Math.max(0,now-active.start), dur=Math.max(850,Number(active.ms||1100)), reduce=__sqSc045ReducedMotion();
      const p=reduce?1:Math.max(0,Math.min(1,age/dur));
      const impactP=Math.min(1,p/.58), hit=p>=.58;
      const shake=(!reduce&&hit)?((Math.floor(age/55)%2)?1:-1):0;
      const cx=31+shake, cy=16;
      __sq45Circle(cx,cy,11,1); __sq45Circle(cx,cy,7,1); __sq45Circle(cx,cy,3,1);
      __sq45Line(cx-13,cy,cx+13,cy,1); __sq45Line(cx,cy-13,cx,cy+13,1);
      const tipX=reduce?31:Math.round(122-(122-31)*impactP);
      const tipY=reduce?16:Math.round(8+(16-8)*impactP);
      __sq45Dart(tipX,tipY);
      if(hit){
        const ray=Math.round(8+Math.min(1,(p-.58)/.24)*9);
        [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].forEach(([dx,dy])=>__sq45Line(cx+dx*5,cy+dy*5,cx+dx*ray,cy+dy*ray,1));
        const flash=((Math.floor(age/90)%2)===0)||reduce;
        if(flash) drawTextPx('50',92*__SQ45_PX,24*__SQ45_PX,48,900);
      } else {
        // speed lines make the inbound dart read instantly at a glance
        __sq45Line(Math.min(126,tipX+28),tipY-4,Math.min(127,tipX+37),tipY-5,1);
        __sq45Line(Math.min(126,tipX+30),tipY+4,Math.min(127,tipX+39),tipY+5,1);
      }
      thresholdNativeToAmber(); return;
    }
    // <<< PATCH:SC045_PINBALL_SCENE_TYPES END

        // >>> PATCH:SQ_DMD_MARQUEE_FULL START
    // Special scene type: marqueeFull (scroll Z2 text across the FULL DMD area; hides all other zones)
    if (active && active.type === 'marqueeFull') {
      const t = (z2t || '').toUpperCase();
      if (t) {
        const px = Math.max(TEXT.topPx, TEXT.botPx); // big, readable
        const w = measureTextPx(t, px, 800);
        const speed = DEFAULTS.idleSpeedPxPerSec / 28;
        const gap = 28;
        const age = now - active.start;
        const off = (age * speed);
        const xStart = (NATIVE_W) - (off % (w + gap));
        const yBase = Math.floor((NATIVE_H/2) + px*0.35);

        nctx.save();
        nctx.beginPath();
        nctx.rect(0, 0, NATIVE_W, NATIVE_H);
        nctx.clip();
        drawTextPx(t, Math.floor(xStart), yBase, px, 800);
        drawTextPx(t, Math.floor(xStart + w + gap), yBase, px, 800);
        nctx.restore();
      }
      thresholdNativeToAmber();
      return;
    }
    // <<< PATCH:SQ_DMD_MARQUEE_FULL END

    // >>> PATCH:SQ_DMD_LASTDART_RENDER START
    // Special scene type: lastDartImg (juddering Last Dart Hero image)
    if (active && active.type === 'lastDartImg') {
      const im = __sqLoadLastDartHero();
      drawDmdSceneImage(im, now - active.start, active.amp ?? 3.4, .060, .082, .03, .75);
      return;
    }
    // <<< PATCH:SQ_DMD_LASTDART_RENDER END

    // >>> PATCH:SQ_DMD_DESMOND_RENDER START
    // Special scene type: desmondImg (juddering Desmond image)
    if (active && active.type === 'desmondImg') {
      const im = __sqLoadDesmond();
      drawDmdSceneImage(im, now - active.start, active.amp ?? 3.4, .060, .082, .03, .75);
      return;
    }
    // <<< PATCH:SQ_DMD_DESMOND_RENDER END

    // >>> PATCH:SQ_DMD_VOLDY_RENDER START
    // Special scene type: voldyImg (draw Voldemort face with shake)
    if (active && active.type === 'voldyImg') {
      const im = __sqLoadVoldy();
      drawDmdSceneImage(im, now - active.start, active.amp ?? 2.6, .045, .055, 0, 1);
      return;
    }
    // <<< PATCH:SQ_DMD_VOLDY_RENDER END

// >>> PATCH:SQ_DMD_MARQUEE_TYPE START
    // Special scene type: marquee (scroll Zone 2 text across the full right area for a fixed duration)
    if (active && active.type === 'marquee') {
      const R = zoneRects();
      const t = (z2t || '').toUpperCase();
      if (t) {
        const w = measureTextPx(t, TEXT.topPx);
        const speed = DEFAULTS.idleSpeedPxPerSec / 30;
        const gap = 24;
        const age = now - active.start;
        const off = (age * speed);
        const xStart = (R.right.x + R.right.w) - (off % (w + gap));
        const yBase = Math.floor((R.right.y + R.right.h/2) + TEXT.topPx*0.35);
        nctx.save();
        nctx.beginPath();
        nctx.rect(R.right.x, R.right.y, R.right.w, R.right.h);
        nctx.clip();
        drawTextPx(t, Math.floor(xStart), yBase, TEXT.topPx);
        drawTextPx(t, Math.floor(xStart + w + gap), yBase, TEXT.topPx);
        nctx.restore();
      }
      thresholdNativeToAmber();
      return;
    }
    // <<< PATCH:SQ_DMD_MARQUEE_TYPE END

    // Flash scene: strobe
    if (active && active.type === "flash") {
      const age = now - active.start;
      const on = (Math.floor(age / 90) % 2) === 0;
      if (!on) return;
    }

    
if (!active || active.type === "idle") {
      const R = zoneRects();
      // Keep Zone 1 context visible during idle (round/phase)
      if (z1t) drawZ1Target(z1t, R.z1);

      // Keep Zone 3 content visible (after first dart) - smaller in pre-throw info mode
      const z3px = (window.__sqDmdZ3Small ? Math.max(10, TEXT.botPx - 2) : TEXT.botPx);
      if (z3t) drawTextInRect(z3t, R.z3, z3px, "center", "middle", 650);

      // Pre-throw / pinned name: NEVER marquee in Zone 2.
      const __pinnedZ2 = (window.__sqDmdPinnedZ2Text || "").toUpperCase();
      if (__pinnedZ2) {
        drawTextInRect(__pinnedZ2, R.z2, TEXT.topPx, "center", "middle", 800);
        thresholdNativeToAmber();
        return;
      }

      // Pre-throw explicit: pin current z2 (no marquee)
      if (window.__sqDmdNoScrollZ2 && z2t) {
        drawTextInRect(z2t, R.z2, TEXT.topPx, "center", "middle", 800);
        thresholdNativeToAmber();
        return;
      }

      const t = ((z2t || (window.__sqDmdPinnedZ2Text||"") || idleText) || "").toUpperCase();
      if (!t) { thresholdNativeToAmber(); return; }
      const w = measureTextPx(t, TEXT.topPx);
      const speed = DEFAULTS.idleSpeedPxPerSec / 30; // per DMD step
      idleOffset += speed;

      const gap = 24;
      const xStart = (R.right.x + R.right.w) - (idleOffset % (w + gap));
      const yBase = Math.floor((z3t ? (R.z2.y + R.z2.h/2) : (R.right.y + R.right.h/2)) + TEXT.topPx*0.35);

      nctx.save();
      nctx.beginPath();
      // If Zone 3 has content (after first dart), keep it visible and scroll ONLY in Zone 2
      const clipRect = (z3t ? R.z2 : R.right);
      nctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
      nctx.clip();

      drawTextPx(t, Math.floor(xStart), yBase, TEXT.topPx);
      drawTextPx(t, Math.floor(xStart + w + gap), yBase, TEXT.topPx);

      nctx.restore();

      thresholdNativeToAmber();
      return;
    }

    // Non-idle: paint per-zone
    const R = zoneRects();

    // Flash scene: strobe already handled above (early return), so just render text into zones.
    if (z1t) drawZ1Target(z1t, R.z1);
    if (z2t) drawTextInRect(z2t, R.z2, TEXT.topPx, "center", "middle");
    if (z3t) {
      const z3px = ((active && active.z3Small) ? Math.max(10, TEXT.botPx - 5) : TEXT.botPx);
      let yOff = 0;
      if (active && active.type === "roll") {
        const age = now - active.start;
        const dur = active.ms || DEFAULTS.holdMs;
        const t = Math.max(0, Math.min(1, age / dur));
        yOff = Math.round(12 - (24 * t)); // start below, pass through, exit above
      }
      drawTextInRect(z3t, R.z3, z3px, "center", "middle", 650, yOff);
    }

    thresholdNativeToAmber();

  }

  function drawGlassOverlay() {
    // Very subtle scanlines
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.08;

    const lineH = Math.max(2, Math.floor(2 * DPR));
    for (let y = 0; y < outH; y += lineH * 2) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, y, outW, lineH);
    }

    // Sheen band
    const g = ctx.createLinearGradient(0, 0, 0, outH);
    g.addColorStop(0, "rgba(255,255,255,0.08)");
    g.addColorStop(0.25, "rgba(255,255,255,0.02)");
    g.addColorStop(0.6, "rgba(0,0,0,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, outW, outH);

    ctx.restore();
  }

  // ---------- API ----------
  // Zone persistence: if a call omits a zone, we keep the last rendered content for that zone.
  // This lets Zone 1 stay on ROUND/PHASE while Zone 2/3 update frequently.
  let __sqDmdLastZ1 = "ROUND";
  let __sqDmdLastZ2 = "";
  let __sqDmdLastZ3 = "";

  function showZones(z, opts){
    const o = opts || {};
    // >>> PATCH:DMD_ZONE1_STRIP START
    // If callers attempt to set z1, treat it as a target update only, then strip it.
    if (z && (Object.prototype.hasOwnProperty.call(z,'z1') || Object.prototype.hasOwnProperty.call(z,'zone1'))){
      const raw = (z.z1 != null ? z.z1 : z.zone1);
      const txt = String(raw || "").toUpperCase();
      // use last line as the target value (prevents stray prefixes)
      const parts = txt.split(/\n/);
      const bottom = (parts.length ? parts[parts.length-1] : txt).trim();
      try{ window.sqDmdSetRoundTarget && window.sqDmdSetRoundTarget(bottom); }catch(_){}
      try{ delete z.z1; }catch(_){}
      try{ delete z.zone1; }catch(_){}
    }
    // <<< PATCH:DMD_ZONE1_STRIP END
    const hasZ1 = !!(z && (Object.prototype.hasOwnProperty.call(z,'z1') || Object.prototype.hasOwnProperty.call(z,'zone1')));
    const hasZ2 = !!(z && (Object.prototype.hasOwnProperty.call(z,'z2') || Object.prototype.hasOwnProperty.call(z,'zone2')));
    const hasZ3 = !!(z && (Object.prototype.hasOwnProperty.call(z,'z3') || Object.prototype.hasOwnProperty.call(z,'zone3')));

    const z1 = hasZ1 ? ((z && (z.z1 ?? z.zone1)) ?? "") : __sqDmdLastZ1;
    const z2 = hasZ2 ? ((z && (z.z2 ?? z.zone2)) ?? "") : __sqDmdLastZ2;
    const z3 = hasZ3 ? ((z && (z.z3 ?? z.zone3)) ?? "") : __sqDmdLastZ3;

    __sqDmdLastZ1 = (z1 ?? "").toString();
    __sqDmdLastZ2 = (z2 ?? "").toString();
    __sqDmdLastZ3 = (z3 ?? "").toString();

    enqueue({
      type: o.type || "hold", // hold | flash | wipe | shake | roll | idle | anticipationEyes | dolphinSwim | bullseyeHit
      dir: o.dir || "fwd",     // for wipe: fwd | rev
      revealMs: (typeof o.revealMs === "number" ? o.revealMs : undefined),
      amp: (typeof o.amp === "number" ? o.amp : undefined), // for shake
      fx: (typeof o.fx === "string" ? o.fx : undefined),    // Stage 2+ effects
      z3Small: !!o.z3Small,
      z1: __sqDmdLastZ1,
      z2: __sqDmdLastZ2,
      z3: __sqDmdLastZ3,
      ms: +o.ms || (o.type === "flash" ? DEFAULTS.flashMs : DEFAULTS.holdMs)
    });
  }

  // Backwards compatible: sqDmdShow(top,bottom) -> Zone2/Zone3
  function show(top, bottom, opts) {
    showZones({ z2: (top ?? ""), z3: (bottom ?? "") }, opts);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    resize();
    rafId = requestAnimationFrame(render);
  }

  // ---------- Init ----------
  let resizeTO = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTO);
    resizeTO = window.setTimeout(() => resize(), 60);
  });

  // >>> PATCH:SQ_DMD_VOLDY_AUDIO START
  // Voldemort laugh SFX (best-effort; autoplay may be blocked until first user interaction)
  const __SQ_VOLDY_LAUGH_URL = 'https://www.101soundboards.com/sounds/23923970-voldemort-laugh';
  let __sqVoldyAudioObj = null;
  let __sqVoldyAudioPrimed = false;

  function __sqPrimeVoldyAudio(){
    if (__sqVoldyAudioPrimed) return;
    __sqVoldyAudioPrimed = true;
    try{
      __sqVoldyAudioObj = new Audio(__SQ_VOLDY_LAUGH_URL);
      __sqVoldyAudioObj.preload = 'auto';
      __sqVoldyAudioObj.volume = 0.001;
      const p = __sqVoldyAudioObj.play();
      if (p && typeof p.then === 'function'){
        p.then(()=>{ try{ __sqVoldyAudioObj.pause(); __sqVoldyAudioObj.currentTime = 0; }catch(_){ } })
         .catch(()=>{ /* ignore */ });
      } else {
        try{ __sqVoldyAudioObj.pause(); __sqVoldyAudioObj.currentTime = 0; }catch(_){ }
      }
    }catch(_){ }
  }

  function __sqPlayVoldyLaugh(){
    try{
      if (!__sqVoldyAudioObj) __sqVoldyAudioObj = new Audio(__SQ_VOLDY_LAUGH_URL);
      __sqVoldyAudioObj.volume = 1.0;
      try{ __sqVoldyAudioObj.currentTime = 0; }catch(_){ }
      const p = __sqVoldyAudioObj.play();
      if (p && typeof p.catch === 'function') p.catch(()=>{ /* blocked */ });
    }catch(_){ }
  }

  // Prime audio on first user interaction (required by iOS/Safari autoplay policies)
  try{ document.addEventListener('pointerdown', __sqPrimeVoldyAudio, { once:true, passive:true }); }catch(_){ }
  window.__sqPlayVoldyLaugh = __sqPlayVoldyLaugh;
  // <<< PATCH:SQ_DMD_VOLDY_AUDIO END

  // >>> PATCH:SC030_DMD_TRANSIENT_CHANNEL START
  // Presentation-only channel used by the modular DMD controller.
  // It deliberately does NOT update __sqDmdLastZ2/__sqDmdLastZ3, so once a
  // transient scene ends the established renderer returns to its real baseline.
  function __sqDmdShowTransientZones(z, opts){
    const o = opts || {};
    const hasZ2 = !!(z && (Object.prototype.hasOwnProperty.call(z,'z2') || Object.prototype.hasOwnProperty.call(z,'zone2')));
    const hasZ3 = !!(z && (Object.prototype.hasOwnProperty.call(z,'z3') || Object.prototype.hasOwnProperty.call(z,'zone3')));
    const scene = {
      __sqControllerTransient: true,
      type: o.type || 'hold',
      dir: o.dir || 'fwd',
      revealMs: (typeof o.revealMs === 'number' ? o.revealMs : undefined),
      amp: (typeof o.amp === 'number' ? o.amp : undefined),
      fx: (typeof o.fx === 'string' ? o.fx : undefined),
      z3Small: !!o.z3Small,
      z1: __sqDmdLastZ1,
      z2: hasZ2 ? String((z.z2 ?? z.zone2) ?? '') : __sqDmdLastZ2,
      z3: hasZ3 ? String((z.z3 ?? z.zone3) ?? '') : __sqDmdLastZ3,
      ms: +o.ms || (o.type === 'flash' ? DEFAULTS.flashMs : DEFAULTS.holdMs),
      start: performance.now()
    };

    // Remove only older controller transients. Preserve legitimate legacy queue
    // entries that may have been scheduled by the existing end-of-turn flow.
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i] && q[i].__sqControllerTransient) q.splice(i, 1);
    }
    active = scene;
    start();
    return true;
  }

  function __sqDmdCancelTransientScenes(){
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i] && q[i].__sqControllerTransient) q.splice(i, 1);
    }
    if (active && active.__sqControllerTransient) nextScene();
    start();
    return true;
  }
  // <<< PATCH:SC030_DMD_TRANSIENT_CHANNEL END

  // expose
  // @CANONICAL:DMD_PUBLIC_API
  window.sqDmdShow = show;
  window.sqDmdShowZones = showZones;
  window.sqDmdShowZ1 = (t, o) => showZones({ z1: t }, o);
  window.sqDmdShowZ2 = (t, o) => showZones({ z2: t }, o);
  window.sqDmdShowZ3 = (t, o) => showZones({ z3: t }, o);
  window.__sqDmdShowTransientZones = __sqDmdShowTransientZones;
  window.__sqDmdCancelTransientScenes = __sqDmdCancelTransientScenes;
  window.__sqDmdHardClearQueue = function(){
    try{
      window.__sqDmdFlowToken = (Number(window.__sqDmdFlowToken || 0) + 1);
      window.__sqSuppressMissCallouts = false;
      if (typeof q !== 'undefined' && Array.isArray(q)) q.length = 0;
      if (typeof active !== 'undefined' && active) active.ms = 0;
      __sqDmdLastZ2 = "";
      __sqDmdLastZ3 = "";
      try{ window.sqDmdShowZones?.({ z2:'', z3:'' }, { type:'hold', ms:1 }); }catch(_){}
    }catch(_){}
  };

  window.sqDmdSetIdle = setIdle;
  window.sqDmdStop = stop;
  window.sqDmdSetPlayerMeta = setPlayerMeta;
  window.__sqDmdGetPlayerMeta = getPlayerMeta;

  // DMD reacts to player pill taps (uses Phase A meta if provided)
  document.addEventListener('click', (ev) => {
    const box = ev.target && ev.target.closest ? ev.target.closest('.v2ScoreBox') : null;
    if (!box) return;
    const initEl = box.querySelector('.v2Initial');
    const code = initEl ? initEl.textContent.trim().toUpperCase() : '';
    if (!code) return;
    const pm = getPlayerMeta(code);
    // short, punchy: nickname takes top line; full name bottom line
    showZones({ z2: `${pm.nick} UP`, z3: pm.full }, { type:'flash', ms: 900 });
  }, { passive:true });

  /* >>> PATCH:SQ_DMD_GLOBAL_BUTTON_HOOKS START */
  // Global button hooks (capture phase) so DMD reacts even if the input UI is rebuilt dynamically.
  // Hooks any element with data-act="miss|undo|skip" anywhere in the document.
  document.addEventListener('click', (ev) => {
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el) return;
    const act = (el.getAttribute('data-act') || '').toLowerCase();

    if (act === 'miss') {
      try { window.__sqDmdHardClearQueue?.(); } catch(_){}
      try { window.sqDmdShowZones?.({ z2:'MISS' },{type:'flash',ms:650}); } catch(_){}
      return;
    }
    if (act === 'undo') {
      try { window.__sqDmdHardClearQueue?.(); } catch(_){}
      try { window.sqDmdShowZones?.({ z2:'<<<<' },{type:'wipe',dir:'rev',ms:400,revealMs:120}); } catch(_){}
      return;
    }
    if (act === 'skip') {
      try { window.__sqDmdHardClearQueue?.(); } catch(_){}
      return;
    }
  }, true);
  /* <<< PATCH:SQ_DMD_GLOBAL_BUTTON_HOOKS END */

  // boot
  setIdle("");
  start();

}
__sqDmdInitV7();
// =========================================================
// @SEC:JS:LEGACY:QUARANTINE
// Legacy code quarantine zone.
// Stage 4A.1: We park legacy/unused entrypoints here before deletion.
// NOTE: No active code has been moved yet in this pass — this is a safe scaffold.
// =========================================================

(function(){
  // Single place to flag accidental legacy calls (kept silent unless DEBUG_GUARDS enabled)
  try {
    window.SQ = window.SQ || {};
    SQ.legacy = SQ.legacy || {};
    SQ.legacy.warnIfCalled = function(name){
      try{
        var dbg = (window.FLAGS && window.FLAGS.DEBUG_GUARDS) || (window.SQ && SQ.FLAGS && SQ.FLAGS.DEBUG_GUARDS);
        if (dbg) console.warn('[LEGACY] call blocked:', name);
      }catch(_){}
    };

  // >>> QUARANTINED: legacy top nav equalizer (was auto-run)
  // Enabled only if FLAGS.ENABLE_LEGACY_HOME is true.
  (function legacy_equalizeTopNav_v1(){
    if(!(window.FLAGS && FLAGS.ENABLE_LEGACY_HOME)) return;
    // 1) CSS (scoped)
    if (!document.getElementById('topNavEqStyles')){
      const s = document.createElement('style');
      s.id = 'topNavEqStyles';
      s.textContent =
  `.top-nav-eq{display:flex;gap:12px;width:100%;align-items:stretch;justify-content:space-between;flex-wrap:nowrap}
  .top-nav-eq > *{flex:1 1 0;min-width:0}
  .top-nav-eq > *:is(button,.btn,[role="button"],a){display:block;width:100%;text-align:center}`;
      document.head.appendChild(s);
    }

    // 2) Find the three buttons by their labels (keeps existing handlers intact)
    const LABELS = [/^\s*start\s*screen\s*$/i, /^\s*restart\s*game\s*$/i, /^\s*stats\s*$/i];
    function findButtons(){
      const all = Array.from(document.querySelectorAll('button,.btn,[role="button"],a'));
      return LABELS.map(rx => all.find(el => rx.test((el.textContent||'').trim()) && el.offsetParent));
    }

    // 3) Find nearest common ancestor of the three buttons
    function nearestCommonAncestor(els){
      if (els.some(e=>!e)) return null;
      const paths = els.map(el=>{
        const p=[]; let n=el;
        while(n){ p.push(n); n=n.parentElement; }
        return p;
      });
      for (const a of paths[0]){
        if (paths[1].includes(a) && paths[2].includes(a)) return a;
      }
      return null;
    }

    function apply(){
      const btns = findButtons();
      if (btns.some(b=>!b)) return; // not on this screen yet
      const root = nearestCommonAncestor(btns);
      if (!root) return;

      // Avoid double-applying
      if (!root.classList.contains('top-nav-eq')) {
        root.classList.add('top-nav-eq');
        // Make sure the row actually spans the page width
        root.style.maxWidth = 'unset';
        root.style.width    = '100%';
      }
    }

    // Run now + when DOM changes (in case the header re-renders)
    function run(){ try{ apply(); }catch(e){ console.warn('TopNav equalize failed', e); } }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
    try { window.__sqUIMutationBus?.on(()=>run()); } catch(_) {}
  })()
  // <<< QUARANTINED

  } catch(_){}
})();
