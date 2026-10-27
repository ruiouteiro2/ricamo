import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBrowserTests } from './run-browser.mjs';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ricamo-runner-'));
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'dist/index.html'), '<!doctype html><title>Runner fixture</title>Production fixture');
  return root;
}
const closed = async url => { await assert.rejects(() => fetch(url, { signal: AbortSignal.timeout(2000) })); };
test('Runner owns an ephemeral production preview, executes sequentially and closes it', async () => {
  const root = await fixture(); let url;
  try {
    await writeFile(join(root, 'one.mjs'), `import {writeFile} from 'node:fs/promises';const response=await fetch(process.env.RICAMO_TEST_URL);if(!(await response.text()).includes('Production fixture'))process.exit(9);await writeFile('sequence','first');`);
    await writeFile(join(root, 'two.mjs'), `import {readFile,writeFile} from 'node:fs/promises';if(await readFile('sequence','utf8')!=='first')process.exit(8);await writeFile('sequence','second');`);
    await runBrowserTests({ root, scripts: ['one.mjs', 'two.mjs'], buildFrontend: false, onReady: value => { url = value; } });
    assert.equal(await readFile(join(root, 'sequence'), 'utf8'), 'second');
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/); await closed(url);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('Runner propagates a failed child exit, does not run later tests and closes preview', async () => {
  const root = await fixture(); let url;
  try {
    await writeFile(join(root, 'fail.mjs'), 'process.exit(7);');
    await writeFile(join(root, 'later.mjs'), `import {writeFile} from 'node:fs/promises';await writeFile('should-not-exist','bad');`);
    await assert.rejects(() => runBrowserTests({ root, scripts: ['fail.mjs', 'later.mjs'], buildFrontend: false, onReady: value => { url = value; } }), { exitCode: 7 });
    await assert.rejects(() => readFile(join(root, 'should-not-exist'))); await closed(url);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('Runner interruption terminates the owned child and closes preview', async () => {
  const root = await fixture(), controller = new AbortController(); let url, timer;
  try {
    await writeFile(join(root, 'wait.mjs'), 'setInterval(()=>{},1000);');
    await assert.rejects(() => runBrowserTests({ root, scripts: ['wait.mjs'], buildFrontend: false, signal: controller.signal, onReady: value => { url = value; timer = setTimeout(() => controller.abort(new Error('Synthetic cancellation')), 100); } }), /Synthetic cancellation/);
    await closed(url);
  } finally { clearTimeout(timer); await rm(root, { recursive: true, force: true }); }
});
