import { statfsSync } from 'node:fs';
import { DomainError } from '../core/shared.mjs';

export const DISK_RESERVE_BYTES=1024*1024;
/** A conservative preflight; writes still need rollback if free space changes. */
export function ensureDiskSpace(directory,requiredBytes,readSpace=statfsSync) {
  if(!Number.isSafeInteger(requiredBytes)||requiredBytes<0)throw new DomainError('invalid_payload');
  let available;
  try {
    const stats=readSpace(directory,{bigint:true});
    if(stats.bsize<=0n||stats.bavail<0n)throw new Error('Unavailable space estimate');
    available=stats.bsize*stats.bavail;
  } catch {throw new DomainError('disk_space_unavailable');}
  const required=BigInt(requiredBytes)+BigInt(DISK_RESERVE_BYTES);
  if(available<required)throw new DomainError('insufficient_disk_space',{requiredBytes:Number(required),availableBytes:Number(available)});
  return {requiredBytes:Number(required),availableBytes:Number(available)};
}
