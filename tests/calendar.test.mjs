import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, displayDate } from '../core/calendar.mjs';
test('calendar days survive east/west time zones while timestamps use the local day', () => {
  const original = process.env.TZ;
  try {
    // Synchronous scope: restore the process setting before any other test runs.
    for (const [zone, expected] of [['America/Los_Angeles','2026-10-26'],['Pacific/Auckland','2026-10-27']]) {
      process.env.TZ = zone;
      assert.equal(localDate(displayDate('2026-10-27')), '2026-10-27');
      assert.equal(localDate('2026-10-27T00:30:00Z'), expected);
      assert.equal(Number.isNaN(displayDate('2026-02-30').valueOf()), true);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
