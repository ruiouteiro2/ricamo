/** Keep the complete initial frame inside the display's logical work area. */
export function initialWindowBounds(workArea, { width = 1440, height = 960 } = {}) {
  const availableWidth = Math.max(1, workArea.width - Math.min(64, Math.floor(workArea.width / 10)));
  const availableHeight = Math.max(1, workArea.height - Math.min(64, Math.floor(workArea.height / 10)));
  width = Math.min(width, availableWidth); height = Math.min(height, availableHeight);
  return { width, height, minWidth: Math.min(760, width), minHeight: Math.min(600, height),
    x: workArea.x + Math.floor((workArea.width - width) / 2), y: workArea.y + Math.floor((workArea.height - height) / 2) };
}
