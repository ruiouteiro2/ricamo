import { performance } from 'node:perf_hooks';
import { createState, applyCommand, validateState, inventorySummary } from '../core/commands.mjs';
let i = 0;
const ctx = { now: '2026-10-27T09:00:00.000Z', id: () => `seed-${++i}` };
let base = applyCommand(createState(), { type: 'material.save', operationId: 'seed-material', payload: { id: 'm', name: 'Cotton', unit: 'm', category: 'thread', code: '001' } }, ctx);
base = applyCommand(base, { type: 'lot.add', operationId: 'seed-lot', payload: { id: 'l', materialId: 'm', quantity: 10 } }, ctx);
base = applyCommand(base, { type: 'project.save', operationId: 'seed-project', payload: { id: 'p', name: 'Sampler' } }, ctx);
const state = createState();
for (let n = 0; n < 5000; n++) {
  state.materials.push({ ...structuredClone(base.materials[0]), id: `material-${n}`, name: `Cotton ${n}`, code: String(n).padStart(4, '0') });
  state.lots.push({ ...structuredClone(base.lots[0]), id: `lot-${n}`, materialId: `material-${n}`, quantity: 9.7 });
  for (let j = 0; j < 4; j++) state.movements.push({ ...base.movements[0], id: `move-${n}-${j}`, lotId: `lot-${n}`, materialId: `material-${n}`, kind: j === 0 ? 'opening' : 'consume', quantity: j === 0 ? 10 : 0.1, before: j === 0 ? 0 : (101 - j) / 10, after: (100 - j) / 10, operationId: `op-${n}-${j}` });
}
for (let n = 0; n < 50; n++) state.projects.push({ ...structuredClone(base.projects[0]), id: `project-${n}`, name: `Project ${n}` });
const results = {};
let start = performance.now(); validateState(state); results.validateMs = performance.now() - start;
start = performance.now(); const next = applyCommand(state, { type: 'settings.save', payload: { language: 'en' }, operationId: 'benchmark-command' }); results.cloneAndCommandMs = performance.now() - start;
start = performance.now(); for (let n = 0; n < 100; n++) inventorySummary(next, `material-${n}`); results.hundredSummariesMs = performance.now() - start;
start = performance.now(); state.materials.filter(m => `${m.name} ${m.code}`.toLowerCase().includes('cotton 499')); results.searchMs = performance.now() - start;
results.jsonBytes = Buffer.byteLength(JSON.stringify(state));
results.counts = { materials: state.materials.length, lots: state.lots.length, movements: state.movements.length, projects: state.projects.length };
results.node = process.version;
results.limitations = 'Synthetic core baseline only. No photographs, file IO, SQLite, rendering or installed Windows measurements.';
console.log(JSON.stringify(results, null, 2));
