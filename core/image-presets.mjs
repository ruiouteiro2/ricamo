/** Output stitch density stays explicit: presets never silently change fabric size. */
export const IMAGE_PRESETS=Object.freeze({
 realism:{mode:'detail',maxColors:500,region:0},
 faithful:{mode:'detail',maxColors:120,region:0},
 balanced:{mode:'balanced',maxColors:40,region:1},
 simple:{mode:'simple',maxColors:16,region:3},
});
export function imagePreset(name){if(!Object.hasOwn(IMAGE_PRESETS,name))throw Error('engine.mode');return {...IMAGE_PRESETS[name]};}
