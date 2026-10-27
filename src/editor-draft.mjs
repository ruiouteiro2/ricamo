/** Tracks acknowledgement of edit generations without watching/serializing the
 * whole chart on each pointer move. At most one snapshot write is in flight. */
export function createDraftAutosave({ snapshot, save, discard, onStatus, delay = 750 }) {
  let generation = 0, acknowledged = 0, timer, inFlight = null, disposed = false;
  let hasDraft = false, savedAt = null, error = null;
  const status = () => ({ pending: generation !== acknowledged, saving: Boolean(inFlight), hasDraft, savedAt, error });
  const emit = () => { if (!disposed) onStatus(status()); };
  const clear = () => { clearTimeout(timer); timer = null; };
  function schedule() { clear(); if (!disposed && generation !== acknowledged) timer = setTimeout(() => { flush(false).catch(() => {}); }, delay); }
  async function write() {
    const ticket = generation, value = snapshot();
    const operation = Promise.resolve().then(() => save(value)).then(result => {
      acknowledged = ticket; hasDraft = true; savedAt = result.updatedAt; error = null;
    }).catch(caught => { error = caught; throw caught; });
    inFlight = operation; emit();
    try { await operation; }
    finally { if (inFlight === operation) inFlight = null; emit(); }
  }
  async function flush(all = true) {
    clear();
    try {
      if (inFlight) await inFlight;
      while (!disposed && generation !== acknowledged) { if (inFlight) await inFlight; else await write(); if (!all) break; }
      if (generation !== acknowledged) schedule();
      return status();
    } catch (caught) { error = caught; emit(); throw caught; }
  }
  return {
    get status() { return status(); },
    changed() { if (disposed) return; generation++; emit(); schedule(); },
    flush,
    reset(value = {}) { clear(); generation = 0; acknowledged = 0; hasDraft = Boolean(value.hasDraft); savedAt = value.savedAt ?? null; error = null; emit(); },
    async discard() {
      clear();
      if (inFlight) { try { await inFlight; } catch { /* Discard may recover from a failed write. */ } }
      try { await discard(); generation = acknowledged = 0; hasDraft = false; savedAt = null; error = null; emit(); }
      catch (caught) { error = caught; emit(); throw caught; }
    },
    dispose() { clear(); disposed = true; },
  };
}
