<script setup>
import { computed, ref } from 'vue';
import { Handshake, Wrench, Plus, RotateCcw, Pencil, TriangleAlert } from '@lucide/vue';
import { state, dispatch, notify } from '../state';
import { t, number, date, money } from '../i18n';
import { totalReserved, quantity } from '../../core/shared.mjs';
import { toolLoanRemaining, toolLoanReturned, toolLoanLost, toolAvailability, toolReminders, toolRecordedLosses } from '../../core/tool-state.mjs';
import { localDate } from '../../core/calendar.mjs';
import AppDialog from './AppDialog.vue';
import EntityForm from './EntityForm.vue';
import EmptyState from './EmptyState.vue';
const props = defineProps({ lotId: { type: String, required: true } });
const emit = defineEmits(['close']);
const tab = ref('loans'), form = ref(null);
const lot = computed(() => state.value.lots.find(row => row.id === props.lotId));
const material = computed(() => state.value.materials.find(row => row.id === lot.value?.materialId));
const records = computed(() => lot.value?.toolActivity || { loans: [], maintenance: [] });
const activeLoans = computed(() => records.value.loans.filter(row => toolLoanRemaining(row) > 0));
const maintenance = computed(() => [...records.value.maintenance].reverse());
const summary = computed(() => toolAvailability(lot.value, totalReserved(state.value, lot.value.id)));
const reservations = computed(() => state.value.reservations.filter(row => row.lotId === props.lotId && row.quantity > 0));
const today = localDate;
const reminders = computed(() => toolReminders(state.value, today()).filter(row => row.lotId === props.lotId));
const overdue = id => reminders.value.some(row => row.activityId === id && row.overdue);
const canLend = computed(() => lot.value?.status === 'usable' && lot.value.quantity !== null && !material.value?.archived && summary.value.available > 0);
const recordedLosses = computed(() => toolRecordedLosses(state.value, props.lotId));
const maintenanceRecord = computed(() => records.value.maintenance.find(row => row.id === form.value?.maintenanceId));
const currencies = ['EUR','GBP','USD','CHF','CAD','AUD','JPY','BRL'];
const costValue = value => value === '' || value === undefined || value === null ? null : Math.round(quantity(value) * 100);
const formTitle = computed(() => t({loan:'toolNewLoan',return:'toolReturn',amend:'toolEditLoan',loss:'toolRecordLoss',maintenance:'toolNewMaintenance',complete:'toolCompleteMaintenance'}[form.value?.mode]));
const help = computed(() => t({loan:'toolLoanHelp',return:'toolReturnHelp',amend:'toolAmendHelp',loss:'toolLossHelp',maintenance:'toolMaintenanceHelp',complete:'toolCompleteHelp'}[form.value?.mode]));
const fields = computed(() => {
  const qty = { key:'quantity',label:t('quantity'),type:'number',required:true }, notes = { key:'notes',label:t('notes'),type:'textarea',wide:true,max:4000 };
  if (form.value?.mode==='loan') return [qty,{key:'recipient',label:t('toolRecipient'),required:true,wide:true,max:300},{key:'loanedAt',label:t('toolLoanDate'),type:'date',required:true},{key:'dueDate',label:t('toolDueDate'),type:'date'},notes];
  if (form.value?.mode==='return') return [qty,{key:'returnedAt',label:t('toolReturnDate'),type:'date',required:true},notes];
  if (form.value?.mode==='amend') return [{key:'recipient',label:t('toolRecipient'),required:true,wide:true,max:300},{key:'dueDate',label:t('toolDueDate'),type:'date'},notes];
  if (form.value?.mode==='loss') return [qty,{key:'lostAt',label:t('toolLossDate'),type:'date',required:true},{key:'stockMode',label:t('toolLossStockMode'),type:'select',required:true,wide:true,options:[{value:'new',label:t('toolNewStockLoss')},{value:'recorded',label:t('toolAlreadyCounted')}]},{key:'kind',label:t('type'),type:'select',required:true,options:['loss','discard'],when:d=>d.stockMode==='new'},{key:'movementId',label:t('toolExistingAdjustment'),type:'select',required:true,wide:true,help:recordedLosses.value.length?t('toolReconcileHelp'):t('toolNoRecordedLoss'),options:recordedLosses.value.map(({movement,unallocated})=>({value:movement.id,label:`${date(movement.date)} · ${t(movement.kind)} · ${number(unallocated)} ${t(lot.value.unit)}${movement.reason?` · ${movement.reason.slice(0,100)}`:''}`})),when:d=>d.stockMode==='recorded'},{key:'reason',label:t('reason'),type:'textarea',required:true,wide:true,max:2000},{key:'confirmed',label:t('toolConfirmActualLoss'),type:'checkbox',wide:true}];
  if (form.value?.mode==='maintenance') return [{key:'description',label:t('toolWorkDescription'),required:true,wide:true,max:500},qty,{key:'mode',label:t('toolMaintenanceMode'),type:'select',required:true,options:[{value:'active',label:t('toolWorkInProgress')},{value:'history',label:t('toolWorkCompleted')}]},{key:'hold',label:t('toolHoldDuringMaintenance'),type:'checkbox',wide:true,when:d=>d.mode==='active'},{key:'startedAt',label:t('toolStartDate'),type:'date',required:true},{key:'dueDate',label:t('toolDueDate'),type:'date',when:d=>d.mode==='active'},{key:'completedAt',label:t('toolCompletionDate'),type:'date',required:true,when:d=>d.mode==='history'},{key:'costDisplay',label:t('cost'),type:'number'},{key:'currency',label:t('currency'),type:'select',required:true,options:currencies},{key:'partsNotes',label:t('toolReplacementParts'),type:'textarea',wide:true,max:4000},notes];
  return [{key:'completedAt',label:t('toolCompletionDate'),type:'date',required:true},{key:'costDisplay',label:`${t('cost')} (${maintenanceRecord.value?.currency})`,type:'number'},notes];
});
function open(mode, record) {
  let initial = {};
  if (mode==='loan') initial={quantity:'',recipient:'',loanedAt:today(),dueDate:'',notes:''};
  if (mode==='return') initial={quantity:String(toolLoanRemaining(record)),returnedAt:today(),notes:''};
  if (mode==='amend') initial={recipient:record.recipient,dueDate:record.dueDate,notes:record.notes};
  if (mode==='loss') initial={quantity:String(toolLoanRemaining(record)),lostAt:today(),stockMode:'new',kind:'loss',movementId:'',reason:'',confirmed:false};
  if (mode==='maintenance') initial={quantity:'1',description:'',mode:'active',hold:true,startedAt:today(),dueDate:'',completedAt:today(),costDisplay:'',currency:state.value.settings.currency,partsNotes:'',notes:''};
  if (mode==='complete') initial={completedAt:today(),costDisplay:record.cost===null?'':String(record.cost/100),notes:''};
  form.value={mode,initial,operationId:crypto.randomUUID(),loanId:['return','amend','loss'].includes(mode)?record.id:null,maintenanceId:mode==='complete'?record.id:null};
}
async function submit(draft) {
  const current=form.value, base={lotId:props.lotId}, mode=current.mode;
  if(mode==='loan') await dispatch('tool.loan',{...base,...draft},current.operationId);
  if(mode==='return') await dispatch('tool.return',{...base,...draft,loanId:current.loanId},current.operationId);
  if(mode==='amend') await dispatch('tool.loan.amend',{...base,...draft,loanId:current.loanId},current.operationId);
  if(mode==='loss') await dispatch('tool.loanLoss',{...base,loanId:current.loanId,quantity:draft.quantity,lostAt:draft.lostAt,reason:draft.reason,confirmed:draft.confirmed===true,kind:draft.kind,...(draft.stockMode==='recorded'?{movementId:draft.movementId}:{})},current.operationId);
  if(mode==='maintenance') await dispatch('tool.maintenance',{...base,quantity:draft.quantity,description:draft.description,hold:draft.mode==='active'&&draft.hold===true,startedAt:draft.startedAt,dueDate:draft.mode==='active'?draft.dueDate:'',completedAt:draft.mode==='history'?draft.completedAt:'',cost:costValue(draft.costDisplay),currency:draft.currency,partsNotes:draft.partsNotes,notes:draft.notes},current.operationId);
  if(mode==='complete') await dispatch('tool.maintenance.complete',{...base,maintenanceId:current.maintenanceId,completedAt:draft.completedAt,cost:costValue(draft.costDisplay),currency:maintenanceRecord.value.currency,notes:draft.notes},current.operationId);
}
</script>

<template>
  <AppDialog v-if="lot && !form" :title="t('toolActivity')" wide @close="emit('close')">
    <div class="split-heading"><div><strong>{{ material.name }} · {{ lot.lotCode || lot.id.slice(0,8) }}</strong><p class="field-help">{{ t('toolOwnedHelp') }}</p></div></div>
    <p v-if="summary.conflict>0" class="notice error" role="alert"><TriangleAlert :size="19" />{{ t('toolConflictHelp',{quantity:number(summary.conflict),unit:t(lot.unit)}) }}</p>
    <p v-else-if="summary.physical===null" class="notice warning">{{ t('toolUnknownStock') }}</p>
    <div class="metrics"><div v-for="key in ['physical','reserved','loaned','maintenance']" :key="key" class="metric"><span class="metric-top">{{ t(`toolMetric_${key}`) }}</span><div class="metric-value">{{ number(summary[key]) }}</div><div class="metric-caption">{{ t(lot.unit) }}</div></div></div>
    <div class="stat-row"><span>{{ t('available') }}</span><strong>{{ number(summary.available) }} {{ t(lot.unit) }}</strong></div>
    <nav class="tabs" :aria-label="t('toolActivity')"><button v-for="name in ['loans','maintenance','availability','history']" :key="name" :class="{selected:tab===name}" @click="tab=name">{{ t(`toolTab_${name}`) }}</button></nav>
    <template v-if="tab==='loans'">
      <div class="split-heading"><h2>{{ t('toolOpenLoans') }} · {{ activeLoans.length }}</h2><button class="button primary small" :disabled="!canLend" @click="open('loan')"><Plus :size="15" />{{ t('toolNewLoan') }}</button></div>
      <div v-if="activeLoans.length" class="table-wrap"><table><thead><tr><th>{{ t('toolRecipient') }}</th><th>{{ t('toolOutstanding') }}</th><th>{{ t('toolDueDate') }}</th><th>{{ t('actions') }}</th></tr></thead><tbody><tr v-for="row in activeLoans" :key="row.id"><td><strong>{{ row.recipient }}</strong><span class="cell-subtitle">{{ date(row.loanedAt) }}</span></td><td>{{ number(toolLoanRemaining(row)) }} {{ t(lot.unit) }}<span class="cell-subtitle">{{ t('toolOriginallyLoaned',{quantity:number(row.quantity)}) }}</span></td><td><span :class="['badge',overdue(row.id)?'warning':'']">{{ row.dueDate?date(row.dueDate):t('toolNoDueDate') }}</span><span v-if="overdue(row.id)" class="cell-subtitle">{{ t('toolOverdue') }}</span></td><td><div class="actions"><button class="button small" :aria-label="t('toolReturnFor',{recipient:row.recipient})" @click="open('return',row)"><RotateCcw :size="14" />{{ t('toolReturn') }}</button><button class="button text small" :aria-label="t('toolLossFor',{recipient:row.recipient})" @click="open('loss',row)">{{ t('toolRecordLoss') }}</button><button class="icon-button" :aria-label="t('toolEditFor',{recipient:row.recipient})" @click="open('amend',row)"><Pencil :size="15" /></button></div></td></tr></tbody></table></div>
      <EmptyState v-else :icon="Handshake" :title="t('toolNoLoans')" :description="t('toolLoanHelp')" compact />
    </template>
    <template v-else-if="tab==='maintenance'">
      <div class="split-heading"><h2>{{ t('toolTab_maintenance') }}</h2><button class="button primary small" @click="open('maintenance')"><Plus :size="15" />{{ t('toolNewMaintenance') }}</button></div>
      <EmptyState v-if="!maintenance.length" :icon="Wrench" :title="t('empty')" :description="t('toolMaintenanceHelp')" compact />
      <section v-for="row in maintenance" :key="row.id" class="form-section"><div class="split-heading"><div><strong>{{ row.description }}</strong><span class="cell-subtitle">{{ number(row.quantity) }} {{ t(lot.unit) }} · {{ date(row.startedAt) }}</span></div><span class="badge" :class="row.completedAt?'green':overdue(row.id)?'warning':''">{{ t(row.completedAt?'toolWorkCompleted':row.hold?'toolHolding':'toolNotHolding') }}</span></div><div class="stat-row"><span>{{ t(row.completedAt?'toolCompletionDate':'toolDueDate') }}</span><strong>{{ row.completedAt?date(row.completedAt):row.dueDate?date(row.dueDate):t('toolNoDueDate') }}</strong></div><div class="stat-row"><span>{{ t('cost') }}</span><strong>{{ money(row.cost,row.currency) }}</strong></div><p v-if="row.partsNotes" class="field-help">{{ t('toolReplacementParts') }}: {{ row.partsNotes }}</p><p v-if="row.notes" class="field-help">{{ row.notes }}</p><button v-if="!row.completedAt" class="button small" @click="open('complete',row)">{{ t('toolCompleteMaintenance') }}</button></section>
    </template>
    <template v-else-if="tab==='availability'">
      <p class="notice">{{ t('toolAvailabilityHelp') }}</p><h3>{{ t('toolProjectAssignments') }}</h3><p v-if="!reservations.length" class="field-help">{{ t('empty') }}</p><div v-for="row in reservations" :key="row.id" class="stat-row"><span>{{ state.projects.find(p=>p.id===row.projectId)?.name }}</span><strong>{{ number(row.quantity) }} {{ t(lot.unit) }}</strong></div><p class="field-help">{{ t('toolAssignmentHelp') }}</p>
      <h3 class="form-section">{{ t('toolDueReminders') }}</h3><p v-if="!reminders.length" class="field-help">{{ t('empty') }}</p><div v-for="row in reminders" :key="row.id" class="stat-row"><span>{{ row.title }}<small class="cell-subtitle">{{ t(row.kind==='loan'?'toolTab_loans':'toolTab_maintenance') }}</small></span><strong :class="row.overdue?'badge warning':''">{{ date(row.dueDate) }}</strong></div>
    </template>
    <template v-else>
      <p class="notice">{{ t('toolHistoryHelp') }}</p><p v-if="!records.loans.length" class="field-help">{{ t('empty') }}</p>
      <details v-for="row in [...records.loans].reverse()" :key="row.id"><summary>{{ row.recipient }} · {{ date(row.loanedAt) }} · {{ t(row.closedAt?'toolClosedLoan':'toolOpenLoan') }}</summary><div class="stat-row"><span>{{ t('toolReturnedQuantity') }}</span><strong>{{ number(toolLoanReturned(row)) }}</strong></div><div class="stat-row"><span>{{ t('toolLostQuantity') }}</span><strong>{{ number(toolLoanLost(row)) }}</strong></div><p v-if="row.notes" class="field-help">{{ row.notes }}</p><div v-for="event in row.events" :key="event.id" class="stat-row"><span>{{ date(event.date) }} · {{ t(`toolEvent_${event.kind}`) }}<small v-if="event.notes" class="cell-subtitle">{{ event.notes }}</small><small v-if="event.kind==='amend'" class="cell-subtitle">{{ event.before.recipient }} → {{ event.after.recipient }} · {{ event.after.dueDate?date(event.after.dueDate):t('toolNoDueDate') }}</small></span><strong>{{ event.kind==='amend'?'—':number(event.quantity) }}</strong></div></details>
    </template>
    <template #footer><button class="button" @click="emit('close')">{{ t('close') }}</button></template>
  </AppDialog>
  <EntityForm v-if="form" :key="form.operationId" :title="formTitle" :fields="fields" :initial="form.initial" :help="help" :submit="submit" :confirm-label="form.mode==='loss'?t('toolRecordLoss'):undefined" wide @close="form=null" @saved="form=null;notify()" />
</template>
