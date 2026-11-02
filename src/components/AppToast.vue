<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({ message: { type: String, default: '' } });
const toast = ref(null);

async function placeAboveDialogs() {
  await nextTick();
  const element = toast.value;
  if (!element || !props.message) return;
  try {
    if (element.matches(':popover-open')) element.hidePopover();
    element.showPopover();
  } catch {
    // Older embedded browsers still display the fixed fallback element.
  }
}

function dialogOpened() { void placeAboveDialogs(); }

watch(() => props.message, value => {
  if (!value) {
    if (toast.value?.matches(':popover-open')) toast.value.hidePopover();
    return;
  }
  void placeAboveDialogs();
});

onMounted(() => window.addEventListener('ricamo:dialog-opened', dialogOpened));
onBeforeUnmount(() => window.removeEventListener('ricamo:dialog-opened', dialogOpened));
</script>

<template>
  <div ref="toast" class="toast" popover="manual" role="status" aria-live="polite" aria-atomic="true">{{ message }}</div>
</template>
