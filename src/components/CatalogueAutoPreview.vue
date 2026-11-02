<script setup>
import { computed } from 'vue';
import { Image as ImageIcon } from '@lucide/vue';
import { productPreview } from '../product-previews.mjs';
import { t } from '../i18n';
const props = defineProps({ product: Object, color: String, code: String, busy: Boolean, ambiguous: Boolean, error: String, optionsCount: Number, sameColour: Object });
const hasCode = computed(() => Boolean(String(props.code || '').trim()));
const photo = computed(() => productPreview(props.product) || props.sameColour?.image || '');
const colour = computed(() => (hasCode.value || props.product) ? props.color || props.product?.hex || '' : '');
const title = computed(() => props.product ? [props.product.brand, props.product.range, props.product.code].filter(Boolean).join(' · ') || props.product.name : hasCode.value ? props.code : t('cataloguePreviewTitle'));
const message = computed(() => {
  if (props.product) return photo.value || colour.value ? props.product.colorName || t('cataloguePreviewMatched') : t('cataloguePreviewUnavailable');
  if (props.ambiguous && !props.busy) return t('catalogueCodeAmbiguous');
  if (props.busy) return t('loading');
  if (!hasCode.value) return t('cataloguePreviewPrompt');
  if (props.sameColour) return props.sameColour.otherLine ? t('cataloguePreviewOtherLine', { line: props.sameColour.lineLabel, size: props.sameColour.size }) : t('cataloguePreviewOtherSize', { size: props.sameColour.size });
  if (colour.value) return t('cataloguePaletteOnly');
  if (props.error) return t('cataloguePreviewUnavailable');
  return props.optionsCount ? t('cataloguePreviewChoose') : t('catalogueCodeNotFound');
});
</script>
<template>
  <section class="catalogue-auto-preview" :aria-label="t('cataloguePreviewTitle')" aria-live="polite" :aria-busy="busy">
    <div v-if="photo" class="catalogue-auto-preview-media"><img :src="photo" :alt="product?.name || code" /></div>
    <div v-else-if="colour" class="catalogue-auto-preview-media catalogue-auto-preview-colour" :style="{ backgroundColor: colour }" aria-hidden="true"></div>
    <div v-else class="catalogue-auto-preview-placeholder" aria-hidden="true"><ImageIcon :size="26" /></div>
    <div class="catalogue-auto-preview-copy"><strong>{{ title }}</strong><p class="field-help">{{ message }}</p></div>
  </section>
</template>
