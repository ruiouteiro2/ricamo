<script setup>
import { t } from '../i18n';
import { navigate } from '../state';
import ExampleLauncher from './ExampleLauncher.vue';
</script>
<template><section class="panel"><div class="panel-heading"><h2>{{ t('firstStudioTitle') }}</h2></div><div class="panel-body"><p>{{ t('firstStudioIntro') }}</p><ol><li>{{ t('firstStudioMaterial') }}</li><li>{{ t('firstStudioProject') }}</li><li>{{ t('firstStudioProgress') }}</li></ol><div class="toolbar"><button class="button primary" @click="navigate('materials','new')">{{ t('addMaterial') }}</button><button class="button" @click="navigate('projects','new')">{{ t('newProject') }}</button><ExampleLauncher/></div><p class="field-help">{{ t('firstStudioExampleHelp') }}</p></div></section></template>
