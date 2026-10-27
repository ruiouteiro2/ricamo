import { generate } from './adapter.mjs';

// A worker handles one synchronous CPU job at a time. Cancellation is termination
// by its owner; only matching request IDs may replace the owner's current result.
self.onmessage = event => {
  const input = event.data;
  if (!input || (typeof input.id !== 'string' && !Number.isSafeInteger(input.id))) {
    self.postMessage({ id: input?.id ?? null, error: { code: 'engine.jobId', details: {} } });
    return;
  }
  try {
    const result = generate(input);
    self.postMessage({ id: input.id, result });
  } catch (error) {
    self.postMessage({ id: input.id, error: { code: typeof error?.code === 'string' ? error.code : 'engine.generationFailed', details: error?.details ?? {} } });
  }
};
