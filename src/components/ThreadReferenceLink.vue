<script setup>
import { ref } from 'vue';
import { ExternalLink } from '@lucide/vue';
import { openPurchaseLink } from '../purchase-link.mjs';
import { t, errorText } from '../i18n';
const props = defineProps({ reference: Object });
const error = ref('');
async function open() {
  error.value = '';
  try { await openPurchaseLink(props.reference.url); }
  catch (caught) { error.value = errorText(caught); }
}
</script>
<template>
  <div v-if="reference" class="field-help thread-reference">
    <span>{{ t('threadReference') }}: {{ reference.name }}</span>
    <button type="button" class="button text small" :aria-label="t('openThreadReference')" @click="open"><ExternalLink :size="14" />{{ reference.source }}</button>
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>
  </div>
</template>
