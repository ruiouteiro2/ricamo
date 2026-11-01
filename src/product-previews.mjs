import diamant from './assets/dmc-diamant-previews.json';
export const productPreview = product => diamant[product?.id] || (product?.brand === 'DMC' && product?.range === 'Diamant' ? diamant[`dmc:diamant:${product.code}`] : '') || '';
export function productPreviewStyle(product) {
  const source = productPreview(product);
  return source ? { backgroundImage: `url(${source})`, backgroundSize: '190% auto', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {};
}
