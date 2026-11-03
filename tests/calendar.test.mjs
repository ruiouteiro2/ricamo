import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('calendar days survive east/west time zones while timestamps use the local day', () => {
  const calendar = new URL('../core/calendar.mjs', import.meta.url).href;
  // Isolate timezone changes: Windows can retain a TZ runtime cache after env deletion.
  for (const [zone, expected] of [['America/Los_Angeles', '2026-10-26'], ['Pacific/Auckland', '2026-10-27']]) {
    const code = `import assert from 'node:assert/strict';
      import { localDate, displayDate } from ${JSON.stringify(calendar)};
      assert.equal(localDate(displayDate('2026-10-27')), '2026-10-27');
      assert.equal(localDate('2026-10-27T00:30:00Z'), ${JSON.stringify(expected)});
      assert.equal(Number.isNaN(displayDate('2026-02-30').valueOf()), true);`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  }
});
