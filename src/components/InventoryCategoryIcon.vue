<script setup>
import { useId } from 'vue';
const iconId = useId();
defineProps({ group: { type: String, default: 'threads' }, size: { type: [Number, String], default: 24 } });
</script>
<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" :data-inventory-icon="group">
    <defs>
      <linearGradient :id="`${iconId}-thread`" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#714555" /><stop offset=".3" stop-color="#b8798b" /><stop offset=".55" stop-color="#d39aa5" /><stop offset="1" stop-color="#744552" />
      </linearGradient>
      <linearGradient :id="`${iconId}-band`" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#fff3d4" /><stop offset=".55" stop-color="#eed5a3" /><stop offset="1" stop-color="#cda96e" />
      </linearGradient>
      <radialGradient :id="`${iconId}-pearl`" cx="30%" cy="25%" r="80%">
        <stop stop-color="#ffffff" /><stop offset=".33" stop-color="#fff9ef" /><stop offset=".62" stop-color="#e9dfdc" /><stop offset=".84" stop-color="#c1aeb9" /><stop offset="1" stop-color="#8e7b8b" />
      </radialGradient>
    </defs>
    <g v-if="group === 'threads'" transform="rotate(-28 16 16)">
      <path d="M22 25c2 5 6 5 6 1" stroke="#8f5b6c" stroke-width="1.15" />
      <path d="M9 5C11 1 21 1 23 5c2 5-1 8-1 11s3 7 1 11c-2 4-12 4-14 0-2-4 1-8 1-11S7 9 9 5Z" :fill="`url(#${iconId}-thread)`" stroke="#744552" stroke-width=".8" />
      <g fill="none" stroke-width=".7">
        <path d="M11 5c-2 4 1 8 1 11s-3 8-1 11M14 4c-2 5 0 8 0 12s-2 8 0 12M17 4v24M20 4c2 5 0 8 0 12s2 8 0 12" stroke="#f0b9c3" />
        <path d="M12 5c-1 4 1 8 1 11s-2 8-1 11M15.5 4v24M19 4c1 5-1 8-1 12s2 8 1 12M22 6c1 4-2 7-2 10s3 7 2 10" stroke="#895161" />
      </g>
      <path d="M8.5 12.5c4 1 11 1 15 0v7c-4 1-11 1-15 0Z" :fill="`url(#${iconId}-band)`" stroke="#b08a50" stroke-width=".7" />
      <path d="M10 14.2c4 .7 8 .7 12 0M10 18c4 .7 8 .7 12 0" stroke="#fff6df" stroke-width=".6" />
      <path d="M14 16h4" stroke="#8e6c42" stroke-width="1" />
    </g>
    <g v-else-if="group === 'beads'" stroke-width=".65" stroke="#a28c99">
      <ellipse cx="17" cy="29" rx="11" ry="1.4" fill="#6f566a" fill-opacity=".1" stroke="none" />
      <circle cx="21.5" cy="9" r="6.5" :fill="`url(#${iconId}-pearl)`" />
      <circle cx="25" cy="23.5" r="5" :fill="`url(#${iconId}-pearl)`" />
      <circle cx="13.5" cy="18.5" r="10" :fill="`url(#${iconId}-pearl)`" />
      <path d="M7.2 16a7.2 7.2 0 0 1 4-4.3M18.2 6.5l1-.6M22.7 21.6l.8-.4" stroke="#fff" stroke-width="1.5" />
      <ellipse cx="10.8" cy="13.2" rx="1.6" ry="1" transform="rotate(-32 10.8 13.2)" fill="#fff" stroke="none" />
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
