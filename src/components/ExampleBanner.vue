<script setup>
import { t } from '../i18n';
import { requestExampleClose } from '../example-mode.mjs';
</script>
<template><section class="panel panel-body" :aria-label="t('exampleStudio')"><div class="toolbar"><strong class="badge warning">{{ t('exampleStudio') }}</strong><button class="button small" @click="requestExampleClose">{{ t('returnToMyStudio') }}</button></div><p class="field-help">{{ t('exampleIsolationHelp') }}</p></section></template>
