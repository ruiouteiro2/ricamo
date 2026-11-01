<script setup>
defineProps({ group: { type: String, default: 'threads' }, size: { type: [Number, String], default: 24 } });
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :data-inventory-icon="group">
    <g v-if="group === 'threads'" transform="rotate(-35 16 16)">
      <ellipse cx="16" cy="16" rx="8" ry="13" />
      <path d="M14 3c-5 5-5 21 0 26M18 3c5 5 5 21 0 26M16 3v10m0 6v10" />
      <path d="M8 12.5h16v7H8z" fill="var(--surface, white)" /><path d="m13 14 6 4m0-4-6 4" />
    </g>
    <g v-else-if="group === 'beads'">
      <circle cx="16" cy="16" r="12" /><circle cx="16" cy="16" r="2.2" />
      <path d="M8.5 12a8.5 8.5 0 0 1 5-4M23.5 20a8.5 8.5 0 0 1-5 4" />
    </g>
    <g v-else-if="group === 'fabrics'">
      <path d="M5 5h18l5 5v17c-4-2-7 2-11 0s-8 2-12 0V5Z" /><path d="M23 5v6h5M9 11h9M9 16h14M9 21h14M12 9v15M18 9v15M23 15v9" />
    </g>
    <g v-else>
      <circle cx="6.5" cy="24" r="3.5" /><circle cx="16" cy="25" r="3.5" />
      <path d="M8.5 21 20 5c1 6-3 12-7 15m1 2L4 5c0 7 4 13 8 15" />
      <path d="m23 28 6-20c.5-2-2-3-3-.8L21 26l2 2Zm3-17 1-3" />
    </g>
  </svg>
</template>
