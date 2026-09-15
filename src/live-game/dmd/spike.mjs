import { Application, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';

// SC-032 renderer spike: a single presentation owner for three proof scenes.
// Gameplay and state remain outside this module.
export const SPIKE_SCENES = Object.freeze({ PLAYER_UP: 'PLAYER_UP', HIT_TREBLE: 'TREBLE', DESMOND_DELIGHT: 'DESMOND' });

class Stage extends Container {}
class Actor extends Container {}
class Action {
  constructor(run, duration = 0) { this.run = run; this.duration = duration; }
}
class Sequence {
  constructor(actions) { this.actions = actions; }
  duration() { return this.actions.reduce((sum, action) => sum + action.duration, 0); }
  run(t) { let left = t; for (const action of this.actions) { if (left <= action.duration) return action.run(left, action.duration); left -= action.duration; } }
}
class Parallel {
  constructor(actions) { this.actions = actions; }
  duration() { return Math.max(0, ...this.actions.map(action => action.duration)); }
  run(t) { this.actions.forEach(action => action.run(Math.min(t, action.duration), action.duration)); }
}

const sceneOf = kind => ({ PLAYER_UP: 'PLAYER_UP', TARGET: 'PLAYER_UP', HIT_TREBLE: 'TREBLE', DESMOND_DELIGHT: 'DESMOND' })[kind] || null;

function text(value, size, color = 0xfff8e8) {
  return new Text({ text: String(value || ''), style: new TextStyle({ fontFamily: 'Arial, sans-serif', fontSize: size, fontWeight: '900', fill: color, align: 'center' }) });
}

function fit(node, x, y, scale = 1) { node.anchor?.set?.(0.5); node.x = x; node.y = y; node.scale.set(scale); return node; }

export async function createRendererSpike({ canvas, host = globalThis, visibleCanvas = canvas, reducedMotion = () => false }) {
  const dpr = Math.max(1, Math.min(3, Number(host.devicePixelRatio) || 1));
  const pixiCanvas = host.document?.createElement('canvas');
  pixiCanvas.width = 640 * dpr; pixiCanvas.height = 160 * dpr; pixiCanvas.style.display = 'none';
  const app = new Application();
  await app.init({ canvas: pixiCanvas, preference: 'webgl', antialias: false, autoDensity: true, resolution: dpr, backgroundAlpha: 0, width: 640, height: 160 });
  const visibleCtx = visibleCanvas.getContext('2d');
  const diagnostics = { renderer: 'PIXI WEBGL', initialized: true, rendered: false, composited: false, v2WritesDuringPixi: 0, error: '' };
  const stage = new Stage(); app.stage.addChild(stage);
  let active = null; let raf = null; let generation = 0;
  const background = new Graphics().rect(0, 0, 640, 160).fill(0x160d06);
  stage.addChild(background);
  const dotFilter = { dotSize: 1, roundness: 0.92, sharpness: 0.9, brightness: 1.15, directGlow: 0.18, backgroundGlow: 0.08, gamma: 1, tint: 0xffa33a, unlit: 0x20170f, scanline: 0.04 };

  function composite() { visibleCtx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height); visibleCtx.drawImage(pixiCanvas, 0, 0, visibleCanvas.width, visibleCanvas.height); diagnostics.composited = true; }
  function clear() { stage.removeChildren(); stage.addChild(background); }
  function finish(token) { if (active?.token === token) { active = null; raf = null; } }
  function play(kind, data = {}) {
    const scene = sceneOf(kind); if (!scene) return false;
    generation += 1; const token = generation; if (raf != null) host.cancelAnimationFrame(raf); clear();
    const root = new Actor(); stage.addChild(root);
    let timeline;
    if (scene === 'PLAYER_UP') {
      const name = fit(text(`${data.player || 'PLAYER'} UP`, 42), 320, 58);
      const target = fit(text(`TARGET ${data.target || ''}`, 22, 0xffd58a), 320, 121);
      root.addChild(name, target);
      timeline = new Parallel([new Action((t) => { const a = reducedMotion() ? 1 : Math.min(1, t / 180); name.alpha = a; target.alpha = a; }, 900)]);
    } else if (scene === 'TREBLE') {
      const score = fit(text(data.points ?? '', 78), 320, 67);
      const label = fit(text(`TREBLE${data.target ? ` ${data.target}` : ''}`, 23, 0xffd58a), 320, 119);
      const total = fit(text(data.total == null ? '' : `TOTAL ${data.total}`, 17, 0xffffcf), 320, 148);
      const ring = new Graphics().circle(320, 68, 46).stroke({ color: 0xff9d2e, width: 3, alpha: 0.65 });
      root.addChild(ring, score, label, total);
      timeline = new Parallel([new Action((t) => { const s = reducedMotion() ? 1 : 0.96 + Math.min(0.08, t / 1800); score.scale.set(s); ring.alpha = reducedMotion() ? 0.45 : 0.25 + Math.min(0.5, t / 500); }, 900)]);
    } else {
      const title = fit(text('DESMOND DELIGHT', 32), 320, 50);
      const special = host.__sqDmdSpecialAssets?.desmond;
      const art = special?.complete ? Sprite.from(special) : new Graphics().roundRect(220, 72, 200, 62, 10).fill(0x7d3f16).stroke({ color: 0xffd58a, width: 3 });
      if (special?.complete) { art.anchor.set(0.5); art.x = 320; art.y = 103; art.width = 200; art.height = 62; }
      const sub = fit(text('COMBO COMPLETE', 18, 0xffd58a), 320, 105);
      root.addChild(art, title, sub);
      timeline = new Sequence([new Action((t) => { title.alpha = Math.min(1, t / 180); }, 180), new Action((t) => { art.alpha = 0.65 + 0.35 * Math.abs(Math.sin(t / 90)); }, 520), new Action((t) => { sub.alpha = Math.min(1, t / 180); }, 180)]);
    }
    active = { token, scene, timeline, started: host.performance.now() };
    const tick = now => { if (!active || active.token !== token) return; const elapsed = now - active.started; timeline.run(elapsed); app.renderer.render(stage); diagnostics.rendered = true; composite(); if (elapsed < timeline.duration()) raf = host.requestAnimationFrame(tick); else finish(token); };
    raf = host.requestAnimationFrame(tick); return true;
  }
  function cancel() { generation += 1; if (raf != null) host.cancelAnimationFrame(raf); raf = null; active = null; clear(); app.renderer.render(stage); composite(); }
  return { app, stage, pixiCanvas, dotFilter, diagnostics, play, cancel, get active() { return active ? { scene: active.scene } : null; }, destroy() { cancel(); app.destroy(true); } };
}

export { Stage, Actor, Action, Sequence, Parallel, sceneOf };
