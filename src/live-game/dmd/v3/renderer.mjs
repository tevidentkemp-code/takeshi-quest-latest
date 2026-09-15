function pxX(value, width) { return Number(value || 0) * width; }
function pxY(value, height) { return Number(value || 0) * height; }

const processedAssetCache = new WeakMap();

function createSurface(width, height, ctx) {
  const doc = ctx.canvas && ctx.canvas.ownerDocument;
  let canvas;
  if (doc && typeof doc.createElement === 'function') canvas = doc.createElement('canvas');
  else if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(width, height);
  else return null;
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function applyTextStyle(ctx, layer, height) {
  const sizePx = Math.max(5, Number(layer.size || 0.12) * height);
  const weight = Math.max(100, Math.min(900, Number(layer.weight || 800)));
  ctx.font = `${weight} ${sizePx}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = layer.align || 'center';
  ctx.textBaseline = layer.baseline || 'middle';
  ctx.fillStyle = layer.color || '#ff8a1c';
  ctx.globalAlpha = layer.alpha == null ? 1 : Number(layer.alpha);
}

function drawTextLayer(ctx, layer, width, height) {
  const x = pxX(layer.x, width);
  const y = pxY(layer.y, height);
  const scale = Number(layer.scale == null ? 1 : layer.scale) || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  applyTextStyle(ctx, layer, height);
  ctx.fillText(String(layer.text ?? ''), 0, 0);
  ctx.restore();
}

function drawLineLayer(ctx, layer, width, height) {
  ctx.save();
  ctx.globalAlpha = layer.alpha == null ? 1 : Number(layer.alpha);
  ctx.strokeStyle = layer.color || '#ff8a1c';
  ctx.lineWidth = Math.max(1, Number(layer.width || 0.008) * height);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pxX(layer.x1, width), pxY(layer.y1, height));
  ctx.lineTo(pxX(layer.x2, width), pxY(layer.y2, height));
  ctx.stroke();
  ctx.restore();
}

function drawRingLayer(ctx, layer, width, height) {
  ctx.save();
  ctx.globalAlpha = layer.alpha == null ? 1 : Number(layer.alpha);
  ctx.strokeStyle = layer.color || '#ff8a1c';
  ctx.lineWidth = Math.max(1, Number(layer.width || 0.01) * height);
  ctx.beginPath();
  ctx.arc(pxX(layer.x, width), pxY(layer.y, height), Number(layer.radius || 0.2) * height, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCrossLayer(ctx, layer, width, height) {
  const x = pxX(layer.x, width);
  const y = pxY(layer.y, height);
  const radius = Number(layer.size || 0.2) * height * 0.5;
  ctx.save();
  ctx.globalAlpha = layer.alpha == null ? 1 : Number(layer.alpha);
  ctx.strokeStyle = layer.color || '#ff5a4f';
  ctx.lineWidth = Math.max(1, Number(layer.width || 0.018) * height);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - radius, y - radius);
  ctx.lineTo(x + radius, y + radius);
  ctx.moveTo(x + radius, y - radius);
  ctx.lineTo(x - radius, y + radius);
  ctx.stroke();
  ctx.restore();
}

function drawCover(ctx, image, width, height, scale = 1, offsetX = 0, offsetY = 0) {
  const iw = Number(image.naturalWidth || image.videoWidth || image.width || 0);
  const ih = Number(image.naturalHeight || image.videoHeight || image.height || 0);
  if (!iw || !ih) return false;
  const base = Math.max(width / iw, height / ih) * Number(scale || 1);
  const dw = iw * base;
  const dh = ih * base;
  const dx = (width - dw) / 2 + Number(offsetX || 0) * width;
  const dy = (height - dh) / 2 + Number(offsetY || 0) * height;
  ctx.drawImage(image, dx, dy, dw, dh);
  return true;
}

function processedAssetFor(ctx, image, tint) {
  let byTint = processedAssetCache.get(image);
  if (!byTint) {
    byTint = new Map();
    processedAssetCache.set(image, byTint);
  }
  const key = String(tint || '#ff8a1c');
  if (byTint.has(key)) return byTint.get(key);

  const iw = Number(image.naturalWidth || image.videoWidth || image.width || 0);
  const ih = Number(image.naturalHeight || image.videoHeight || image.height || 0);
  if (!iw || !ih) return image;
  const surface = createSurface(iw, ih, ctx);
  if (!surface) return image;
  const sctx = surface.getContext('2d', { alpha: true });
  sctx.clearRect(0, 0, iw, ih);
  sctx.save();
  sctx.imageSmoothingEnabled = true;
  if ('filter' in sctx) sctx.filter = 'grayscale(1) contrast(1.45) brightness(.72)';
  sctx.drawImage(image, 0, 0, iw, ih);
  sctx.restore();
  sctx.save();
  sctx.globalCompositeOperation = 'source-atop';
  sctx.globalAlpha = 0.62;
  sctx.fillStyle = key;
  sctx.fillRect(0, 0, iw, ih);
  sctx.restore();
  byTint.set(key, surface);
  return surface;
}

function drawImageLayer(ctx, layer, width, height, assets) {
  const image = assets && assets[layer.assetKey];
  if (!image || !(image.complete || image.width) || !(image.naturalWidth || image.width)) return;
  const source = layer.monochrome === false ? image : processedAssetFor(ctx, image, layer.tint);
  ctx.save();
  ctx.globalAlpha = layer.alpha == null ? 1 : Number(layer.alpha);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  drawCover(ctx, source, width, height, layer.scale, layer.offsetX, layer.offsetY);
  ctx.restore();
}

export function renderLogicalFrame(ctx, frame, options = {}) {
  if (!ctx || !ctx.canvas) throw new Error('DMD V3 logical renderer requires a 2D canvas context');
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const assets = options.assets || {};

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  for (const layer of frame.layers || []) {
    if (!layer || Number(layer.alpha) <= 0) continue;
    switch (layer.kind) {
      case 'text':
      case 'number':
        drawTextLayer(ctx, layer, width, height);
        break;
      case 'line':
        drawLineLayer(ctx, layer, width, height);
        break;
      case 'ring':
        drawRingLayer(ctx, layer, width, height);
        break;
      case 'cross':
        drawCrossLayer(ctx, layer, width, height);
        break;
      case 'image':
        drawImageLayer(ctx, layer, width, height, assets);
        break;
      default:
        break;
    }
  }

  return ctx.canvas;
}

