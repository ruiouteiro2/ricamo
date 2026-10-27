<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { X } from '@lucide/vue';
import { t } from '../i18n';
defineProps({ title: String, wide: Boolean, busy: Boolean });
const emit = defineEmits(['close']);
const dialog = ref();
let previous;
onMounted(async () => {
  previous = document.activeElement;
  dialog.value.showModal();
  await nextTick();
  dialog.value.querySelector('[autofocus], input, select, textarea, button')?.focus();
});
onBeforeUnmount(() => { dialog.value?.close(); previous?.focus?.(); });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="dialog" :class="{ wide }" aria-labelledby="dialog-title" @cancel.prevent="!busy && emit('close')">
      <header class="dialog-heading"><h2 id="dialog-title">{{ title }}</h2><button class="icon-button" type="button" :aria-label="t('close')" :disabled="busy" @click="emit('close')"><X :size="20" /></button></header>
      <div class="dialog-body"><slot /></div>
      <footer v-if="$slots.footer" class="dialog-footer"><slot name="footer" /></footer>
    </dialog>
  </Teleport>
</template>
