<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({ message: { type: String, default: '' } });
const toast = ref(null);

async function placeAboveDialogs() {
  await nextTick();
  const element = toast.value;
  if (!element || !props.message) return;
  try {
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    const host = dialogs.at(-1) || document.body;
    if (element.matches(':popover-open')) element.hidePopover();
    if (element.parentElement !== host) host.appendChild(element);
    element.showPopover();
  } catch {
    // Older embedded browsers still display the fixed fallback element.
  }
}

function dialogOpened() { void placeAboveDialogs(); }
function dialogClosed() { void placeAboveDialogs(); }

watch(() => props.message, value => {
  if (!value) {
    if (toast.value?.matches(':popover-open')) toast.value.hidePopover();
    return;
  }
  void placeAboveDialogs();
});

onMounted(() => {
  window.addEventListener('ricamo:dialog-opened', dialogOpened);
  window.addEventListener('ricamo:dialog-closed', dialogClosed);
});
onBeforeUnmount(() => {
  window.removeEventListener('ricamo:dialog-opened', dialogOpened);
  window.removeEventListener('ricamo:dialog-closed', dialogClosed);
});
</script>

<template>
  <div ref="toast" class="toast" popover="manual" role="status" aria-live="polite" aria-atomic="true">{{ message }}</div>
</template>
