import { catalogueReferenceHandlers, validateCatalogueReferences } from './catalogue-references.mjs';
import { documentOwnerHandlers } from './owner-documents.mjs';
import { stockCountHandlers } from './stock-count.mjs';
import { normalizePatternLibrary, validatePatternLibrary } from './pattern-library.mjs';
import { saveEntityWithAssets } from './entity-assets.mjs';
import { saveProject, saveSession } from './projects.mjs';
import { validateMaterialDescriptors, validateDescriptorProperties } from './material-descriptors.mjs';
import {workCompanionHandlers,validateWorkCompanion} from './work-companion.mjs';
import { kitWorkflowHandlers, validateKitWorkflows } from './kit-workflows.mjs';
import { createPatternWithAsset } from './pattern-asset.mjs';
import { motifHandlers, validateEditorMotifs } from './editor-inserts.mjs';
import { projectInsightHandlers, validateProjectInsights } from './project-insights.mjs';
import { importProjectPackage } from './project-package.mjs';
import { applyCommand, createState, validateState } from './commands.mjs';
import { assert, text, identifier, find, put, stringList, stableStringify } from './shared.mjs';
import { saveMaterial, addLot, saveLocation } from './inventory.mjs';
import { applyProjectThreadEstimate, validateThreadEstimateState } from './thread-estimate-workflow.mjs';
import { validateRevision } from './pattern.mjs';
import { referenceHandlers, validateReferenceData } from './references.mjs';
import { inventoryWorkflowHandlers, validateInventoryWorkflowState } from './inventory-workflows.mjs';
import { fabricPlanningHandlers, validateFabricPlanning } from './fabric-planning.mjs';
import { draftHandlers, validatePatternDraft } from './drafts.mjs';
import { toolActivityHandlers, validateToolActivity } from './tool-activity.mjs';

export { createState };
const handlers = {
  ...catalogueReferenceHandlers,
  ...documentOwnerHandlers,
  ...stockCountHandlers,
  'entity.saveWithAssets': (state, payload, context) => saveEntityWithAssets(state, payload, context, { saveAttachment: handlers['attachment.add'], ownerHandlers: { ...documentOwnerHandlers, 'material.save': saveMaterial, 'material.createWithLot': handlers['material.createWithLot'], 'project.save': saveProject, 'session.save': saveSession } }),
  ...workCompanionHandlers,
  ...kitWorkflowHandlers,
  'pattern.createWithAsset': (state, payload, context) => createPatternWithAsset(state, payload, context, { saveAttachment: handlers['attachment.add'], savePattern: handlers['pattern.save'] }),
  ...motifHandlers,
  ...projectInsightHandlers,
  'project.package.import': importProjectPackage,
  ...toolActivityHandlers,
  ...draftHandlers,
  ...inventoryWorkflowHandlers,
  ...fabricPlanningHandlers,
  ...referenceHandlers,
  'project.estimate': applyProjectThreadEstimate,
  'material.createWithLot': (state, payload, context) => {
    const id = payload.material.id || context.id();
    saveMaterial(state, { ...payload.material, id }, context);
    if (payload.lot) addLot(state, { ...payload.lot, materialId: id }, context);
  },
  'pattern.save': (state, p, ctx) => {
    const id = p.id ? identifier(p.id) : ctx.id();
    const existing = state.patterns.find(item => item.id === id);
    const kind = p.kind ?? existing?.kind ?? 'structured';
    assert(['structured', 'reference'].includes(kind), 'invalid_pattern_kind');
    const pattern = { ...existing, id, kind, name: text(p.name ?? existing?.name, 'name', { required: true, max: 300 }),
      notes: text(p.notes ?? existing?.notes, 'notes', { max: 20000 }), tags: stringList(p.tags ?? existing?.tags),
      sourceAttachmentId: p.sourceAttachmentId ?? existing?.sourceAttachmentId ?? null,
      favorite: p.favorite ?? existing?.favorite ?? false, archived: p.archived ?? existing?.archived ?? false,
      createdAt: existing?.createdAt ?? ctx.now, updatedAt: ctx.now, revisions: existing?.revisions ?? [] };
    if (p.catalogueReferences !== undefined) pattern.catalogueReferences = structuredClone(p.catalogueReferences);
    if (p.library !== undefined) pattern.library = normalizePatternLibrary(p.library);
    if (pattern.sourceAttachmentId) find(state, 'attachments', pattern.sourceAttachmentId);
    if (p.revision) {
      assert(kind === 'structured', 'invalid_pattern_kind');
      const revision = structuredClone(p.revision);
      revision.id = revision.id ? identifier(revision.id) : ctx.id();
      assert(!pattern.revisions.some(row => row.id === revision.id), 'duplicate_revision');
      const editorBase = existing ? revision.provenance?.editorBaseRevisionId : null;
      if (editorBase) assert(pattern.revisions.some(row => row.id === editorBase), 'draft_base_not_found');
      revision.parentId = editorBase || pattern.currentRevisionId || null;
      revision.createdAt = ctx.now;
      validateRevision(revision);
      pattern.revisions = [...pattern.revisions, revision];
      pattern.currentRevisionId = revision.id;
      if (p.clearDraft === true) delete pattern.draft;
    }
    assert(kind === 'reference' ? Boolean(pattern.sourceAttachmentId) : pattern.revisions.length > 0, 'pattern_content_required');
    put(state, 'patterns', pattern);
  },
  'pattern.duplicate': (state, p, ctx) => {
    const source = find(state, 'patterns', p.id);
    const current = source.revisions.find(row => row.id === source.currentRevisionId);
    handlers['pattern.save'](state, { ...source, id: ctx.id(), name: p.name || source.name, revision: current ? { ...current, id: ctx.id() } : undefined }, ctx);
  },
  'attachment.add': (state, p, ctx) => {
    assert(typeof p.digest === 'string' && /^[a-f0-9]{64}$/.test(p.digest), 'invalid_file_digest');
    assert(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'].includes(p.mime), 'invalid_file_type');
    assert(Number.isSafeInteger(p.size) && p.size > 0 && p.size <= 25 * 1024 * 1024, 'file_too_large');
    const id = identifier(p.id);
    assert(!state.attachments.some(row => row.id === id), 'duplicate_attachment');
    state.attachments.push({ id, name: text(p.name, 'name', { required: true, max: 250 }), mime: p.mime, size: p.size, digest: p.digest, createdAt: ctx.now });
  },
  'inventory.import': (state, p, ctx) => {
    assert(Array.isArray(p.rows) && p.rows.length > 0 && p.rows.length <= 5000, 'invalid_import');
    assert(typeof p.digest === 'string' && /^[a-f0-9]{64}$/.test(p.digest), 'invalid_file_digest');
    assert(!state.audit.some(row => row.kind === 'csv_import' && row.digest === p.digest) || p.allowRepeat === true, 'duplicate_import');
    const createdMaterials = new Map(), metadata = new Map();
    for (const row of p.rows) {
      assert(row && typeof row === 'object' && !Array.isArray(row) && (row.skip === undefined || typeof row.skip === 'boolean'), 'invalid_import');
      if (row.skip) continue;
      assert(row.material && typeof row.material === 'object' && !Array.isArray(row.material) && (!row.issues || Array.isArray(row.issues) && row.issues.length === 0), 'invalid_import');
      validateDescriptorProperties(row.material.properties ?? {});
      if (row.lot) validateDescriptorProperties(row.lot.properties ?? {}, 'lot');
      const identity = JSON.stringify([row.material.brand, row.material.range, row.material.code || row.material.name]);
      if (!row.materialId) { const signature = stableStringify(row.material); assert(!metadata.has(identity) || metadata.get(identity) === signature, 'csv_metadata_conflict'); metadata.set(identity, signature); }
      const id = row.materialId || createdMaterials.get(identity) || ctx.id();
      if (!row.materialId && !createdMaterials.has(identity)) { saveMaterial(state, { ...row.material, id }, ctx); createdMaterials.set(identity, id); }
      else find(state, 'materials', id);
      if (row.lot) {
        const lot = { ...row.lot, materialId: id };
        if (!lot.locationId && lot.locationName && p.createLocations === true) {
          let location = state.locations.find(item => item.name === lot.locationName);
          if (!location) { const locationId = ctx.id(); saveLocation(state, { id: locationId, name: lot.locationName }, ctx); location = state.locations.find(item => item.id === locationId); }
          lot.locationId = location.id;
        }
        delete lot.locationName;
        addLot(state, lot, ctx);
      }
    }
    state.audit.push({ id: ctx.id(), kind: 'csv_import', digest: p.digest, date: ctx.now, rows: p.rows.filter(row => !row.skip).length });
  },
};

export function executeCommand(state, command, context = {}) {
  const next = applyCommand(state, command, { ...context, handlers });
  validateApplicationState(next);
  return next;
}

export function validateApplicationState(state) {
  validateState(state);
  validatePatternLibrary(state);
  validateCatalogueReferences(state);
  validateMaterialDescriptors(state);
  validateKitWorkflows(state);
  validateWorkCompanion(state);
  validateInventoryWorkflowState(state);
  validateFabricPlanning(state);
  validateToolActivity(state);
  validateThreadEstimateState(state);
  validateProjectInsights(state);
  validateEditorMotifs(state);
  const seenAttachments = new Set();
  for (const attachment of state.attachments) {
    identifier(attachment.id);
    assert(!seenAttachments.has(attachment.id), 'duplicate_attachment');
    seenAttachments.add(attachment.id);
    assert(/^[a-f0-9]{64}$/.test(attachment.digest), 'invalid_file_digest');
    assert(Number.isSafeInteger(attachment.size) && attachment.size > 0 && attachment.size <= 25 * 1024 * 1024, 'file_too_large');
    text(attachment.name, 'name', { required: true, max: 250 });
    assert(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'].includes(attachment.mime), 'invalid_file_type');
  }
  for (const pattern of state.patterns) {
    identifier(pattern.id);
    text(pattern.name, 'name', { required: true, max: 300 });
    assert(Array.isArray(pattern.tags), 'invalid_list'); stringList(pattern.tags);
    assert(typeof pattern.favorite === 'boolean' && typeof pattern.archived === 'boolean', 'invalid_boolean');
    assert(['structured', 'reference'].includes(pattern.kind), 'invalid_pattern_kind');
    assert(Array.isArray(pattern.revisions), 'invalid_pattern_revisions');
    for (const revision of pattern.revisions) validateRevision(revision);
    if (pattern.kind === 'structured') assert(pattern.revisions.some(row => row.id === pattern.currentRevisionId), 'invalid_current_revision');
    if (pattern.sourceAttachmentId) assert(seenAttachments.has(pattern.sourceAttachmentId), 'missing_attachment');
    if (pattern.kind === 'reference') assert(Boolean(pattern.sourceAttachmentId), 'pattern_content_required');
    if (pattern.referenceData) {
      assert(pattern.kind === 'reference', 'reference_pattern_required');
      validateReferenceData(pattern.referenceData, { attachmentId: pattern.sourceAttachmentId });
    }
    if (pattern.draft) validatePatternDraft(pattern.draft, { pattern });
  }
  for (const project of state.projects) if (project.referenceData) {
    const pattern = state.patterns.find(row => row.id === project.patternId);
    assert(pattern?.kind === 'reference', 'reference_pattern_required');
    validateReferenceData(project.referenceData, { attachmentId: pattern.sourceAttachmentId });
  }
  return state;
}
