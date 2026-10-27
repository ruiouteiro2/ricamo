import { createState, executeCommand } from './application.mjs';
import { createBlank } from './pattern.mjs';
import { localDate } from './calendar.mjs';

export const EXAMPLE_IDS = Object.freeze({ known: 'example-red-thread', estimated: 'example-green-thread', unknown: 'example-gold-thread', project: 'example-project', pattern: 'example-flower' });
const wording = {
  it: { location: 'Scatola di prova', known: 'Cotone rosso · quantità misurata', estimated: 'Cotone verde · quantità stimata', unknown: 'Cotone oro · quantità da misurare', fabric: 'Aida per il campione', hoop: 'Telaio del campione', pattern: 'Un piccolo fiore', project: 'Il mio primo campione', preparation: 'Controllare tessuto e colori', work: 'Ricamare il fiore', finish: 'Lavare secondo le istruzioni e rifinire', knownNote: 'Sono stati registrati 8 m iniziali e un consumo effettivo di 0,5 m. La riserva restante non è un altro consumo.', estimatedNote: 'Questa quantità è una stima: misurala prima di considerarla esatta.', unknownNote: 'La quantità non è nota. Non significa zero: il filo esiste, ma deve essere misurato.', projectNote: 'Esempio modificabile. Prova a segnare i punti completati: le scorte non cambiano. Il consumo si registra separatamente.', brand: 'Esempio Ricamo', colorRed: 'Rosso', colorGreen: 'Verde', colorGold: 'Oro', session: 'Sessione di prova: 8 punti in 15 minuti.', consumption: 'Consumo misurato registrato a mano nel campione' },
  en: { location: 'Practice box', known: 'Red cotton · measured quantity', estimated: 'Green cotton · estimated quantity', unknown: 'Gold cotton · quantity to measure', fabric: 'Aida for the sampler', hoop: 'Sampler hoop', pattern: 'A little flower', project: 'My first sampler', preparation: 'Check fabric and colours', work: 'Stitch the flower', finish: 'Wash as instructed and finish', knownNote: '8 m were entered initially and 0.5 m was recorded as actual consumption. The remaining reservation is not another consumption.', estimatedNote: 'This quantity is an estimate: measure it before treating it as exact.', unknownNote: 'The quantity is unknown. That does not mean zero: the thread exists but needs measuring.', projectNote: 'An editable example. Try marking stitches complete: stock does not change. Consumption is recorded separately.', brand: 'Ricamo example', colorRed: 'Red', colorGreen: 'Green', colorGold: 'Gold', session: 'Practice session: 8 stitches in 15 minutes.', consumption: 'Measured consumption entered manually for the sampler' },
};
/** Authored synthetic data only. This factory never accepts or mutates a user's library. */
export function createExampleStudio(language = 'it', { now = new Date().toISOString() } = {}) {
  language = language === 'en' ? 'en' : 'it'; const w = wording[language]; let state = createState(), sequence = 0;
  const run = (type, payload) => { state = executeCommand(state, { type, payload, operationId: `example-op-${++sequence}` }, { now, id: () => `example-record-${++sequence}` }); };
  run('settings.save', { language, preferences: { exampleStudioVersion: 1 } });
  run('location.save', { id: 'example-box', name: w.location });
  const threads = [
    { id: EXAMPLE_IDS.known, name: w.known, code: '001', color: '#a84653', quantity: 8, confidence: 'exact', notes: w.knownNote },
    { id: EXAMPLE_IDS.estimated, name: w.estimated, code: '010', color: '#52765b', quantity: 5, confidence: 'estimated', notes: w.estimatedNote },
    { id: EXAMPLE_IDS.unknown, name: w.unknown, code: '100', color: '#c09848', quantity: null, notes: w.unknownNote },
  ];
  for (const row of threads) {
    run('material.save', { id: row.id, name: row.name, category: 'thread', unit: 'm', brand: w.brand, code: row.code, color: row.color, strands: 6, divisible: true, notes: row.notes });
    run('lot.add', { id: `${row.id}-lot`, materialId: row.id, quantity: row.quantity, ...(row.confidence ? { confidence: row.confidence } : {}), locationId: 'example-box', lotCode: row.code, notes: row.notes, cost: row.quantity === null ? null : 180, currency: 'EUR' });
  }
  run('material.save', { id: 'example-fabric', name: w.fabric, category: 'fabric', unit: 'piece' });
  run('lot.add', { id: 'example-fabric-piece', materialId: 'example-fabric', quantity: 1, locationId: 'example-box', cost: 400, properties: { widthCm: 30, heightCm: 30, countX: 14, countY: 14, countMeaning: 'stitches', washState: 'unwashed' } });
  run('material.save', { id: 'example-hoop', name: w.hoop, category: 'tool', unit: 'piece', reusable: true });
  run('lot.add', { id: 'example-hoop-lot', materialId: 'example-hoop', quantity: 1, locationId: 'example-box', cost: 700 });
  const colors = threads.map((row, index) => ({ brand: w.brand, code: row.code, name: [w.colorRed, w.colorGreen, w.colorGold][index], hex: row.color, rgb: [1, 3, 5].map(offset => parseInt(row.color.slice(offset, offset + 2), 16)), symbol: ['A', 'B', 'C'][index], strands: 2, itemId: row.id }));
  const rows = ['............', '....AA......', '...AAAA.....', '..AAACAA....', '..AACCCAA...', '...AACAA....', '....BB......', '..B.BB.B....', '..BBBBBB....', '....BB......', '....BB......', '............'];
  const revision = createBlank(12, 12, colors, { id: 'example-flower-r1', name: w.pattern, provenance: { source: 'ricamo-authored-example', version: 1 } });
  revision.cells = rows.flatMap(row => [...row].map(cell => ({ A: 0, B: 1, C: 2 })[cell] ?? -1));
  run('pattern.save', { id: EXAMPLE_IDS.pattern, name: w.pattern, revision });
  run('project.save', { id: EXAMPLE_IDS.project, name: w.project, patternId: EXAMPLE_IDS.pattern, fabricLotId: 'example-fabric-piece', status: 'active', notes: w.projectNote, settings: { fabric: { countX: 14, countY: 14, countMeaning: 'stitches', overX: 1, overY: 1, margins: { top: 5, right: 5, bottom: 5, left: 5 } }, thread: { strands: 2 } } });
  run('need.save', { projectId: EXAMPLE_IDS.project, materialId: EXAMPLE_IDS.known, quantity: 1.5, unit: 'm', confidence: 'estimated' });
  run('need.save', { projectId: EXAMPLE_IDS.project, materialId: EXAMPLE_IDS.unknown, quantity: 0.2, unit: 'm', confidence: 'estimated' });
  run('reservation.set', { projectId: EXAMPLE_IDS.project, lotId: `${EXAMPLE_IDS.known}-lot`, quantity: 2 });
  run('stock.move', { lotId: `${EXAMPLE_IDS.known}-lot`, kind: 'consume', quantity: 0.5, projectId: EXAMPLE_IDS.project, reason: w.consumption });
  const completed = revision.cells.flatMap((color, index) => color < 0 ? [] : [`c:${index}`]).slice(0, 8);
  run('project.progress', { projectId: EXAMPLE_IDS.project, completed, done: true });
  for (const [index, stage] of ['preparation', 'work', 'finishing'].entries()) run('task.save', { projectId: EXAMPLE_IDS.project, title: [w.preparation, w.work, w.finish][index], stage, done: index === 0, order: index });
  run('session.save', { projectId: EXAMPLE_IDS.project, date: localDate(now), durationMinutes: 15, notes: w.session, work: { kind: 'full', count: 8, patternId: EXAMPLE_IDS.pattern, revisionId: revision.id } });
  return state;
}
