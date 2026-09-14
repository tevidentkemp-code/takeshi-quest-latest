function createSurface(width, height, outputCanvas) {
  const doc = outputCanvas && outputCanvas.ownerDocument;
  let canvas;
  if (doc && typeof doc.createElement === 'function') canvas = doc.createElement('canvas');
  else if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(width, height);
  else throw new Error('No canvas surface available');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function buildDotMask(mask, dotColumns, dotRows) {
  const width = mask.width;
  const height = mask.height;
  const ctx = mask.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, width, height);

  const pitchX = width / dotColumns;
  const pitchY = height / dotRows;
  const tileW = Math.max(2, Math.ceil(pitchX));
  const tileH = Math.max(2, Math.ceil(pitchY));
  const tile = createSurface(tileW, tileH, mask);
  const tctx = tile.getContext('2d', { alpha: true });
  const cx = tileW / 2;
  const cy = tileH / 2;
  const radius = Math.max(0.75, Math.min(tileW, tileH) * 0.39);
  const softEdge = Math.max(0.35, radius * 0.24);
  const gradient = tctx.createRadialGradient(cx, cy, Math.max(0.1, radius - softEdge), cx, cy, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.76, 'rgba(255,255,255,.96)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  tctx.fillStyle = gradient;
  tctx.beginPath();
  tctx.arc(cx, cy, radius, 0, Math.PI * 2);
  tctx.fill();

  for (let y = 0; y < dotRows; y += 1) {
    const py = y * pitchY;
    for (let x = 0; x < dotColumns; x += 1) {
      ctx.drawImage(tile, x * pitchX, py, pitchX, pitchY);
    }
  }
}

function drawGlass(ctx, width, height) {
  ctx.save();
  const sheen = ctx.createLinearGradient(0, 0, 0, height);
  sheen.addColorStop(0, 'rgba(255,255,255,.055)');
  sheen.addColorStop(0.20, 'rgba(255,255,255,.014)');
  sheen.addColorStop(0.62, 'rgba(0,0,0,.02)');
  sheen.addColorStop(1, 'rgba(0,0,0,.16)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.045;
  ctx.fillStyle = '#000';
  for (let y = 1; y < height; y += 4) ctx.fillRect(0, y, width, 1);
  ctx.restore();
}

export function createDmdTreatment(outputCanvas, profile, options = {}) {
  if (!outputCanvas || typeof outputCanvas.getContext !== 'function') {
    throw new Error('DMD V3 treatment requires an output canvas');
  }
  const width = Number(options.outputWidth || outputCanvas.width || 640);
  const height = Number(options.outputHeight || outputCanvas.height || 160);
  outputCanvas.width = width;
  outputCanvas.height = height;

  const dotColumns = Number(profile.dotColumns);
  const dotRows = Number(profile.dotRows);
  if (!dotColumns || !dotRows) throw new Error('DMD V3 treatment requires dot-grid dimensions');

  const stage = createSurface(width, height, outputCanvas);
  const mask = createSurface(width, height, outputCanvas);
  const masked = createSurface(width, height, outputCanvas);
  buildDotMask(mask, dotColumns, dotRows);

  const stageCtx = stage.getContext('2d', { alpha: true });
  const maskedCtx = masked.getContext('2d', { alpha: true });
  const out = outputCanvas.getContext('2d', { alpha: false });

  function render(logicalCanvas, renderOptions = {}) {
    stageCtx.save();
    stageCtx.setTransform(1, 0, 0, 1, 0, 0);
    stageCtx.clearRect(0, 0, width, height);
    stageCtx.imageSmoothingEnabled = true;
    stageCtx.imageSmoothingQuality = 'high';
    stageCtx.drawImage(logicalCanvas, 0, 0, width, height);
    stageCtx.restore();

    maskedCtx.save();
    maskedCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskedCtx.clearRect(0, 0, width, height);
    maskedCtx.globalCompositeOperation = 'source-over';
    maskedCtx.drawImage(stage, 0, 0);
    maskedCtx.globalCompositeOperation = 'destination-in';
    maskedCtx.drawImage(mask, 0, 0);
    maskedCtx.restore();

    out.save();
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.fillStyle = '#020202';
    out.fillRect(0, 0, width, height);

    const intensity = Math.max(0.55, Math.min(1.2, Number(renderOptions.intensity || 1)));
    out.globalAlpha = 0.24 * intensity;
    if ('filter' in out) out.filter = `blur(${Math.max(2, width / 220)}px)`;
    out.drawImage(masked, 0, 0);
    if ('filter' in out) out.filter = 'none';

    out.globalAlpha = Math.min(1, 0.94 * intensity);
    out.drawImage(masked, 0, 0);
    out.globalAlpha = 1;
    drawGlass(out, width, height);
    out.restore();
    return outputCanvas;
  }

  return {
    profile,
    outputCanvas,
    render,
    snapshotMeta() {
      return { width, height, dotColumns, dotRows, logicalWidth: profile.width, logicalHeight: profile.height };
    },
  };
}
