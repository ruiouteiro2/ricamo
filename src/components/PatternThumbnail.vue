<script setup>
import { ref, watch, nextTick } from 'vue';
import { drawThumbnail } from '../pattern-thumbnail.mjs';
const props = defineProps({ revision: Object, label: String });
const canvas = ref();
watch(() => props.revision, async revision => {
  await nextTick();
  if (!revision || !canvas.value) return;
  drawThumbnail(canvas.value, revision);
}, { immediate: true });
</script>
<template><canvas v-if="revision" ref="canvas" role="img" :aria-label="label || `${revision.width} × ${revision.height}`" /></template>
