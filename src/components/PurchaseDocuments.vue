<script setup>
import { computed,ref } from 'vue';
import AppDialog from './AppDialog.vue';
import AttachmentEditorDialog from './AttachmentEditorDialog.vue';
import AttachmentList from './AttachmentList.vue';
import { state,notify } from '../state';
import { t,number,date,money } from '../i18n';
const props=defineProps({purchaseId:{type:String,required:true}}),emit=defineEmits(['close']);
const editing=ref(null),page=ref(1),purchase=computed(()=>state.value.purchases.find(row=>row.id===props.purchaseId));
const material=computed(()=>state.value.materials.find(row=>row.id===purchase.value?.materialId));
const receipts=computed(()=>state.value.receipts.filter(row=>row.purchaseId===props.purchaseId).toReversed());
const pages=computed(()=>Math.max(1,Math.ceil(receipts.value.length/10)));
const visibleReceipts=computed(()=>receipts.value.slice((Math.min(page.value,pages.value)-1)*10,Math.min(page.value,pages.value)*10));
function add(type,owner){editing.value={type,ownerId:owner.id,attachmentIds:owner.attachments||[]};}
</script>
<template><AppDialog :title="t('purchaseDocuments')" wide @close="emit('close')"><p class="notice">{{ t('purchaseDocumentsHelp') }}</p><section v-if="purchase" class="form-section"><div class="panel-heading"><div><h3>{{ t('invoiceDocuments') }}</h3><p>{{ material?.name }} · {{ purchase.id }}</p></div><button class="button" @click="add('purchase.attach',purchase)">{{ t('addInvoiceDocument') }}</button></div><AttachmentList :ids="purchase.attachments||[]"/><p v-if="!purchase.attachments?.length" class="field-help">{{ t('noDocuments') }}</p></section><section v-for="receipt in visibleReceipts" :key="receipt.id" class="form-section"><div class="panel-heading"><div><h3>{{ t('receiptDocuments') }} · {{ date(receipt.date) }}</h3><p>{{ number(receipt.quantity,6) }} {{ t(`unit_${receipt.unit}`) }} · {{ money(receipt.cost,receipt.currency) }}</p><small class="mono">{{ receipt.id }}</small></div><button class="button" :aria-label="`${t('addReceiptDocument')}: ${receipt.id}`" @click="add('receipt.attach',receipt)">{{ t('addReceiptDocument') }}</button></div><AttachmentList :ids="receipt.attachments||[]"/><p v-if="!receipt.attachments?.length" class="field-help">{{ t('noDocuments') }}</p></section><div v-if="pages>1" class="actions form-section"><button class="button small" :disabled="page<=1" @click="page--">{{ t('previousPage') }}</button><span>{{ t('page') }} {{ Math.min(page,pages) }} / {{ pages }}</span><button class="button small" :disabled="page>=pages" @click="page++">{{ t('nextPage') }}</button></div><p v-if="!receipts.length" class="field-help">{{ t('noReceiptDocumentsYet') }}</p><p class="field-help">{{ t('documentExportPolicy') }}</p><template #footer><button class="button" @click="emit('close')">{{ t('close') }}</button></template></AppDialog><AttachmentEditorDialog v-if="editing" :key="editing.ownerId" v-bind="editing" :title="t(editing.type==='receipt.attach'?'receiptDocuments':'invoiceDocuments')" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" @close="editing=null" @saved="editing=null;notify()"/></template>
