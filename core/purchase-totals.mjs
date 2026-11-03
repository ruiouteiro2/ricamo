/** Recorded line prices only. Never combine suppliers/currencies or treat missing prices as zero. */
export function purchaseTotalsBySupplier(orders) {
  const suppliers = new Map();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const supplierId = order.supplierId || null;
    if (!suppliers.has(supplierId)) suppliers.set(supplierId, { supplierId, rows: 0, currencies: new Map() });
    const supplier = suppliers.get(supplierId); supplier.rows++;
    if (!supplier.currencies.has(order.currency)) supplier.currencies.set(order.currency, { currency: order.currency, total: 0, priced: 0, missing: 0 });
    const amount = supplier.currencies.get(order.currency);
    if (order.unitPrice === null || order.unitPrice === undefined) amount.missing++;
    else { amount.total += Math.round(order.quantity * order.unitPrice); amount.priced++; }
  }
  return [...suppliers.values()].map(group => ({ ...group, currencies: [...group.currencies.values()].map(amount => ({ ...amount, total: amount.priced ? amount.total : null })) }));
}
