<script setup>
import { inventoryErrorText } from '../inventory-errors.mjs';
import { ref, reactive } from 'vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { state, dispatch, notify } from '../state';
import { t, errorText, number } from '../i18n';
import { previewBulkMaterials } from '../../core/inventory-workflows.mjs';
const props = defineProps({ ids: Array });
const emit = defineEmits(['close', 'saved']);
const enabled = reactive({ brand: false, range: false, minimum: false, favorite: false, tags: false, notes: false });
const draft = reactive({ brand: '', range: '', minimum: '', favorite: true, tags: '', notes: '' });
const preview = ref(null), payload = ref(null), error = ref(''), busy = ref(false);
let operationId = crypto.randomUUID();
function review() {
  error.value = '';
  try {
    const changes = Object.fromEntries(Object.keys(enabled).filter(key => enabled[key]).map(key => [key, key === 'tags' ? draft.tags.split(',').map(value => value.trim()).filter(Boolean) : draft[key]]));
    payload.value = { ids: [...props.ids], changes, previewRevision: state.value.revision };
    preview.value = previewBulkMaterials(state.value, payload.value); operationId = crypto.randomUUID();
  } catch (caught) { error.value = inventoryErrorText(caught); }
}
function display(value) { return value === null ? t('unknown') : typeof value === 'boolean' ? t(value ? 'yes' : 'no') : Array.isArray(value) ? value.join(', ') || '—' : value === '' ? '—' : String(value); }
async function confirm() {
  busy.value = true; error.value = '';
  try { await dispatch('material.bulk', payload.value, operationId); notify(); emit('saved'); }
  catch (caught) { error.value = inventoryErrorText(caught); if (caught.code === 'inventory_preview_stale') preview.value = null; }
  finally { busy.value = false; }
}
</script>
<template>
  <AppDialog :title="t('bulkEdit')" wide :busy="busy" @close="emit('close')">
    <p class="notice">{{ t('bulkEditHelp', { count: ids.length }) }}</p><p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <div v-if="!preview" class="stack"><div v-for="key in Object.keys(enabled)" :key="key" class="form-section"><label class="checkbox-label"><input v-model="enabled[key]" type="checkbox" />{{ t('changeField', { field: t(key) }) }}</label><FormField v-if="enabled[key]" :label="t(key)" :help="['tags','notes'].includes(key) ? t('bulkReplaceHelp') : ''" v-slot="{ id }"><textarea v-if="key === 'notes'" :id="id" v-model="draft[key]" maxlength="20000" /><select v-else-if="key === 'favorite'" :id="id" v-model="draft[key]"><option :value="true">{{ t('yes') }}</option><option :value="false">{{ t('no') }}</option></select><input v-else :id="id" v-model="draft[key]" :inputmode="key === 'minimum' ? 'decimal' : undefined" :maxlength="key === 'tags' ? 20000 : 200" /></FormField></div></div>
    <template v-else><h3>{{ t('bulkPreview', { count: preview.rows.length }) }}</h3><div class="table-wrap"><table><thead><tr><th>{{ t('name') }}</th><th>{{ t('fieldName') }}</th><th>{{ t('before') }}</th><th>{{ t('after') }}</th></tr></thead><tbody><template v-for="row in preview.rows" :key="row.id"><tr v-for="change in row.changes" :key="change.key"><td>{{ row.name }}</td><td>{{ t(change.key) }}</td><td>{{ display(change.before) }}</td><td>{{ display(change.after) }}</td></tr></template></tbody></table></div></template>
    <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button v-if="preview" class="button" :disabled="busy" @click="preview = null">{{ t('back') }}</button><button v-if="!preview" class="button primary" :disabled="!Object.values(enabled).some(Boolean)" @click="review">{{ t('previewChanges') }}</button><button v-else class="button primary" :disabled="busy" @click="confirm">{{ t('confirmBulk') }}</button></template>
  </AppDialog>
</template>
