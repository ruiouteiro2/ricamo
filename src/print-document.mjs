/** Print complete PDF pages, independently of the visible editor/reader viewport. */
export const PRINT_DOCUMENT_LIMITS = Object.freeze({ bytes: 64 * 1024 * 1024, pages: 200, pixels: 128_000_000, edge: 6000, minimumDpi: 96, preferredDpi: 144 });
const LIMITS = PRINT_DOCUMENT_LIMITS;
const failure = code => Object.assign(new Error(code), { code });
let printing = false;

/** PDF points are physical units (72 per inch), never CSS/device pixels. */
export function documentPrintPlan(pages) {
  if (!Array.isArray(pages) || !pages.length || pages.length > LIMITS.pages) throw failure('print_document_limit');
  const dimensions = pages.map(page => {
    const { width, height } = page ?? {};
    if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw failure('print_document_invalid');
    return { width, height };
  });
  const pixelCount = scale => dimensions.reduce((sum,row) => sum + Math.ceil(row.width * scale) * Math.ceil(row.height * scale), 0);
  let lower = LIMITS.minimumDpi / 72;
  let upper = Math.min(LIMITS.preferredDpi / 72, ...dimensions.map(row => LIMITS.edge / Math.max(row.width,row.height)));
  if (upper < lower || pixelCount(lower) > LIMITS.pixels) throw failure('print_document_limit');
  if (pixelCount(upper) > LIMITS.pixels) {
    // A common resolution keeps every page consistent, while bounding retained images.
    for (let iteration = 0; iteration < 32; iteration++) {
      const middle = (lower + upper) / 2;
      if (pixelCount(middle) > LIMITS.pixels) upper = middle; else lower = middle;
    }
    upper = lower;
  }
  return dimensions.map(({ width,height }) => ({
    widthMm: width * 25.4 / 72, heightMm: height * 25.4 / 72,
    canvasWidth: Math.ceil(width * upper), canvasHeight: Math.ceil(height * upper), scale: upper,
  }));
}

/** Apply grayscale to pixels so preview, PDF bytes and native print agree. */
export function grayscaleCanvas(canvas) {
  const context = canvas.getContext('2d'), pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = Math.round(pixels.data[index] * .2126 + pixels.data[index + 1] * .7152 + pixels.data[index + 2] * .0722);
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = gray;
  }
  context.putImageData(pixels, 0, 0);
}

export async function printPdfDocument(data, { onProgress, signal, monochrome = false } = {}) {
  if (printing) throw failure('print_document_busy');
  if (!(data instanceof Uint8Array) || !data.length || data.length > LIMITS.bytes) throw failure('print_document_limit');
  if (signal?.aborted) return false;
  printing = true;
  let loadingTask, renderTask, surface, styles;
  const urls = [];
  const cancel = () => { renderTask?.cancel(); loadingTask?.destroy().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const [{ getDocument, GlobalWorkerOptions, AnnotationMode }, { default: workerUrl }, { storage }] = await Promise.all([
      import('pdfjs-dist/build/pdf.mjs'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'), import('./storage.js'),
    ]);
    GlobalWorkerOptions.workerSrc = workerUrl;
    const assets = new URL('pdfjs/', document.baseURI).href;
    loadingTask = getDocument({ data: data.slice(), cMapUrl: `${assets}cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/`,
      useWorkerFetch: true, useSystemFonts: false, disableFontFace: true, isEvalSupported: false,
      enableXfa: false, disableAutoFetch: true, disableRange: true, disableStream: true,
      maxImageSize: 40_000_000, canvasMaxAreaInBytes: 32_000_000, enableHWA: false, verbosity: 0 });
    const pdf = await loadingTask.promise;
    if (pdf.numPages > LIMITS.pages) throw failure('print_document_limit');
    const dimensions = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      if (signal?.aborted) return false;
      const page = await pdf.getPage(number);
      dimensions.push(page.getViewport({ scale: 1 }));
    }
    const plan = documentPrintPlan(dimensions);
    surface = document.createElement('div'); surface.id = 'ricamo-print-document'; surface.setAttribute('aria-hidden', 'true');
    styles = document.createElement('style');
    styles.textContent = plan.map((row,index) => `@page ricamo-document-${index}{size:${row.widthMm}mm ${row.heightMm}mm;margin:0}`).join('\n');
    document.head.append(styles); document.body.append(surface);
    for (const [index, row] of plan.entries()) {
      if (signal?.aborted) return false;
      const page = await pdf.getPage(index + 1), canvas = document.createElement('canvas');
      canvas.width = row.canvasWidth; canvas.height = row.canvasHeight;
      try {
        renderTask = page.render({ canvas, viewport: page.getViewport({ scale: row.scale }), intent: 'print', annotationMode: AnnotationMode.ENABLE });
        await renderTask.promise; renderTask = null;
        if (signal?.aborted) return false;
        if (monochrome) grayscaleCanvas(canvas);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw failure('print_document_invalid');
        const url = URL.createObjectURL(blob); urls.push(url);
        const image = document.createElement('img'); image.alt = ''; image.src = url;
        const sheet = document.createElement('section'); sheet.className = 'ricamo-print-page';
        sheet.style.page = `ricamo-document-${index}`;
        sheet.style.width = `${row.widthMm}mm`; sheet.style.height = `${row.heightMm}mm`;
        sheet.append(image); surface.append(sheet); await image.decode();
        onProgress?.({ page: index + 1, total: plan.length });
      } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
    }
    if (signal?.aborted) return false;
    document.body.classList.add('printing-document');
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (signal?.aborted) return false;
    return await storage.print();
  } catch (error) {
    if (signal?.aborted || error?.code === 'print_cancelled') return false;
    if (error?.code) throw error;
    throw failure('print_document_invalid');
  } finally {
    signal?.removeEventListener('abort', cancel);
    document.body.classList.remove('printing-document');
    surface?.remove(); styles?.remove();
    for (const url of urls) URL.revokeObjectURL(url);
    try { await loadingTask?.destroy(); } catch { /* Preserve the print result after releasing the surface. */ } finally { printing = false; }
  }
}
