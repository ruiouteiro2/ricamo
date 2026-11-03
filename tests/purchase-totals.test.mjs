import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseTotalsBySupplier } from '../core/purchase-totals.mjs';
const line = (supplierId, currency, quantity, unitPrice, status='to_buy') => ({supplierId,currency,quantity,unitPrice,status});
test('order totals isolate suppliers/currencies, round lines, and exclude cancelled purchases', () => {
  const input=[line('casa','EUR',2,150),line('casa','EUR',3,250),line('casa','USD',1,400),line('other','EUR',4,100),line('casa','EUR',1,999,'cancelled')];
  const before=JSON.stringify(input), result=purchaseTotalsBySupplier(input);
  assert.deepEqual(result,[{supplierId:'casa',rows:3,currencies:[{currency:'EUR',total:1050,priced:2,missing:0},{currency:'USD',total:400,priced:1,missing:0}]},{supplierId:'other',rows:1,currencies:[{currency:'EUR',total:400,priced:1,missing:0}]}]);
  assert.equal(JSON.stringify(input),before);
  assert.equal(purchaseTotalsBySupplier([line('casa','EUR',.5,149)])[0].currencies[0].total,75);
});
test('unknown prices remain unknown, zero recorded prices remain zero, partial totals disclose missing rows',()=>{
  assert.deepEqual(purchaseTotalsBySupplier([line(null,'EUR',1,null)])[0].currencies,[{currency:'EUR',total:null,priced:0,missing:1}]);
  assert.deepEqual(purchaseTotalsBySupplier([line('casa','EUR',1,0),line('casa','EUR',1,null)])[0].currencies,[{currency:'EUR',total:0,priced:1,missing:1}]);
  assert.deepEqual(purchaseTotalsBySupplier([line('casa','EUR',1,500,'cancelled')]),[]);
});
