import {createHash}from'node:crypto';import {expect}from'@playwright/test';
export function isLocalPhoto(style){return /^url\("(?:data:image\/|ricamo:\/\/app\/catalogue-images\/|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/catalogue-images\/)/.test(style);}
/** Assert image identity by its actual bytes, independent of inline/file delivery. */
export async function assertLocalImage(image,dataUrl){
 const expected=createHash('sha256').update(Buffer.from(dataUrl.split(',')[1],'base64')).digest('hex');
 await expect.poll(()=>image.evaluate(async img=>{
  if(!img.src)return '';const url=new URL(img.src,location.href);if(url.protocol!=='data:'&&url.origin!==location.origin)throw Error('Non-local photo');
  const bytes=await(await fetch(img.src)).arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 })).toBe(expected);
}
