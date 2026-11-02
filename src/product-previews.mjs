import diamant from './assets/dmc-diamant-previews.json' with {type:'json'};
import colbert from './assets/dmc-colbert-previews.json' with {type:'json'};
import alsace from './assets/dmc-alsace-previews.json' with {type:'json'};
import pearl from './assets/dmc-pearl-previews.json' with {type:'json'};
import mat from './assets/dmc-mat-previews.json' with {type:'json'};
import profilo from './assets/profilo-previews.json' with {type:'json'};
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
const closestSizes=(sizes,size)=>[...sizes].sort((a,b)=>Math.abs(a-size)-Math.abs(b-size));
/** DMC numbers a colour once per line, so a size without its own photo can show that colour from another size, then from the sibling line. */
export function sameColourSwatch({family,size,code}={}){
 const number=Number(String(size??'').match(/\d+/)?.[0]),key=String(code??'').trim().toUpperCase();if(!number||!key)return null;
 const lines={alsace:{sizes:[5,8,12],image:value=>alsace[`dmc:alsace:${value}:${key}`]},pearl:{sizes:[3,5,8,12],image:value=>pearl.images[pearl.byKey[`dmc:pearl:${value}:${key}`]]}};
 if(!lines[family])return null;
 for(const line of [family,family==='alsace'?'pearl':'alsace'])for(const value of closestSizes(lines[line].sizes,number)){if(line===family&&value===number)continue;const image=lines[line].image(value);if(image)return{image,line,size:value};}
 return null;
}
export function productPreview(value){
 const product=value?.properties?.product??value;if(!product)return '';
 const range=String(product.range??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
 const code=String(product.code??'').trim().toUpperCase();
 const legacyColbert=product.brand==='DMC'&&(product.properties?.threadFamily==='wool'||/lanato|lana colbert|laine colbert/.test(range));
 const legacyAlsace=product.brand==='DMC'&&(product.properties?.threadFamily==='alsace'||/alsac|alsazia/.test(range));
 const size=String(value?.properties?.threadSize??product.properties?.threadSize??range).match(/\d+/)?.[0];
 const legacyPearl=product.brand==='DMC'&&!legacyAlsace&&(product.properties?.threadFamily==='pearl'||/perl|pearl/.test(range));
 const legacyMat=product.brand==='DMC'&&(product.properties?.threadFamily==='mat'||/retors mat/.test(range));
 const profiloCode=product.brand==='Profilo'?code.padStart(3,'0'):'';
 const official=(profiloCode?profilo.images[profilo.byCode[profiloCode]]:'')||diamant[product.id]||colbert[product.id]||alsace[product.id]||mat[product.id]||(legacyMat?mat[`dmc:mat:${code}`]:'')||(legacyAlsace&&size?alsace[`dmc:alsace:${Number(size)}:${code}`]:'')||(legacyPearl&&size?pearl.images[pearl.byKey[`dmc:pearl:${Number(size)}:${code}`]]:'')||((legacyAlsace||legacyPearl)&&size?sameColourSwatch({family:legacyAlsace?'alsace':'pearl',size,code})?.image:'')||(product.brand==='DMC'&&product.range==='Diamant'?diamant[`dmc:diamant:${code}`]:'')||(legacyColbert?colbert[`dmc:colbert:${code}`]:'');if(official)return official;
 const url=product.url||value?.properties?.purchaseUrl;
 const direct=casa.byUrl[urlKey(url)];if(direct)return casa.images[direct]||'';
 if(!product.brand||!product.range||!product.code)return '';
 const digest=exactIdentityPhotos().get(`${product.category}:${supplierIdentity(product)}`);return digest?casa.images[digest]||'':'';
}
export function productPreviewStyle(product){
 const source=productPreview(product);
 return source?{backgroundImage:`url(${source})`,backgroundColor:'#fff',backgroundSize:'contain',backgroundPosition:'center',backgroundRepeat:'no-repeat'}:{};
}
