import { documentMetadataIndex } from './owner-documents.mjs';
import { assert, add } from './shared.mjs';
import { csvText, exportInventory } from './csv.mjs';
import { projectProgress } from './projects.mjs';
import { costTotals } from './purchasing.mjs';

export const OPEN_DATASETS = Object.freeze(['inventory', 'movements', 'purchases', 'projects']);
export const OPEN_FORMATS = Object.freeze(['csv', 'tsv', 'json']);
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]));
const movementKeys = ['id','date','kind','materialId','lotId','quantity','unit','before','after','observedQuantity','projectId','reason','confidence','cost','currency','operationId','purchaseId','kitOpeningId','reversesId','destinationLotId','fromLocationId','toLocationId'];
const purchaseKeys = ['id','materialId','quantity','unit','received','status','projectIds','supplierId','unitPrice','currency','priority','notes','expectedDate','source','createdAt','updatedAt','attachments'];
const projectKeys = ['id','name','technique','status','recipient','dueDate','completedAt','notes','patternId','revisionId','budget','currency'];
const identityKeys = ['materialName','brand','range','code'];
const columns = {
  movements: [...movementKeys.filter(key => key !== 'cost'), ...identityKeys, 'lotCode', 'costHundredths'],
  purchases: [...purchaseKeys.filter(key => key !== 'unitPrice'), ...identityKeys, 'supplierName', 'unitPriceHundredths', 'receipts','attachmentMetadata'],
  projects: [...projectKeys.filter(key => key !== 'budget'), 'progressMode','progressPercent','completedPrimitives','totalPrimitives','fullCompleted','fullTotal','halfCompleted','halfTotal','backstitchCompleted','backstitchTotal','recordedSessions','recordedMinutes','budgetHundredths','knownConsumedCostHundredthsByCurrency','consumedMovementsWithoutCost','reservations','unallocatedKitCosts'],
};

/** Read-only projections. Missing historical confidence is never inferred from today's lot. */
export function openDataRows(state, dataset) {
  assert(OPEN_DATASETS.includes(dataset) && dataset !== 'inventory', 'invalid_choice');
  const metadata = documentMetadataIndex(state);
  const materials = new Map(state.materials.map(row => [row.id, row]));
  const lots = new Map(state.lots.map(row => [row.id, row]));
  const suppliers = new Map(state.suppliers.map(row => [row.id, row]));
  const identity = id => { const material = materials.get(id); return { materialName: material?.name ?? '', brand: material?.brand ?? '', range: material?.range ?? '', code: material?.code ?? '' }; };
  if (dataset === 'movements') return state.movements.map(row => {
    const value = pick(row, movementKeys); delete value.cost;
    return { ...value, ...identity(row.materialId), lotCode: lots.get(row.lotId)?.lotCode ?? '',
      confidence: row.confidence ?? (row.quantity === null ? 'unknown' : 'not_recorded'), costHundredths: row.cost ?? null };
  });
  if (dataset === 'purchases') return state.purchases.map(row => {
    const value = pick(row, purchaseKeys); delete value.unitPrice;
    return { ...value, ...identity(row.materialId), supplierName: suppliers.get(row.supplierId)?.name ?? '', unitPriceHundredths: row.unitPrice, attachments: row.attachments || [], attachmentMetadata: metadata(row.attachments || []),
      receipts: state.receipts.filter(receipt => receipt.purchaseId === row.id).map(receipt => { const { cost, ...value } = receipt; return { ...value, attachments: receipt.attachments || [], attachmentMetadata: metadata(receipt.attachments || []), costHundredths: cost }; }) };
  });
  const reversed = new Set(state.movements.filter(row => row.reversesId).map(row => row.reversesId));
  return state.projects.map(project => {
    const value = pick(project, projectKeys); delete value.budget;
    const progress = projectProgress(state, project.id), sessions = state.sessions.filter(row => row.projectId === project.id);
    const consumed = state.movements.filter(row => row.projectId === project.id && row.kind === 'consume' && !reversed.has(row.id));
    return { ...value, progressMode: progress.mode, progressPercent: progress.percent, completedPrimitives: progress.completed,
      totalPrimitives: progress.total, fullCompleted: progress.cross?.completed ?? null, fullTotal: progress.cross?.total ?? null,
      halfCompleted: progress.half?.completed ?? null, halfTotal: progress.half?.total ?? null,
      backstitchCompleted: progress.backstitch?.completed ?? null, backstitchTotal: progress.backstitch?.total ?? null,
      recordedSessions: sessions.length, recordedMinutes: add(...sessions.map(row => row.durationMinutes)),
      budgetHundredths: project.budget, knownConsumedCostHundredthsByCurrency: costTotals(state, project.id),
      consumedMovementsWithoutCost: consumed.filter(row => row.cost == null).length,
      reservations: state.reservations.filter(row => row.projectId === project.id && row.quantity > 0).map(row => pick(row, ['id','materialId','lotId','quantity','unit'])),
      unallocatedKitCosts: state.kitOpenings.filter(row => row.verification?.projectId === project.id).map(row => ({ openingId: row.id, costHundredths: row.unallocatedCost, currency: row.currency })) };
  });
}

/** JSON keeps canonical strings/nulls. CSV/TSV escapes spreadsheet formulas explicitly. */
export function exportOpenData(state, dataset, { format = 'csv', language = 'it', createdAt = new Date().toISOString() } = {}) {
  assert(OPEN_DATASETS.includes(dataset) && OPEN_FORMATS.includes(format) && ['it','en'].includes(language), 'invalid_choice');
  const delimiter = format === 'tsv' ? '\t' : language === 'it' ? ';' : ',';
  if (dataset === 'inventory' && format !== 'json') return exportInventory(state, language, delimiter);
  const data = dataset === 'inventory'
    ? { materials: state.materials, lots: state.lots, locations: state.locations, suppliers: state.suppliers }
    : openDataRows(state, dataset);
  if (format === 'json') return JSON.stringify({ format: 'ricamo-open-data', version: 1, dataset, createdAt, language,
    moneyScale: 100, notesIncluded: true, attachmentsIncluded: false, attachmentBytesIncluded: false, attachmentMetadata: dataset === 'inventory' ? documentMetadataIndex(state)([...state.materials,...state.locations].flatMap(row => row.attachments || [])) : undefined, data }, null, 2);
  const headers = [...columns[dataset], '__ricamo_escape'];
  const value = input => input && typeof input === 'object' ? JSON.stringify(input) : typeof input === 'number' ? String(input).replace('.', language === 'it' ? ',' : '.') : input;
  return csvText(headers, data.map(row => headers.map(key => key === '__ricamo_escape' ? 'apostrophe-v1' : value(row[key]))), delimiter);
}
