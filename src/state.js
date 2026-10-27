import { shallowRef, ref } from 'vue';
import { storage } from './storage';
import { createState } from '../core/application.mjs';
import { boundedBytes, detectFile } from '../core/files.mjs';
import { language, t, errorText } from './i18n';

export const state = shallowRef(createState());
export const ready = ref(false);
export const loadingError = ref(null);
export const saving = ref(false);
export const toast = ref('');
export const route = ref({ page: 'home', id: null });
let toastTimer, queue = Promise.resolve();
export function notify(message = t('success')) { toast.value = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.value = ''; }, 4000); }
export function navigate(page, id = null) {
  const event = new CustomEvent('ricamo:before-navigate', { cancelable: true, detail: { page, id } });
  if (!window.dispatchEvent(event)) return;
  route.value = { page, id }; window.scrollTo({ top: 0 });
}
function adopt(next) { state.value = next; language.value = next.settings.language; document.documentElement.lang = language.value; return next; }
export async function initialise() {
  try { adopt(await storage.load()); ready.value = true; loadingError.value = null; }
  catch (error) { loadingError.value = errorText(error); }
}
export function dispatch(type, payload = {}, operationId = crypto.randomUUID()) {
  const command = { type, payload: JSON.parse(JSON.stringify(payload)), operationId };
  const operation = async () => {
    saving.value = true;
    try { return adopt(await storage.command(command, state.value.revision)); }
    catch (error) { if (error.code === 'stale_revision') adopt(await storage.load()); throw error; }
    finally { saving.value = false; }
  };
  const result = queue.then(operation, operation);
  queue = result.catch(() => {});
  return result;
}
export async function changeLanguage(value) { await dispatch('settings.save', { language: value }); }
export async function importAsset(file) {
  if (file.size > 25 * 1024 * 1024) throw Object.assign(new Error(), { code: 'file_too_large' });
  const data = new Uint8Array(await file.arrayBuffer());
  const operation = async () => {
    saving.value = true;
    try {
      const result = await storage.importAsset({ name: file.name, data, operationId: crypto.randomUUID() }, state.value.revision);
      adopt(result.state); return result.asset;
    } finally { saving.value = false; }
  };
  const result = queue.then(operation, operation); queue = result.catch(() => {}); return result;
}
const urls = new Map();
export async function assetUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const metadata = state.value.attachments.find(row => row.id === id);
  if (!metadata) throw Object.assign(new Error(), { code: 'file_not_found' });
  const data = await storage.getAsset(id);
  if (detectFile(boundedBytes(data)) !== metadata.mime) throw Object.assign(new Error(), { code: 'invalid_file_type' });
  const url = URL.createObjectURL(new Blob([data], { type: metadata.mime })); urls.set(id, url); return url;
}
export async function restoreBackup(token) {
  const next = await storage.restore(token, state.value.revision);
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear(); adopt(next); navigate('home'); notify();
}
export function normalize(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function locate(id) {
  const names = [], seen = new Set(); let current = id;
  while (current && !seen.has(current)) { seen.add(current); const row = state.value.locations.find(item => item.id === current); if (!row) break; names.unshift(row.name); current = row.parentId; }
  return names.join(' / ') || '—';
}
export const categories = ['thread', 'fabric', 'tool', 'storage', 'preparation', 'stabilizer', 'embellishment', 'finishing', 'kit', 'reference', 'other'];
export const units = ['m', 'strand-m', 'cm', 'mm', 'g', 'kg', 'piece', 'skein', 'spool', 'pack', 'm2', 'custom'];
export function statusText(value) { return t(({ preparing: 'preparationStatus', active: 'in_progress', partial: 'partially_received' })[value] || value); }
