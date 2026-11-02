<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

defineProps({ message: { type: String, default: '' } });
const modalDepth = ref(0);

async function syncDialogs() {
  await nextTick();
  modalDepth.value = document.querySelectorAll('dialog[open]').length;
}

onMounted(() => {
  void syncDialogs();
  window.addEventListener('ricamo:dialog-opened', syncDialogs);
  window.addEventListener('ricamo:dialog-closed', syncDialogs);
});
onBeforeUnmount(() => {
  window.removeEventListener('ricamo:dialog-opened', syncDialogs);
  window.removeEventListener('ricamo:dialog-closed', syncDialogs);
});
</script>

<template>
  <Transition name="toast"><div v-if="message && modalDepth === 0" class="toast" role="status" aria-live="polite" aria-atomic="true">{{ message }}</div></Transition>
</template>
