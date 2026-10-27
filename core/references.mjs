/** Reference marks are portable annotations, never structured stitches or stock. */
import { assert, identifier, integer, text, oneOf, find, assertSafeJson, audit } from './shared.mjs';

export const REFERENCE_LIMITS = Object.freeze({ pages: 10000, annotations: 5000, bookmarks: 500, noteLength: 2000 });
const TYPES = ['highlight', 'rectangle', 'line', 'text'];
const normalized = (value, field) => { assert(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1, 'reference_coordinate', { field }); return value; };
const bounded = (value, min, max, field) => { assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, 'reference_value', { field }); return value; };
const pageNumber = (value, pageCount) => integer(value, 'page', { min: 1, max: pageCount ?? REFERENCE_LIMITS.pages });
const hex = value => { assert(typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value), 'reference_color'); return value.toLowerCase(); };

export function createReferenceData(attachmentId) {
  return { version: 1, attachmentId: identifier(attachmentId, 'attachmentId'), pageCount: null,
    view: { page: 1, zoom: 1, rotation: 0, scrollX: 0, scrollY: 0 }, annotations: [], bookmarks: [] };
}

export function validateReferenceData(value, { attachmentId } = {}) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'reference_data'); assertSafeJson(value);
  assert(value.version === 1, 'reference_version'); identifier(value.attachmentId, 'attachmentId');
  if (attachmentId) assert(value.attachmentId === attachmentId, 'reference_attachment_changed');
  const pageCount = value.pageCount == null ? null : integer(value.pageCount, 'pageCount', { min: 1, max: REFERENCE_LIMITS.pages });
  const view = value.view; assert(view && typeof view === 'object' && !Array.isArray(view), 'reference_view');
  pageNumber(view.page, pageCount); bounded(view.zoom, .25, 4, 'zoom'); oneOf(view.rotation, [0, 90, 180, 270], 'rotation');
  normalized(view.scrollX, 'scrollX'); normalized(view.scrollY, 'scrollY');
  assert(Array.isArray(value.annotations) && value.annotations.length <= REFERENCE_LIMITS.annotations, 'reference_annotations');
  const ids = new Set();
  for (const mark of value.annotations) {
    assert(mark && typeof mark === 'object' && !Array.isArray(mark), 'reference_annotation'); identifier(mark.id); assert(!ids.has(mark.id), 'reference_duplicate_id'); ids.add(mark.id);
    pageNumber(mark.page, pageCount); oneOf(mark.type, TYPES, 'type'); normalized(mark.x, 'x'); normalized(mark.y, 'y'); hex(mark.color);
    bounded(mark.opacity, .1, 1, 'opacity'); text(mark.text ?? '', 'text', { max: REFERENCE_LIMITS.noteLength });
    if (mark.type === 'line') { normalized(mark.x2, 'x2'); normalized(mark.y2, 'y2'); assert(mark.x !== mark.x2 || mark.y !== mark.y2, 'reference_empty_shape'); }
    else if (mark.type !== 'text') {
      bounded(mark.width, .00001, 1, 'width'); bounded(mark.height, .00001, 1, 'height');
      assert(mark.x + mark.width <= 1.000000001 && mark.y + mark.height <= 1.000000001, 'reference_coordinate');
    } else text(mark.text, 'text', { required: true, max: REFERENCE_LIMITS.noteLength });
  }
  assert(Array.isArray(value.bookmarks) && value.bookmarks.length <= REFERENCE_LIMITS.bookmarks, 'reference_bookmarks');
  const bookmarkIds = new Set();
  for (const bookmark of value.bookmarks) {
    assert(bookmark && typeof bookmark === 'object' && !Array.isArray(bookmark), 'reference_bookmark');
    identifier(bookmark.id); assert(!bookmarkIds.has(bookmark.id), 'reference_duplicate_id'); bookmarkIds.add(bookmark.id);
    pageNumber(bookmark.page, pageCount); normalized(bookmark.x, 'x'); normalized(bookmark.y, 'y'); text(bookmark.label, 'label', { required: true, max: 300 });
  }
  return value;
}

export const referenceHandlers = {
  'reference.save': (state, payload, context) => {
    const pattern = find(state, 'patterns', payload.patternId);
    assert(pattern.kind === 'reference', 'reference_pattern_required');
    assert(pattern.sourceAttachmentId, 'reference_attachment_required');
    const asset = find(state, 'attachments', pattern.sourceAttachmentId);
    assert(asset.mime === 'application/pdf' || asset.mime.startsWith('image/'), 'reference_file_type');
    assert(payload.attachmentId === pattern.sourceAttachmentId, 'reference_attachment_changed');
    const owner = payload.projectId ? find(state, 'projects', payload.projectId) : pattern;
    if (payload.projectId) assert(owner.patternId === pattern.id, 'reference_project_mismatch');
    const contentEdit = payload.annotations !== undefined || payload.bookmarks !== undefined;
    if (contentEdit && payload.projectId) assert(!['completed', 'archived'].includes(owner.status), 'project_closed');
    const current = owner.referenceData ?? createReferenceData(pattern.sourceAttachmentId);
    validateReferenceData(current, { attachmentId: pattern.sourceAttachmentId });
    const next = { ...structuredClone(current),
      ...(payload.pageCount !== undefined ? { pageCount: payload.pageCount } : {}),
      ...(payload.view !== undefined ? { view: { ...current.view, ...payload.view } } : {}),
      ...(payload.annotations !== undefined ? { annotations: structuredClone(payload.annotations) } : {}),
      ...(payload.bookmarks !== undefined ? { bookmarks: structuredClone(payload.bookmarks) } : {}) };
    if (asset.mime !== 'application/pdf') { assert(next.pageCount == null || next.pageCount === 1, 'reference_image_page'); next.pageCount = 1; }
    validateReferenceData(next, { attachmentId: pattern.sourceAttachmentId });
    owner.referenceData = next; owner.updatedAt = context.now;
    if (contentEdit) audit(state, context, payload.projectId ? 'project' : 'pattern', owner.id, 'reference_annotations', { annotations: next.annotations.length, bookmarks: next.bookmarks.length });
  },
};

/** Geometry helpers shared by canvas rendering and pointer hit mapping. Coordinates
 * are always persisted relative to the unrotated page, irrespective of zoom. */
export function displayPoint(point, rotation = 0) {
  if (rotation === 90) return { x: 1 - point.y, y: point.x };
  if (rotation === 180) return { x: 1 - point.x, y: 1 - point.y };
  if (rotation === 270) return { x: point.y, y: 1 - point.x };
  return { x: point.x, y: point.y };
}
export function originalPoint(point, rotation = 0) { return displayPoint(point, (360 - rotation) % 360); }
export function displayRect(rect, rotation = 0) {
  const points = [displayPoint({ x: rect.x, y: rect.y }, rotation), displayPoint({ x: rect.x + rect.width, y: rect.y + rect.height }, rotation)];
  return { x: Math.min(points[0].x, points[1].x), y: Math.min(points[0].y, points[1].y), width: Math.abs(points[1].x - points[0].x), height: Math.abs(points[1].y - points[0].y) };
}
