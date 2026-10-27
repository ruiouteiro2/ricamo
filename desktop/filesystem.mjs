import { open, readFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/** Validate and flush a temporary sibling before publishing the chosen filename. */
export async function atomicWrite(path, content, validate) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx');
    await handle.writeFile(content);
    await handle.sync();
    await handle.close(); handle = null;
    if (validate) await validate(await readFile(temporary));
    await rename(temporary, path);
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
