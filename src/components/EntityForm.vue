<script setup>
import { reactive, ref, useId } from 'vue';
import AppDialog from './AppDialog.vue';
import FormField from './FormField.vue';
import { t, errorText, localizeSystemText } from '../i18n';
const props = defineProps({ title: String, fields: Array, initial: Object, submit: Function, wide: Boolean, help: String, confirmLabel: String });
const emit = defineEmits(['close', 'saved']);
const draft = reactive(JSON.parse(JSON.stringify(props.initial || {})));
const busy = ref(false), error = ref('');
const formId = useId();
async function save() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { const result = await props.submit(JSON.parse(JSON.stringify(draft))); if (result !== false) emit('saved'); }
  catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; }
}
</script>
<template>
  <AppDialog :title="title" :wide="wide" :busy="busy" @close="emit('close')">
    <p v-if="help" class="notice">{{ localizeSystemText(help) }}</p>
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <form :id="formId" @submit.prevent="save">
      <div class="form-grid">
        <template v-for="field in fields" :key="field.key">
          <FormField v-if="!field.when || field.when(draft)" :label="localizeSystemText(field.label || t(field.key))" :required="field.required" :help="localizeSystemText(field.help)" :wide="field.wide" v-slot="{ id, describedby }">
            <textarea v-if="field.type === 'textarea'" :id="id" v-model="draft[field.key]" :aria-describedby="describedby" :maxlength="field.max || 20000" />
            <select v-else-if="field.type === 'select'" :id="id" v-model="draft[field.key]" :required="field.required" :aria-describedby="describedby"><option v-if="!field.required" value="">{{ t('none') }}</option><option v-for="option in field.options" :key="option.value ?? option" :value="option.value ?? option">{{ typeof option.label === 'function' ? option.label() : option.label ?? t(option) }}</option></select>
            <input v-else-if="field.type === 'checkbox'" :id="id" v-model="draft[field.key]" type="checkbox" />
            <input v-else :id="id" v-model="draft[field.key]" :type="field.type === 'number' ? 'text' : field.type || 'text'" :inputmode="field.type === 'number' ? 'decimal' : undefined" :required="field.required" :maxlength="field.max || 300" :placeholder="field.placeholder" :aria-describedby="describedby" />
          </FormField>
        </template>
      </div>
    </form>
    <template #footer><button type="button" class="button" :disabled="busy" @click="emit('close')">{{ t('cancel') }}</button><button class="button primary" :form="formId" type="submit" :disabled="busy">{{ busy ? t('saving') : confirmLabel || t('save') }}</button></template>
  </AppDialog>
</template>
