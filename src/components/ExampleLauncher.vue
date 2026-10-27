<script setup>
import { ref } from 'vue';
import { BookOpen } from '@lucide/vue';
import { storage } from '../storage';
import { exampleMode } from '../example-mode.mjs';
import { t, language, errorText } from '../i18n';
const busy = ref(false), error = ref('');
async function open() { if (busy.value) return; busy.value = true; error.value = ''; try { await storage.openExample(language.value); } catch (caught) { error.value = errorText(caught); } finally { busy.value = false; } }
</script>
<template><div v-if="!exampleMode"><button class="button" :disabled="busy" @click="open"><BookOpen :size="17"/>{{ t('openExampleStudio') }}</button><p v-if="error" class="notice error" role="alert">{{ error }}</p></div></template>
