<script setup>
import { ref, computed, onMounted } from 'vue';
import { Download, Upload, DatabaseBackup } from '@lucide/vue';
import { state, restoreBackup } from '../state';
import { storage, desktop } from '../storage';
import { studioStorageKey } from '../example-mode.mjs';
import { backupSummary } from '../../core/backup-summary.mjs';
import { BACKUP_LIMIT } from '../../core/files.mjs';
import { t, date, number, errorText } from '../i18n';
import BackupControls from './BackupControls.vue';
import AppDialog from './AppDialog.vue';
const counts = computed(() => backupSummary(state.value));
const busy = ref(false), error = ref(''), message = ref(''), restore = ref(null), fileInput = ref(), controls = ref(), lastBackup = ref('');
const lastBackupKey = studioStorageKey('ricamo-last-backup');
onMounted(async () => {
  try { lastBackup.value = localStorage.getItem(lastBackupKey) || ''; } catch { /* Backup availability does not depend on display preferences. */ }
  if (desktop) try { const status = await storage.backupStatus(); lastBackup.value = status.lastManual?.date || status.lastLocal?.date || lastBackup.value; } catch (caught) { error.value = errorText(caught); }
});
async function backup() {
  if (busy.value) return;
  busy.value = true; error.value = ''; message.value = '';
  try {
    if (await storage.backup()) {
      lastBackup.value = new Date().toISOString();
      try { localStorage.setItem(lastBackupKey, lastBackup.value); } catch { /* The actual exported backup has already succeeded. */ }
      await controls.value?.refresh(); message.value = t(desktop ? 'fullBackupSaved' : 'fullBackupDownloaded');
    }
  } catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; }
}
async function inspect(event) {
  const file = event.target.files?.[0]; if (!file || busy.value) return;
  busy.value = true; error.value = ''; message.value = '';
  try { if (file.size > BACKUP_LIMIT) throw Object.assign(new Error(), { code: 'file_too_large' }); restore.value = await storage.inspectRestore(await file.text()); }
  catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; event.target.value = ''; }
}
async function confirmRestore() {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { await restoreBackup(restore.value.token); restore.value = null; }
  catch (caught) { error.value = errorText(caught); }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="panel" :aria-label="t('fullBackupTitle')">
    <div class="panel-heading"><h2>{{ t('fullBackupTitle') }}</h2><DatabaseBackup :size="22" /></div>
    <div class="panel-body">
      <p>{{ t('fullBackupScope') }}</p>
      <dl class="backup-contents"><div v-for="(count, key) in counts" :key="key" class="stat-row"><dt>{{ t(`backupCount_${key}`) }}</dt><dd>{{ number(count, 0) }}</dd></div></dl>
      <p class="field-help">{{ t('fullBackupSavedData') }}</p>
      <p v-if="error && !restore" class="notice error" role="alert">{{ error }}</p>
      <p v-if="message" class="notice" role="status">{{ message }}</p>
      <div class="actions form-section"><button class="button primary" :disabled="busy" @click="backup"><Download :size="18" />{{ busy ? t('saving') : t('createBackup') }}</button><button class="button" :disabled="busy" @click="fileInput.click()"><Upload :size="18" />{{ t('restoreBackup') }}</button></div>
      <input ref="fileInput" type="file" accept=".ricamobackup" class="sr-only" :aria-label="t('restoreBackup')" @change="inspect" />
      <div class="stat-row"><span>{{ t('lastBackup') }}</span><strong>{{ lastBackup ? date(lastBackup) : t('never') }}</strong></div>
      <p class="field-help">{{ t('fullBackupFormat') }}</p><p class="field-help">{{ t('backupHelp') }}</p>
      <BackupControls v-if="desktop" ref="controls" />
    </div>
  </section>
  <AppDialog v-if="restore" :title="t('restoreBackup')" :busy="busy" @close="restore=null">
    <p v-if="error" class="notice error" role="alert">{{ error }}</p><p class="notice warning">{{ t('restoreWarning') }}</p>
    <div class="stat-row"><span>{{ t('date') }}</span><strong>{{ date(restore.createdAt) }}</strong></div>
    <div v-for="(value,key) in restore.summary" :key="key" class="stat-row"><span>{{ t(`backupCount_${key}`) }}</span><strong>{{ number(value, 0) }}</strong></div>
    <p class="field-help">{{ t('fullBackupScope') }}</p>
    <template #footer><button class="button" :disabled="busy" @click="restore=null">{{ t('cancel') }}</button><button class="button primary" :disabled="busy" @click="confirmRestore">{{ t('restoreConfirm') }}</button></template>
  </AppDialog>
</template>
