<script setup>
import { inventoryErrorText } from '../inventory-errors.mjs';
import { reactive, ref } from 'vue';
import { Plus, Pencil, X } from '@lucide/vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { state, dispatch, notify } from '../state';
import { t, errorText } from '../i18n';
const emit = defineEmits(['close']);
const draft = reactive({ id: '', name: '', fields: [] });
const error = ref(''), busy = ref(false);
let operationId = crypto.randomUUID();
function edit(category) { Object.assign(draft, { id: category?.id || '', name: category?.name || '', fields: [...(category?.fields || [])] }); operationId = crypto.randomUUID(); error.value = ''; }
async function save() {
  busy.value = true; error.value = '';
  try {
    const fields = draft.fields.map(value => value.trim());
    if (fields.some(value => !value || ['__proto__', 'prototype', 'constructor'].includes(value)) || new Set(fields).size !== fields.length) throw Object.assign(new Error(), { code: 'invalid_custom_fields' });
    await dispatch('category.save', { ...(draft.id ? { id: draft.id } : {}), name: draft.name, fields }, operationId);
    notify(); edit(null);
  } catch (caught) { error.value = inventoryErrorText(caught); }
  finally { busy.value = false; }
}
</script>
<template>
  <AppDialog :title="t('manageCategories')" wide :busy="busy" @close="emit('close')">
    <p class="notice">{{ t('customCategoriesHelp') }}</p><p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <div class="two-columns"><div class="stack"><h3>{{ t('customCategories') }}</h3><p v-if="!state.categories.length" class="muted">{{ t('noCustomCategories') }}</p><button v-for="category in state.categories" :key="category.id" class="button" @click="edit(category)"><Pencil :size="15" />{{ category.name }} · {{ category.fields.length }}</button><button class="button" @click="edit(null)"><Plus :size="15" />{{ t('newCategory') }}</button></div>
      <form @submit.prevent="save"><h3>{{ t(draft.id ? 'editCategory' : 'newCategory') }}</h3><FormField :label="t('categoryName')" required v-slot="{ id }"><input :id="id" v-model="draft.name" required maxlength="200" /></FormField>
        <div class="form-section"><h3>{{ t('customFields') }}</h3><p class="field-help">{{ t('customFieldsHelp') }}</p><div v-for="(_, index) in draft.fields" :key="index" class="inline-row form-section"><input v-model="draft.fields[index]" :aria-label="`${t('fieldName')} ${index + 1}`" required maxlength="100" /><button type="button" class="icon-button" :aria-label="`${t('removeField')} ${index + 1}`" @click="draft.fields.splice(index,1)"><X :size="16" /></button></div><button type="button" class="button small form-section" :disabled="draft.fields.length >= 30" @click="draft.fields.push('')"><Plus :size="14" />{{ t('addField') }}</button></div>
        <button class="button primary form-section" :disabled="busy || !draft.name.trim()" type="submit">{{ t('saveCategory') }}</button>
      </form>
    </div>
    <template #footer><button class="button" :disabled="busy" @click="emit('close')">{{ t('close') }}</button></template>
  </AppDialog>
</template>
