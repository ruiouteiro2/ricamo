import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue';

/** Variable-height windowing keeps continuous inventory lists small without pagination. */
export function useVirtualInventory(entries, container, options={}) {
  const scroll = ref(0), viewport = ref(600), sizes = ref(new Map());
  const key = options.key??(row => row.material ? `material:${row.material.id}` : `catalogue:${row.product.id}`), estimate=options.estimate??72;
  const offsets = computed(() => {
    const values = [0];
    for (const row of entries.value) values.push(values.at(-1) + (sizes.value.get(key(row)) || estimate));
    return values;
  });
  const range = computed(() => {
    if (entries.value.length <= 80) return { start: 0, end: entries.value.length };
    const values = offsets.value;
    const find = position => {
      let low = 0, high = entries.value.length;
      while (low < high) { const mid = (low + high) >>> 1; if (values[mid + 1] <= position) low = mid + 1; else high = mid; }
      return low;
    };
    return { start: Math.max(0, find(scroll.value) - 8), end: Math.min(entries.value.length, find(scroll.value + viewport.value) + 9) };
  });
  const rows = computed(() => entries.value.slice(range.value.start, range.value.end));
  const before = computed(() => offsets.value[range.value.start]);
  const after = computed(() => offsets.value.at(-1) - offsets.value[range.value.end]);
  function update() {
    const element = container.value;
    if (!element) return;
    scroll.value = Math.max(0, element.scrollTop - (element.querySelector('thead')?.offsetHeight || 0));
    viewport.value = element.clientHeight;
  }
  let observer, viewportObserver;
  async function observe() {
    await nextTick();
    observer?.disconnect();
    if (!container.value) return;
    viewportObserver ??= new ResizeObserver(update);
    viewportObserver.disconnect();
    viewportObserver.observe(container.value);
    observer ??= new ResizeObserver(records => {
      const next = new Map(sizes.value); let changed = false;
      for (const record of records) {
        const id = record.target.dataset.inventoryRow, height = record.borderBoxSize?.[0]?.blockSize || record.target.getBoundingClientRect().height;
        if (height > 0 && Math.abs((next.get(id) || estimate) - height) > .5) { next.set(id, height); changed = true; }
      }
      if (changed) sizes.value = next;
      update();
    });
    for (const row of container.value.querySelectorAll('tr[data-inventory-row]')) observer.observe(row);
    update();
  }
  watch([rows, container], observe, { flush: 'post' });
  watch(entries, () => { sizes.value = new Map(); update(); });
  onBeforeUnmount(() => { observer?.disconnect(); viewportObserver?.disconnect(); });
  return { rows, before, after, update };
}
