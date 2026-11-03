import {assert, assertSafeJson} from './shared.mjs';

export const STUDIO_LIMIT = 48 * 1024 * 1024;
const keyPattern = /^(Global\.Settings|S[123]\.(info|ts|model|srcs|preview|selection|acts|render|navigation)|CLIPBOARD0\.(data|info)|local:[a-zA-Z0-9_$.-]{1,100})$/;
const checkKey = key => assert(typeof key === 'string' && keyPattern.test(key), 'studio_invalid_data');

/** Preserve the upstream model, including mixed and fractional stitches. No lossy
 * conversion to Ricamo's whole-cross revision model happens at this boundary. */
export function validateStudioModel(model) {
  assert(model && Array.isArray(model.images) && model.images.length > 0 && model.images.length <= 8, 'studio_invalid_data');
  const int = (n,min,max) => Number.isInteger(n) && n >= min && n <= max;
  const types = new Set(['cr','hc1','hc2','bi1','bi2','pt','qo1','qo2','qo3','qo4','qt1','qt2','qt3','qt4','qf1','qf2','qf3','qf4']);
  for (const image of model.images) {
    assert(int(image.width,1,300) && int(image.height,1,300), 'studio_dimensions');
    assert(Array.isArray(image.flossIndexes) && image.flossIndexes.length <= 2000 && Array.isArray(image.crossIndexes) && image.crossIndexes.length <= 90000, 'studio_invalid_data');
    const color = n => int(n,0,image.flossIndexes.length-1);
    for (const row of image.flossIndexes) {
      assert(row && ['DMC','ANC'].includes(row.sys) && typeof row.id === 'string' && row.id.length <= 100 && Array.isArray(row.rgb) && row.rgb.length === 3 && row.rgb.every(n=>int(n,0,255)), 'studio_invalid_data');
      if (row.blends) assert(Array.isArray(row.blends) && row.blends.length <= 12 && row.blends.every(b=>b && ['DMC','ANC'].includes(b.sys) && typeof b.id === 'string'), 'studio_invalid_data');
    }
    for (const cross of image.crossIndexes) assert(cross && types.has(cross.tp) && (Array.isArray(cross.fis) ? cross.fis.length <= 4 && cross.fis.every(n=>n === -1 || color(n)) : color(cross.fi)), 'studio_invalid_data');
    assert(Array.isArray(image.layers) && image.layers.length > 0 && image.layers.length <= 32, 'studio_invalid_data');
    for (const layer of image.layers) {
      assert(int(layer.width,1,300) && int(layer.height,1,300) && Array.isArray(layer.cross) && layer.cross.length === layer.width*layer.height && layer.cross.every(n=>int(n,-1,image.crossIndexes.length-1)), 'studio_invalid_data');
      assert(Array.isArray(layer.backstitch) && layer.backstitch.length <= 90000, 'studio_invalid_data');
      let points=0;
      for (const line of layer.backstitch) {
        assert(line && color(line.c) && Array.isArray(line.p) && line.p.length <= 90000, 'studio_invalid_data');
        for (const path of line.p) {
          assert(Array.isArray(path) && path.length >= 4 && path.length % 2 === 0, 'studio_invalid_data');
          points += path.length;
          assert(points <= 720000 && path.every((n,i)=>Number.isFinite(n) && n >= 0 && n <= (i%2?image.height:image.width) && Number.isInteger(n*4)), 'studio_invalid_data');
        }
      }
    }
  }
  return model;
}

export function validateStudioValue(key,json) {
  checkKey(key);
  assert(typeof json === 'string' && json.length <= 24*1024*1024, 'studio_too_large');
  let value; try { value=JSON.parse(json); } catch { assert(false,'studio_invalid_data'); }
  assertSafeJson(value);
  if (/^S[123]\.model$/.test(key)) validateStudioModel(value?.model);
  return value;
}

export function validateSchemaStudio(state) {
  if (state.schemaStudio === undefined) return;
  const studio=state.schemaStudio;
  assert(studio?.version === 1 && studio.entries && typeof studio.entries === 'object' && !Array.isArray(studio.entries), 'studio_invalid_data');
  const rows=Object.entries(studio.entries);
  assert(rows.length <= 300 && rows.reduce((n,[k,v])=>n+k.length+(typeof v==='string'?v.length:STUDIO_LIMIT+1),0) <= STUDIO_LIMIT, 'studio_too_large');
  for (const [key,json] of rows) validateStudioValue(key,json);
}

export const schemaStudioHandlers = {
  'studio.write': (state,p,ctx) => {
    assert(Array.isArray(p.changes) && p.changes.length > 0 && p.changes.length <= 300, 'studio_invalid_data');
    const entries={...(state.schemaStudio?.entries??{})};
    for (const {key,json} of p.changes) {
      checkKey(key);
      if (json === null) delete entries[key];
      else { validateStudioValue(key,json); entries[key]=json; }
    }
    state.schemaStudio={version:1,entries,updatedAt:ctx.now};
    validateSchemaStudio(state);
  },
};
