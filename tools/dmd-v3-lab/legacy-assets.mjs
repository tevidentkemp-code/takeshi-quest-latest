const ASSET_CONSTANTS = Object.freeze({
  lastDart: '__SQ_LASTDART_SRC',
  desmond: '__SQ_DESMOND_SRC',
  voldy: '__SQ_VOLDY_SRC',
});

function extractConstant(source, constantName) {
  const escaped = constantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(source).match(new RegExp(`const\\s+${escaped}\\s*=\\s*(['\"])(data:image\\/[^'\"]+)\\1`));
  return match ? match[2] : null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode DMD artwork'));
    image.src = src;
  });
}

export async function loadLegacyDmdAssets(sourceUrl = '/src/legacy/scripts/inline-007.js') {
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to fetch legacy DMD source (${response.status})`);
  const source = await response.text();
  const entries = await Promise.all(Object.entries(ASSET_CONSTANTS).map(async ([key, constantName]) => {
    const src = extractConstant(source, constantName);
    if (!src) throw new Error(`Missing ${constantName} in legacy DMD source`);
    return [key, await loadImage(src)];
  }));
  return Object.fromEntries(entries);
}
