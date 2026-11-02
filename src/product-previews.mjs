import diamant from './assets/dmc-diamant-previews.json' with {type:'json'};
import colbert from './assets/dmc-colbert-previews.json' with {type:'json'};
import casa from './assets/casa-product-previews.json' with {type:'json'};
import {bundledSupplierProducts,supplierIdentity} from '../core/supplier-products.mjs';
const urlKey=value=>String(value??'').replace(/^https:\/\/www\.casacenina\.(?:com|fr|es)\//,'https://www.casacenina.it/');
let identities;
function exactIdentityPhotos(){
 if(identities)return identities;
 const candidates=new Map();
 for(const product of bundledSupplierProducts()){
  const digest=casa.byUrl[urlKey(product.url)];if(!digest||!product.brand||!product.range||!product.code)continue;
  const key=`${product.category}:${supplierIdentity(product)}`;
  if(!candidates.has(key))candidates.set(key,new Set());candidates.get(key).add(digest);
 }
 identities=new Map([...candidates].filter(([,values])=>values.size===1).map(([key,values])=>[key,[...values][0]]));return identities;
}
export function productPreview(value){
 const product=value?.properties?.product??value;if(!product)return '';
 const official=diamant[product.id]||colbert[product.id]||(product.brand==='DMC'&&product.range==='Diamant'?diamant[`dmc:diamant:${product.code}`]:'')||(product.brand==='DMC'&&product.range==='Laine Colbert'?colbert[`dmc:colbert:${product.code}`]:'');if(official)return official;
 const url=product.url||value?.properties?.purchaseUrl;
 const direct=casa.byUrl[urlKey(url)];if(direct)return casa.images[direct]||'';
 if(!product.brand||!product.range||!product.code)return '';
 const digest=exactIdentityPhotos().get(`${product.category}:${supplierIdentity(product)}`);return digest?casa.images[digest]||'':'';
}
export function productPreviewStyle(product){
 const source=productPreview(product);
 return source?{backgroundImage:`url(${source})`,backgroundColor:'#fff',backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat'}:{};
}
