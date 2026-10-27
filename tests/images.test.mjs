import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage } from '../core/image-metadata.mjs';
import { detectFile, base64ToBytes } from '../core/files.mjs';
import { Repository } from '../desktop/repository.mjs';
// PNG/JPEG/WebP were encoded from a 2×3 canvas by Chromium; GIF is a 1×1 image.
const fixtures = {"png": "iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAFElEQVR4AWKaFpDyH4SZGKAAzgAAAAD//8w4Ez8AAAAGSURBVAMAZg0EmU1IvgYAAAAASUVORK5CYII=", "jpeg": "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAADAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCeACVh/9k=", "webp": "UklGRhICAABXRUJQVlA4WAoAAAAgAAAAAQAAAgAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggJAAAAHABAJ0BKgIAAwABQCYloAJ0AUAAAP7tBl+3/xDn9bf9ymsQAA==", "gif": "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"};
const image = kind => Uint8Array.from(Buffer.from(fixtures[kind], 'base64'));
test('real image containers expose bounded dimensions and keep their original MIME', () => {
  for (const kind of Object.keys(fixtures)) {
    const bytes = image(kind), mime = `image/${kind}`;
    assert.equal(detectFile(bytes), mime);
    assert.deepEqual(inspectImage(bytes, mime), kind === 'gif' ? {width:1,height:1,frames:1} : {width:2,height:3,frames:1});
    assert.throws(() => detectFile(bytes.subarray(0, Math.floor(bytes.length / 2))), {code:'invalid_image'});
  }
});
test('oversized pixel claims are rejected before decoding and before an asset transaction', () => {
  const png = image('png'); new DataView(png.buffer).setUint32(16, 30000);
  const jpeg = image('jpeg');
  const frame = jpeg.findIndex((value,index)=>value===255 && [192,194].includes(jpeg[index+1])); assert.ok(frame>0);
  new DataView(jpeg.buffer).setUint16(frame+7,30000);
  const gif = image('gif'); new DataView(gif.buffer).setUint16(6,30000,true);
  const repo = new Repository(':memory:');
  try { for (const [index,bytes] of [png,jpeg,gif].entries()) {
    assert.throws(()=>detectFile(bytes),{code:'image_dimensions_too_large'});
    assert.throws(()=>repo.importAsset({name:`bad-${index}.png`,data:bytes,operationId:`bad-${index}`},0),{code:'image_dimensions_too_large'});
    assert.equal(repo.load().revision,0);assert.equal(repo.load().attachments.length,0);
  } } finally {repo.close();}
});
test('animation budgets count the full canvas per frame and reject truncated blocks', () => {
  const gif=image('gif'), start=gif.indexOf(44), frame=gif.subarray(start,gif.length-1);
  const animated=count=>Uint8Array.from(Buffer.concat([gif.subarray(0,start),...Array(count).fill(frame),Buffer.from([59])]));
  assert.equal(inspectImage(animated(2),'image/gif').frames,2);
  assert.throws(()=>detectFile(animated(201)),{code:'image_animation_too_large'});
  const large=animated(101), view=new DataView(large.buffer);view.setUint16(6,1000,true);view.setUint16(8,1000,true);
  assert.throws(()=>detectFile(large),{code:'image_animation_too_large'});
  const webp=image('webp');new DataView(webp.buffer).setUint32(16,0xffffffff,true);
  assert.throws(()=>detectFile(webp),{code:'invalid_image'});
});
test('backup asset base64 must be canonical and bounded',()=>{
  assert.deepEqual(base64ToBytes(fixtures.png),image('png'));
  for(const invalid of ['A','AA','AB==','AAAA=','AAAA!!!!','']) assert.throws(()=>base64ToBytes(invalid),{code:'invalid_file_data'});
});
