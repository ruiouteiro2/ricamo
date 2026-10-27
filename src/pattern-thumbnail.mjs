import { drawPattern } from './pattern-render.mjs';

// Published revisions are immutable. Object identity also prevents sharing pixels
// between imported revisions that happen to use the same external identifier.
// At most 32 reconstructible previews are retained; nothing is persisted here.
const previews = new Map(), limit = 32;
export function drawThumbnail(canvas, revision) {
  let preview = previews.get(revision);
  if (!preview) {
    const cellSize = Math.min(420 / revision.width, 260 / revision.height);
    preview = document.createElement('canvas');
    drawPattern(preview, revision, { cellSize, width: revision.width * cellSize, height: revision.height * cellSize });
    previews.set(revision, preview);
    if (previews.size > limit) previews.delete(previews.keys().next().value);
  } else {
    previews.delete(revision); previews.set(revision, preview);
  }
  if (canvas.width !== preview.width) canvas.width = preview.width;
  if (canvas.height !== preview.height) canvas.height = preview.height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(preview, 0, 0);
}
