<script setup>
defineProps({ icon: [Object, Function], title: String, description: String, compact: Boolean });
</script>
<template>
  <div class="empty-state" :class="{ compact }"><div v-if="icon" class="empty-icon"><component :is="icon" :size="30" :stroke-width="1.3" /></div><h3>{{ title }}</h3><p v-if="description">{{ description }}</p><div v-if="$slots.default" class="empty-actions"><slot /></div></div>
</template>
