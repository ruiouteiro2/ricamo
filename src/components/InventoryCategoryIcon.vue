<script setup>
defineProps({ group: { type: String, default: 'threads' }, size: { type: [Number, String], default: 24 } });
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :data-inventory-icon="group">
    <g v-if="group === 'threads'" transform="rotate(-28 16 16)">
      <path d="M9 13C6 7 10 3 16 3s10 4 7 10M9 19c-3 6 1 10 7 10s10-4 7-10" />
      <path d="M12 12c-2-4-1-6 1-7m3 0v7m4 0c2-4 1-6-1-7M12 20c-2 4-1 6 1 7m3-7v7m4-7c2 4 1 6-1 7" stroke-width=".9" />
      <rect x="8" y="13" width="16" height="6" rx="1.3" /><path d="M14 16h4M23 25c4 3 5-1 3-2" />
    </g>
    <g v-else-if="group === 'beads'">
      <circle cx="23" cy="8.5" r="5.5" fill="var(--surface, white)" />
      <circle cx="25" cy="25" r="4.5" fill="var(--surface, white)" />
      <circle cx="13" cy="18" r="8.5" fill="var(--surface, white)" />
      <path d="M8.5 16.5a5 5 0 0 1 3.5-3.2M20.5 7.5a2.6 2.6 0 0 1 1.5-1.4M23.3 24.3l.4-.5" stroke-width=".9" />
    </g>
    <g v-else-if="group === 'fabrics'">
      <path d="M5 6c7-3 14-3 21 0v18c-7-3-14-1-21 2V6Z" />
      <path d="M5 6c3-1 5 1 5 4v14m0-14c5-2 10-2 16 0M8 26v3c6-3 12-4 18-2v-3" />
      <path d="M22 13v7" stroke-dasharray="1.4 2.4" />
    </g>
    <g v-else-if="group === 'charts'">
      <rect x="4" y="3" width="24" height="26" rx="2" /><path d="M8 8h16M8 13h16M8 18h16M8 23h16M12 8v15M17 8v15M22 8v15m-9-9 3 3m0-3-3 3" />
    </g>
    <g v-else>
      <circle cx="7" cy="25" r="3.6" /><circle cx="17" cy="25" r="3.6" />
      <path d="m9 22 3-6 3 6M12 16 5 4c0 6 2 10 7 12Zm0 0 9-12c0 6-4 11-9 12Z" />
      <circle cx="12" cy="16" r=".75" fill="currentColor" stroke="none" />
      <path d="m24 28 5-20c.4-2.5-2.4-3-3-.6l-4 19 2 1.6Zm2.7-17 .5-2" />
    </g>
  </svg>
</template>
