// Run after acquire-casa-profilo.py: Casa Cenina shows each Profilo colour as a small
// rectangle on a large blank square, so keep only the rectangle's centre as the swatch.
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { chromium } = require('@playwright/test');

const file = join(__dirname, '..', 'src', 'assets', 'profilo-previews.json');
const crop = async source => {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = width, right = -1, top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4;
    if (Math.abs(data[at] - data[0]) + Math.abs(data[at + 1] - data[1]) + Math.abs(data[at + 2] - data[2]) > 24) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  // A thread as pale as the background has no visible edge: use the usual central area.
  const found = right >= 0 && right - left >= 20 && bottom - top >= 20;
  const size = found ? Math.min(right - left, bottom - top) - 4 : 46;
  const centreX = found ? (left + right + 1) / 2 : width / 2, centreY = found ? (top + bottom + 1) / 2 : height / 2;
  const output = document.createElement('canvas');
  output.width = output.height = size;
  output.getContext('2d').drawImage(image, centreX - size / 2, centreY - size / 2, size, size, 0, 0, size, size);
  return { width, height, found, size, swatch: output.toDataURL('image/png') };
};

(async () => {
  const previews = JSON.parse(readFileSync(file, 'utf8'));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const results = await page.evaluate(async ([images, body]) => {
      const run = eval(body), output = {};
      for (const [digest, source] of Object.entries(images)) output[digest] = await run(source);
      return output;
    }, [previews.images, `(${crop})`]);
    const rows = Object.values(results);
    for (const [digest, row] of Object.entries(results)) previews.images[digest] = row.swatch;
    writeFileSync(file, `${JSON.stringify(previews)}\n`);
    console.log(JSON.stringify({ images: rows.length, edgeFound: rows.filter(row => row.found).length, pale: rows.filter(row => !row.found).length, sizes: [...new Set(rows.map(row => `${row.width}x${row.height}`))], swatchSizes: [...new Set(rows.map(row => row.size))].slice(0, 8), bytes: Object.values(previews.images).reduce((sum, value) => sum + value.length, 0) }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
