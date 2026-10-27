<script setup>
import { ref, watch, nextTick } from 'vue';
import { drawPattern } from '../pattern-render.mjs';
const props = defineProps({ revision: Object, label: String });
const canvas = ref();
watch(() => props.revision, async revision => {
  await nextTick();
  if (!revision || !canvas.value) return;
  const cellSize = Math.min(420 / revision.width, 260 / revision.height);
  drawPattern(canvas.value, revision, { cellSize, width: revision.width * cellSize, height: revision.height * cellSize });
}, { immediate: true });
</script>
<template><canvas v-if="revision" ref="canvas" role="img" :aria-label="label || `${revision.width} × ${revision.height}`" /></template>
