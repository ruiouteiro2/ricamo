<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, useId } from 'vue';
import { X } from '@lucide/vue';
import { t, language, errorText, localizeSystemText } from '../i18n';
import { changeLanguage, toast } from '../state';
defineProps({ title: String, wide: Boolean, busy: Boolean });
const emit = defineEmits(['close']);
const dialog = ref();
const titleId = useId(), localeError = ref('');
async function setLanguage(event) {
  try { await changeLanguage(event.target.value); localeError.value = ''; }
  catch (error) { localeError.value = errorText(error); }
}
let previous;
onMounted(async () => {
  previous = document.activeElement;
  dialog.value.showModal();
  window.dispatchEvent(new CustomEvent('ricamo:dialog-opened'));
  await nextTick();
  (dialog.value.querySelector('[autofocus]') || dialog.value.querySelector('input, select, textarea, button'))?.focus();
});
onBeforeUnmount(() => { dialog.value?.close(); window.dispatchEvent(new CustomEvent('ricamo:dialog-closed')); previous?.focus?.(); });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="dialog" :class="{ wide }" :aria-labelledby="titleId" @cancel.prevent="!busy && emit('close')">
      <header class="dialog-heading"><h2 :id="titleId">{{ localizeSystemText(title) }}</h2><div class="actions"><select class="language-switch" :value="language" :aria-label="t('language')" :disabled="busy" @change="setLanguage"><option value="it">IT</option><option value="en">EN</option></select><button class="icon-button" type="button" :aria-label="t('close')" :disabled="busy" @click="emit('close')"><X :size="20" /></button></div></header>
      <div class="dialog-body"><p v-if="localeError" class="notice error" role="alert">{{ localeError }}</p><slot /></div>
      <footer v-if="$slots.footer" class="dialog-footer"><slot name="footer" /></footer>
      <Transition name="toast"><div v-if="toast" class="toast dialog-toast" role="status" aria-live="polite" aria-atomic="true">{{ toast }}</div></Transition>
    </dialog>
  </Teleport>
</template>
