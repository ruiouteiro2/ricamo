import {setThreadCountUnit} from './thread-count-unit.mjs';
import { assert, find, quantity, oneOf, add, subtract, totalReserved } from './shared.mjs';
import { saveMaterial, saveLot, addLot } from './inventory.mjs';
import { applyStockCount } from './stock-count.mjs';
import { toolHeldQuantity } from './tool-state.mjs';
import { guardFabricCommand, afterFabricCommand } from './fabric-planning.mjs';
import { guardToolCommand, afterToolCommand } from './tool-activity.mjs';
export function materialEditSnapshot(state, id) {
  const material = find(state, 'materials', id), lots = state.lots.filter(lot => lot.materialId === id && lot.status !== 'transformed');
  const amount = lots.some(lot => lot.quantity === null) ? null : add(...lots.map(lot => lot.quantity));
  const usageStatus = amount === 0 ? 'finished' : lots.some(lot => lot.quantity !== 0 && lot.properties?.usageStatus === 'nearly_finished') ? 'nearly_finished' : lots.some(lot => lot.properties?.usageStatus === 'partial' || lot.properties?.details?.packageCondition === 'partial') ? 'partial' : 'new';
  return { quantity: amount, usageStatus, fingerprint: { material: structuredClone(material), lots: lots.map(lot => ({ id: lot.id, quantity: lot.quantity, status: lot.status, updatedAt: lot.updatedAt })) } };
}
export function saveMaterialInventory(state, payload, context) {
  assert(payload?.material && typeof payload.material === 'object' && !Array.isArray(payload.material), 'invalid_payload');
  const before = materialEditSnapshot(state, payload.material.id);
  assert(JSON.stringify(before.fingerprint) === JSON.stringify(payload.expected), 'material_edit_stale');
  if(payload.threadCountUnit===true&&payload.material.unit!==before.fingerprint.material.unit)setThreadCountUnit(state,{materialId:payload.material.id,unit:payload.material.unit,preserveCounts:true},context);
  const amount = quantity(payload.quantity, { nullable: true });
  const usage = oneOf(payload.usageStatus, ['new', 'partial', 'nearly_finished', 'finished'], 'usageStatus');
  assert(usage !== 'finished' || amount === 0, 'material_edit_finished_quantity');
  const lots = state.lots.filter(lot => lot.materialId === payload.material.id && lot.status !== 'transformed');
  if (amount !== before.quantity) {
    assert(amount !== null, 'material_edit_known_quantity');
    const unknown = lots.filter(lot => lot.quantity === null);
    assert(unknown.length <= 1, 'material_edit_unknown_lots');
    const planned = new Map(lots.map(lot => [lot.id, lot.quantity ?? 0]));
    let known = add(...lots.map(lot => lot.quantity ?? 0));
    if (unknown.length && amount >= known) { planned.set(unknown[0].id, subtract(amount, known)); known = amount; }
    let difference = subtract(amount, known);
    if (difference > 0 && lots.length) {
      const target = lots.find(lot => lot.status === 'usable' && !lot.locationId) || lots.find(lot => lot.status === 'usable') || lots[0];
      planned.set(target.id, add(planned.get(target.id), difference));
    } else if (difference < 0) {
      let remaining = -difference;
      for (const lot of [...lots].sort((a,b) => Number(Boolean(a.locationId)) - Number(Boolean(b.locationId)) || (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id))) {
        const available = Math.max(0, subtract(planned.get(lot.id), add(totalReserved(state, lot.id), toolHeldQuantity(lot))));
        const reduction = Math.min(remaining, available);
        planned.set(lot.id, subtract(planned.get(lot.id), reduction)); remaining = subtract(remaining, reduction);
      }
      assert(remaining === 0, 'insufficient_available');
    }
    if (lots.length) {
      const rows = lots.filter(lot => planned.get(lot.id) !== lot.quantity).map(lot => ({ lotId: lot.id, observed: planned.get(lot.id) }));
      if (rows.length) applyStockCount(state, { previewRevision: state.revision, reason: 'Rettifica della quantità posseduta da Modifica materiale', rows }, context);
    } else if (amount > 0) addLot(state, { materialId: payload.material.id, quantity: amount, reason: 'Quantità posseduta registrata da Modifica materiale' }, context);
  }
  saveMaterial(state, payload.material, context);
  if (usage !== before.usageStatus || !lots.length) {
    for (const lot of state.lots.filter(lot => lot.materialId === payload.material.id && lot.status !== 'transformed')) {
      const command = { type: 'lot.save', payload: { id: lot.id, properties: { ...lot.properties, usageStatus: usage, details: { version: 1, ...lot.properties?.details, packageCondition: usage === 'new' ? 'sealed' : 'partial' } } } };
      guardFabricCommand(state, command); guardToolCommand(state, command);
      saveLot(state, command.payload, context); afterFabricCommand(state, command, context); afterToolCommand(state, command, context);
    }
  }
}
export const materialEditHandlers = { 'material.saveInventory': saveMaterialInventory };
