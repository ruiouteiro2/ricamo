import test from 'node:test';import assert from 'node:assert/strict';
import {imagePreset,IMAGE_PRESETS} from '../core/image-presets.mjs';
test('Photo presets preserve detail progressively without silently changing stitch or fabric dimensions',()=>{
 assert.deepEqual(Object.keys(IMAGE_PRESETS),['realism','faithful','balanced','simple']);
 assert.deepEqual(imagePreset('realism'),{mode:'detail',maxColors:500,region:0});
 let previous=Infinity;for(const name of Object.keys(IMAGE_PRESETS)){const preset=imagePreset(name);assert.ok(preset.maxColors<previous);previous=preset.maxColors;assert.equal(preset.width,undefined);assert.equal(preset.height,undefined);}
 const copy=imagePreset('realism');copy.maxColors=1;assert.equal(imagePreset('realism').maxColors,500);assert.throws(()=>imagePreset('__proto__'));
});
