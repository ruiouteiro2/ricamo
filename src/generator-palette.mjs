import { watch } from 'vue';

// Indices are meaningful only while the ordered commercial identities and RGBs
// remain unchanged. Stock amounts, display names and preference weights are not identities.
export function watchPaletteRestrictions(source, options, onReset) {
  return watch(() => {
    const [kind, palette] = source();
    return JSON.stringify([kind, palette?.brand ?? null, palette?.colors.map(color => [
      color.itemId ?? null, color.brand ?? palette.brand, color.range ?? '', color.code, color.rgb,
    ]) ?? null]);
  }, () => {
    if (!options.fixedColors.length && !options.excludedColors.length) return;
    options.fixedColors = [];
    options.excludedColors = [];
    onReset();
  }, { flush: 'sync' });
}
