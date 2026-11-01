<script setup>
import PageHeader from '../components/PageHeader.vue';
import FullBackupPanel from '../components/FullBackupPanel.vue';
import { desktop } from '../storage';
import { t } from '../i18n';
</script>
<template><div class="page"><PageHeader :eyebrow="t('dataCenter')" :title="t('dataCenterTitle')" :description="t('dataCenterHelp')" /><p v-if="!desktop" class="notice warning">{{ t('browserPreviewHelp') }}</p><FullBackupPanel /></div></template>
