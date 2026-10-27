const query = new URL(window.location.href).searchParams;
// A normal native window never changes storage because of a query parameter.
export const exampleMode = Boolean(window.ricamoExample) || (!window.ricamo && query.get('example') === '1');
export const exampleLanguage = query.get('language') === 'en' ? 'en' : 'it';
export const studioStorageKey = key => exampleMode ? `ricamo-example:${key}` : key;
export const browserDatabaseName = exampleMode ? 'ricamo-example-studio' : 'ricamo-studio';
export function openBrowserExample(language) {
  const url = new URL(window.location.href); url.search = ''; url.hash = '';
  url.searchParams.set('example', '1'); url.searchParams.set('language', language === 'en' ? 'en' : 'it');
  window.open(url.href, '_blank', 'noopener'); return true;
}
export function finishBrowserExample() {
  window.close();
  // A manually opened example tab may not be script-closable; the Return action still works.
  setTimeout(() => { if (!window.closed) { const url = new URL(window.location.href); url.search = ''; url.hash = ''; window.location.replace(url.href); } }, 100);
  return true;
}
export function requestExampleClose() { window.dispatchEvent(new CustomEvent('ricamo:request-close')); }
