import { counts } from './pattern.mjs';
import { fabricSize, convertQuantity } from './fabric.mjs';
import { assert, quantity } from './shared.mjs';

/** Planning estimate only. Never used as a stock mutation or confirmed consumption. */
export function estimateThreads(revision, configuration = {}) {
  const countX = Number(configuration.countX ?? revision.settings?.count ?? 14);
  const countY = Number(configuration.countY ?? countX);
  const countMeaning = configuration.countMeaning ?? 'stitches';
  const overX = Number(configuration.overX ?? 1), overY = Number(configuration.overY ?? overX);
  const size = fabricSize({ width: revision.width, height: revision.height, countX, countY, countMeaning, overX, overY });
  const pitchX = size.widthCm / revision.width / 100, pitchY = size.heightCm / revision.height / 100;
  const waste = quantity(configuration.waste ?? revision.settings?.waste ?? 20);
  assert(waste <= 100, 'invalid_waste');
  const byColor = counts(revision).byColor;
  const results = byColor.map(row => {
    const color = revision.colors[row.index];
    const strands = Number(configuration.colorStrands?.[row.index] ?? color.strands ?? configuration.strands ?? 2);
    const backStrands = Number(configuration.backStrands ?? 1);
    assert(Number.isInteger(strands) && strands >= 1 && strands <= 100 && Number.isInteger(backStrands) && backStrands >= 1 && backStrands <= 100, 'invalid_strands');
    const cross = row.full * (2 * Math.hypot(pitchX, pitchY) + pitchX + pitchY) * strands;
    const half = row.half * (Math.hypot(pitchX, pitchY) + pitchY) * strands;
    const outline = revision.backstitches.filter(segment => segment.color === row.index).reduce((sum, segment) => sum + Math.hypot((segment.x2 - segment.x1) * pitchX, (segment.y2 - segment.y1) * pitchY) * 2 * backStrands, 0);
    const starts = row.total ? Math.ceil(row.total / 80) * .12 * strands : 0;
    const filamentMetres = quantity((cross + half + outline) * (1 + waste / 100) + starts);
    return { index: row.index, color, filamentMetres, confidence: 'estimated', method: 'ricamo-geometric-v1',
      assumptions: { pitchX, pitchY, strands, backStrands, wastePercent: waste, startFinishPer80PrimitivesMetres: .12 } };
  });
  return results;
}

export function estimateForMaterial(estimate, material) {
  return convertQuantity(estimate.filamentMetres, 'strand-m', material.unit, material);
}
