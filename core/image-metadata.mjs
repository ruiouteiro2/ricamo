/** Bounded container preflight before a browser allocates decoded image pixels.
 * This does not replace the image decoder or certify compressed pixel data. */
export const IMAGE_LIMITS = Object.freeze({ pixels: 40_000_000, dimension: 20000, frames: 200, animationPixels: 100_000_000 });
const invalid = (code = 'invalid_image') => { throw Object.assign(new Error(code), { code }); };
const label = (bytes, at, length) => String.fromCharCode(...bytes.subarray(at, at + length));
function dimensions(width, height, frames = 1) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) invalid();
  if (width > IMAGE_LIMITS.dimension || height > IMAGE_LIMITS.dimension || width * height > IMAGE_LIMITS.pixels) invalid('image_dimensions_too_large');
  if (!Number.isInteger(frames) || frames < 1) invalid();
  if (frames > IMAGE_LIMITS.frames || frames > 1 && width * height * frames > IMAGE_LIMITS.animationPixels) invalid('image_animation_too_large');
  return { width, height, frames };
}
export function inspectImage(bytes, mime) {
  if (!(bytes instanceof Uint8Array)) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bound = (at, size, end = bytes.length) => { if (at < 0 || size < 0 || at + size > end) invalid(); };
  const u16 = (at, little = false) => { bound(at, 2); return view.getUint16(at, little); };
  const u32 = (at, little = false) => { bound(at, 4); return view.getUint32(at, little); };
  const u24 = at => { bound(at, 3); return bytes[at] + bytes[at + 1] * 256 + bytes[at + 2] * 65536; };
  if (mime === 'image/png') {
    bound(0, 33);
    if (u32(8) !== 13 || label(bytes, 12, 4) !== 'IHDR') invalid();
    const width = u32(16), height = u32(20); dimensions(width, height);
    const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
    if (!depths[bytes[25]]?.includes(bytes[24]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) invalid();
    let cursor = 8, pixels = 0, frames = 1, animation = false;
    while (cursor < bytes.length) {
      bound(cursor, 12); const size = u32(cursor), kind = label(bytes, cursor + 4, 4); bound(cursor + 12, size);
      if (kind === 'IHDR' && cursor !== 8) invalid();
      if (kind === 'IDAT') pixels += size;
      if (kind === 'acTL') { if (animation || size !== 8 || pixels) invalid(); animation = true; frames = u32(cursor + 8); dimensions(width, height, frames); }
      if (kind === 'fcTL') {
        if (!animation || size !== 26) invalid();
        const w = u32(cursor + 12), h = u32(cursor + 16), x = u32(cursor + 20), y = u32(cursor + 24);
        dimensions(w, h); if (x + w > width || y + h > height) invalid();
      }
      cursor += size + 12;
      if (kind === 'IEND') { if (size || !pixels || cursor !== bytes.length) invalid(); return dimensions(width, height, frames); }
    }
    invalid();
  }
  if (mime === 'image/jpeg') {
    let cursor = 2, result;
    while (cursor < bytes.length) {
      if (bytes[cursor++] !== 255) invalid();
      while (bytes[cursor] === 255) cursor++;
      bound(cursor, 1); const marker = bytes[cursor++];
      if (marker === 0 || marker === 216 || marker === 217) invalid();
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      const size = u16(cursor); if (size < 2) invalid(); bound(cursor, size);
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (size < 8 || size !== 8 + bytes[cursor + 7] * 3) invalid();
        const next = dimensions(u16(cursor + 5), u16(cursor + 3));
        if (result && (result.width !== next.width || result.height !== next.height)) invalid(); result = next;
      }
      if (marker === 218) { if (!result || size < 6 || cursor + size >= bytes.length) invalid(); return result; }
      cursor += size;
    }
    invalid();
  }
  if (mime === 'image/gif') {
    bound(0, 13); const width = u16(6, true), height = u16(8, true); dimensions(width, height);
    let cursor = 13 + (bytes[10] & 128 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0), frames = 0;
    bound(cursor, 0);
    function blocks() { let total = 0; while (true) { bound(cursor, 1); const size = bytes[cursor++]; if (!size) return total; bound(cursor, size); cursor += size; total += size; } }
    while (cursor < bytes.length) {
      const tag = bytes[cursor++];
      if (tag === 59) { if (!frames || cursor !== bytes.length) invalid(); return dimensions(width, height, frames); }
      if (tag === 33) { bound(cursor, 1); cursor++; blocks(); continue; }
      if (tag !== 44) invalid();
      bound(cursor, 9); const x = u16(cursor, true), y = u16(cursor + 2, true), w = u16(cursor + 4, true), h = u16(cursor + 6, true), flags = bytes[cursor + 8];
      dimensions(w, h); if (x + w > width || y + h > height) invalid();
      cursor += 9 + (flags & 128 ? 3 * 2 ** ((flags & 7) + 1) : 0); bound(cursor, 1);
      const codeSize = bytes[cursor++]; if (codeSize < 2 || codeSize > 8 || !blocks()) invalid();
      dimensions(width, height, ++frames);
    }
    invalid();
  }
  if (mime === 'image/webp') {
    bound(0, 20); if (u32(4, true) + 8 !== bytes.length) invalid();
    let cursor = 12, canvas, raster, frames = 0, animated = false, animationHeader = false;
    function rasterDimensions(kind, at, size) {
      if (kind === 'VP8 ') {
        if (size < 10 || label(bytes, at + 3, 3) !== '\x9d\x01\x2a') invalid();
        return dimensions(u16(at + 6, true) & 16383, u16(at + 8, true) & 16383);
      }
      if (kind === 'VP8L') {
        if (size < 5 || bytes[at] !== 47) invalid(); const bits = u32(at + 1, true);
        if (bits >>> 29) invalid(); return dimensions((bits & 16383) + 1, ((bits >>> 14) & 16383) + 1);
      }
    }
    while (cursor < bytes.length) {
      bound(cursor, 8); const kind = label(bytes, cursor, 4), size = u32(cursor + 4, true), at = cursor + 8; bound(at, size + (size & 1));
      if (kind === 'VP8X') {
        if (canvas || cursor !== 12 || size !== 10) invalid(); canvas = dimensions(u24(at + 4) + 1, u24(at + 7) + 1); animated = Boolean(bytes[at] & 2);
      } else if (kind === 'ANIM') { if (!animated || size !== 6 || animationHeader) invalid(); animationHeader = true; }
      else if (kind === 'ANMF') {
        if (!animated || !animationHeader || size < 24) invalid();
        const w = u24(at + 6) + 1, h = u24(at + 9) + 1; dimensions(w, h);
        if (u24(at) * 2 + w > canvas.width || u24(at + 3) * 2 + h > canvas.height) invalid();
        let frameRaster, inner = at + 16;
        while (inner < at + size) {
          bound(inner, 8, at + size); const subSize = u32(inner + 4, true); bound(inner + 8, subSize + (subSize & 1), at + size);
          const candidate = rasterDimensions(label(bytes, inner, 4), inner + 8, subSize);
          if (candidate) { if (frameRaster) invalid(); frameRaster = candidate; } inner += 8 + subSize + (subSize & 1);
        }
        if (!frameRaster || frameRaster.width !== w || frameRaster.height !== h) invalid(); dimensions(canvas.width, canvas.height, ++frames);
      } else {
        const candidate = rasterDimensions(kind, at, size); if (candidate) { if (raster || animated) invalid(); raster = candidate; }
      }
      cursor = at + size + (size & 1);
    }
    if (animated) { if (!frames) invalid(); return dimensions(canvas.width, canvas.height, frames); }
    if (!raster || canvas && (canvas.width !== raster.width || canvas.height !== raster.height)) invalid(); return raster;
  }
  invalid('invalid_file_type');
}
