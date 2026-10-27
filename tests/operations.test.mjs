import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createState } from '../core/commands.mjs';
import { stableStringify } from '../core/shared.mjs';

test('operation receipts do not retain copies of large content and remain key-order independent', () => {
  const command = { type: 'material.save', operationId: 'large-operation', payload: { id: 'm', name: 'Needle', notes: 'a'.repeat(19000) } };
  const state = applyCommand(createState(), command);
  assert.equal(state.materials[0].notes.length, 19000);
  assert.match(state.operations[0].signature, /^sha256:[a-f0-9]{64}$/);
  assert.ok(JSON.stringify(state.operations).length < 300);
  const retry = applyCommand(state, { ...command, payload: { notes: command.payload.notes, name: 'Needle', id: 'm' } });
  assert.deepEqual(retry, state);
  assert.throws(() => applyCommand(state, { ...command, payload: { ...command.payload, notes: 'changed' } }), { code: 'idempotency_conflict' });
});

test('legacy operation signatures remain replayable after a backup upgrade', () => {
  const command = { type: 'material.save', operationId: 'legacy', payload: { id: 'm', name: '001' } };
  const state = applyCommand(createState(), command);
  state.operations[0].signature = stableStringify({ type: command.type, payload: command.payload });
  assert.deepEqual(applyCommand(state, command), state);
});
