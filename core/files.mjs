export const FILE_LIMIT = 25 * 1024 * 1024;
export const BACKUP_LIMIT = 256 * 1024 * 1024;

export class FileError extends Error { constructor(code) { super(code); this.code = code; } }
export function boundedBytes(value, limit = FILE_LIMIT) {
  if (!(value instanceof Uint8Array) && !(value instanceof ArrayBuffer)) throw new FileError('invalid_file_data');
  if (!value.byteLength || value.byteLength > limit) throw new FileError('file_too_large');
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}
export function detectFile(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > FILE_LIMIT) throw new FileError('file_too_large');
  const start = [...bytes.slice(0, 16)];
  const ascii = String.fromCharCode(...start);
  if (start.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') return 'image/png';
  if (start[0] === 255 && start[1] === 216 && start[2] === 255) return 'image/jpeg';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (/^GIF8[79]a/.test(ascii)) return 'image/gif';
  if (ascii.startsWith('%PDF-')) return 'application/pdf';
  throw new FileError('invalid_file_type');
}
export function safeDisplayName(name) {
  const result = String(name).split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g, '').slice(0, 250);
  if (!result || result === '.' || result === '..') throw new FileError('invalid_file_name');
  return result;
}
export async function digestBytes(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function base64ToBytes(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(FILE_LIMIT / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new FileError('invalid_file_data');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
