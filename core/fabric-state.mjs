/** Leaf queries: geometric region claims do not create additional physical pieces. */
export function activeFabricRegions(lot) { return lot.fabricPlan?.regions?.filter(region => region.status === 'active') ?? []; }
export function fabricHeldPieces(lot) { return activeFabricRegions(lot).length ? 1 : 0; }
