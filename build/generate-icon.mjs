import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const svg = await readFile(new URL('./icon.svg', import.meta.url), 'utf8');
const sizes = [16, 24, 32, 48, 64, 128, 256], images = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const size of sizes) {
    const png = await page.evaluate(async ({ svg, size }) => {
      const image = new Image(); image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(image, 0, 0, size, size); return canvas.toDataURL('image/png').split(',')[1];
    }, { svg, size });
    images.push(Buffer.from(png, 'base64'));
  }
} finally { await browser.close(); }
const header = Buffer.alloc(6 + images.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = header.length;
for (let index = 0; index < images.length; index++) {
  const start = 6 + index * 16, size = sizes[index]; header[start] = header[start + 1] = size === 256 ? 0 : size;
  header.writeUInt16LE(1, start + 4); header.writeUInt16LE(32, start + 6); header.writeUInt32LE(images[index].length, start + 8); header.writeUInt32LE(offset, start + 12); offset += images[index].length;
}
await writeFile(new URL('./icon.ico', import.meta.url), Buffer.concat([header, ...images]));
console.log(`Wrote icon.ico with ${sizes.join(', ')} pixel images.`);
