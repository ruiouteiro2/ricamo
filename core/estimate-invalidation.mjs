import { archivePatternNeeds, threadEstimateConfiguration } from './estimates.mjs';

function geometry(project, lots) {
  const planned = project.settings.fabric ?? {}, lot = project.fabricLotId ? lots.get(project.fabricLotId) : null;
  return JSON.stringify([project.fabricLotId, lot ? lot.properties.countX : planned.countX,
    lot ? lot.properties.countY : planned.countY, lot ? lot.properties.countMeaning : planned.countMeaning,
    planned.overX ?? 1, planned.overY ?? planned.overX ?? 1]);
}
const conversion = material => JSON.stringify([material.unit, material.strands, material.divisible, material.archived, material.mergedInto, material.category]);

/** Invalidate derived needs in the same transaction as their changed inputs.
 * Snapshot the previous estimate, never the newly edited fabric or conversion. */
export function afterEstimateCommand(state, command, context, before) {
  if (command.type !== 'project.save' && command.type !== 'lot.save'
    && !command.type.startsWith('fabric.') && !command.type.startsWith('material.')) return;
  const previousProjects = new Map(before.projects.map(row => [row.id, row]));
  const previousLots = new Map(before.lots.map(row => [row.id, row])), lots = new Map(state.lots.map(row => [row.id, row]));
  const changedMaterials = new Set();
  if (command.type.startsWith('material.')) {
    const previousMaterials = new Map(before.materials.map(row => [row.id, row]));
    for (const material of state.materials) {
      const previous = previousMaterials.get(material.id);
      if (previous && conversion(previous) !== conversion(material)) changedMaterials.add(material.id);
    }
  }
  for (const project of state.projects) {
    const previous = previousProjects.get(project.id); if (!previous) continue;
    const designChanged = previous.patternId !== project.patternId || previous.revisionId !== project.revisionId;
    const reason = designChanged ? 'revision_changed'
      : geometry(previous, previousLots) !== geometry(project, lots) ? 'fabric_changed'
      : JSON.stringify(threadEstimateConfiguration(previous.settings.thread)) !== JSON.stringify(threadEstimateConfiguration(project.settings.thread)) ? 'configuration_changed'
      : before.needs.some(row => row.projectId === project.id && row.source === 'pattern' && changedMaterials.has(row.materialId)) ? 'conversion_changed' : null;
    if (!reason) continue;
    const historical = { ...previous, settings: structuredClone(previous.settings) };
    archivePatternNeeds({ ...state, needs: before.needs }, historical, context, reason);
    if (historical.settings.threadEstimateHistory) project.settings.threadEstimateHistory = historical.settings.threadEstimateHistory;
    delete project.settings.threadEstimate;
    state.needs = state.needs.filter(row => row.projectId !== project.id || row.source !== 'pattern');
    if (designChanged && project.settings.thread) delete project.settings.thread.colorStrands;
  }
}
