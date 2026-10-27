<script setup>
import { useId } from 'vue';
defineProps({ label: String, help: String, required: Boolean, wide: Boolean });
const id = useId();
</script>
<template>
  <div class="field" :class="{ 'field-wide': wide }">
    <label :for="id">{{ label }}<span v-if="required" aria-hidden="true"> *</span></label>
    <slot :id="id" :describedby="help ? `${id}-help` : undefined" />
    <p v-if="help" :id="`${id}-help`" class="field-help">{{ help }}</p>
  </div>
</template>
