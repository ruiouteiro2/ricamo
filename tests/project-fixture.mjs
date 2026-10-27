import { randomUUID } from 'node:crypto';
import { Repository } from '../desktop/repository.mjs';
import { createBlank } from '../core/pattern.mjs';
import { makeBlendColor } from '../core/thread-recipes.mjs';
import { previewProjectImport } from '../core/project-package.mjs';

export const command = (repo, type, payload) => repo.execute({ type, payload, operationId: randomUUID() }, repo.load().revision);
export const decisions = (repo, prepared) => ({ name: 'Imported blend', resetProgress: false, allowRepeat: false, materials: previewProjectImport(repo.load(), prepared).materials.map(row => ({ sourceId: row.sourceId, action: 'create', reviewed: true })) });
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64'));
export function projectPackageFixture() {
  const repo = new Repository(':memory:');
  const components = [
    { itemId: 'a', brand: 'DMC', range: 'Mouliné', code: '001', name: 'Cotone à mão', hex: '#ff0000', strands: 1 },
    { itemId: 'b', brand: 'DMC', range: 'Mouliné', code: '002', name: 'Blue', hex: '#0000ff', strands: 2 },
  ];
  for (const color of components) command(repo, 'material.save', { ...color, id: color.itemId, category: 'thread', unit: 'm', strands: 6, divisible: true });
  const asset = repo.importAsset({ name: 'original.png', data: png, operationId: randomUUID() }, repo.load().revision).asset;
  const revision = createBlank(2, 1, [makeBlendColor({ code: 'MIX', name: 'Mixed threads', symbol: 'Ω', components, backComponents: [{ ...components[0], strands: 1 }] })], { id: 'r1' });
  revision.cells = [0, 0]; revision.backstitches = [{ id: 'b1', x1: 0, y1: 0, x2: 1, y2: 1, color: 0 }];
  revision.settings = { width: 2, height: 1, count: 14, strands: 3, maxColors: 2, mode: 'detail', region: 1, waste: 20, ownerNotes: 'PRIVATE_SETTINGS', protectedRegions: [{ x: 0, y: 0, width: 1, height: 1, notes: 'PRIVATE_REGION' }] };
  revision.provenance = { name: 'Stitch Studio', version: '0.1.0+ricamo.2', adapterVersion: 2, originalSha256: 'a'.repeat(64), algorithm: 'weighted-CIELAB-kmeans-CIE76', iterations: 8, parameters: structuredClone(revision.settings), palette: { brand: 'DMC', source: 'user-inventory', approximate: true, notes: 'PRIVATE_PALETTE', colors: components.map(color => ({ ...color, rgb: color.code === '001' ? [255, 0, 0] : [0, 0, 255], notes: 'PRIVATE_CANDIDATE' })) }, source: { attachmentId: asset.id, digest: asset.digest, filename: 'PRIVATE_FILENAME', adjustments: { x: 0, y: 0, width: 100, height: 100, rotation: 0, brightness: 100, contrast: 100, flipX: false, flipY: false, notes: 'PRIVATE_SOURCE' } }, alphaPolicy: { emptyBelow: 128, partialBackground: '#ffffff' }, preference: { version: 1, indices: [0, 1], tolerance: 6, maxDistance: 20, metric: 'CIE76', stage: 'cluster-to-palette', holdings: 'positive-or-unmeasured-usable-including-reserved' }, cleanup: { changedCells: 0, protection: 'output-regions' }, ownerNotes: 'PRIVATE_ENGINE' };
  command(repo, 'pattern.save', { id: 'p', name: 'Blend', revision, sourceAttachmentId: asset.id });
  command(repo, 'project.save', { id: 'work', name: 'Blend work', patternId: 'p', revisionId: 'r1' });
  return { repo, asset, revision };
}
