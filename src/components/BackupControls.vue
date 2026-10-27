<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { storage } from '../storage';
import { t, date, errorText } from '../i18n';
import FormField from './FormField.vue';
const status = ref(null), busy = ref(false), error = ref(''), dirty = ref(false);
const draft = reactive({ enabled: true, intervalMinutes: 30, retention: 7 });
let timer;
async function refresh() {
  try {
    status.value = await storage.backupStatus();
    if (!dirty.value) for (const key of Object.keys(draft)) draft[key] = status.value[key];
  } catch (caught) { error.value = errorText(caught); }
}
async function action(run) {
  busy.value = true; error.value = '';
  try { status.value = await run(); }
  catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; await refresh(); }
}
async function save() {
  await action(async () => { const result = await storage.configureBackup({ enabled: draft.enabled, intervalMinutes: Number(draft.intervalMinutes), retention: Number(draft.retention) }); dirty.value = false; return result; });
}
onMounted(() => { refresh(); timer = setInterval(refresh, 10000); });
onBeforeUnmount(() => clearInterval(timer));
defineExpose({ refresh });
</script>
<template>
  <div class="form-section" v-if="status">
    <h3>{{ t('automaticBackups') }}</h3>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <p v-if="status.lastError" class="notice warning" role="status">{{ status.lastError.code === 'external_backup_failed' ? t('externalBackupFailed') : t('backupStorageFailed') }} <span class="cell-subtitle" style="overflow-wrap:anywhere">{{ status.lastError.destination }}</span></p>
    <form @submit.prevent="save" @input="dirty = true" @change="dirty = true">
      <label class="checkbox-label"><input v-model="draft.enabled" type="checkbox" />{{ t('enableAutomaticBackup') }}</label>
      <div class="form-grid" style="margin-top:16px">
        <FormField :label="t('backupInterval')" v-slot="{ id }"><select :id="id" v-model.number="draft.intervalMinutes"><option v-for="minutes in [5,15,30,60,180,360,720,1440]" :key="minutes" :value="minutes">{{ minutes }} {{ t('minutes') }}</option></select></FormField>
        <FormField :label="t('backupRetention')" v-slot="{ id }"><input :id="id" v-model.number="draft.retention" type="number" min="1" max="100" required /></FormField>
      </div>
      <button class="button small" type="submit" :disabled="busy || !dirty" style="margin-top:14px">{{ t('save') }}</button>
    </form>
    <div class="stat-row" style="margin-top:16px"><span>{{ t('localBackup') }}</span><strong>{{ status.lastLocal ? date(status.lastLocal.date) : t('never') }}</strong></div>
    <p class="field-help mono" style="overflow-wrap:anywhere">{{ status.localDirectory }}</p>
    <div class="stat-row"><span>{{ t('externalBackup') }}</span><strong>{{ status.lastExternal ? date(status.lastExternal.date) : t('never') }}</strong></div>
    <p class="field-help mono" style="overflow-wrap:anywhere">{{ status.externalDirectory || t('noBackupFolder') }}</p>
    <div class="actions" style="flex-wrap:wrap;margin:14px 0">
      <button class="button small" :disabled="busy" @click="action(() => storage.chooseBackupFolder(false))">{{ t('chooseBackupFolder') }}</button>
      <button v-if="status.externalDirectory" class="button small" :disabled="busy" @click="action(() => storage.chooseBackupFolder(true))">{{ t('disconnectBackupFolder') }}</button>
      <button class="button small" :disabled="busy || status.running" @click="action(() => storage.runBackup())">{{ busy || status.running ? t('saving') : t('backupNow') }}</button>
    </div>
    <p class="notice">{{ t('sameDiskBackupHelp') }}</p>
    <p v-if="status.lastManual" class="field-help" style="overflow-wrap:anywhere">{{ t('manualBackupDestination') }}: {{ status.lastManual.destination }} · {{ date(status.lastManual.date) }}</p>
  </div>
</template>
