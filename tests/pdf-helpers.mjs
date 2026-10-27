import { readFile } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export const fontBytes = new Uint8Array(await readFile(new URL('../src/assets/DejaVuSans.ttf', import.meta.url)));
export const boldFontBytes = new Uint8Array(await readFile(new URL('../src/assets/DejaVuSans-Bold.ttf', import.meta.url)));
export async function extractPdfText(bytes) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  try {
    const pdf = await task.promise, pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      pages.push((await page.getTextContent()).items.map(item => item.str).join(' '));
    }
    return pages.join('\n');
  } finally { await task.destroy(); }
}
