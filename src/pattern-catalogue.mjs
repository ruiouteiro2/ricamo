import previews from './assets/chart-previews.json';
export function chartPreview(item) { return previews[item.previewFile] || ''; }
