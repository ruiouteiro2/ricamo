<script setup>
import {ref,watch,nextTick} from 'vue';
import {ChevronLeft,ChevronRight} from '@lucide/vue';import {t} from '../i18n';
import {drawPattern} from '../pattern-render.mjs';import {patternPreviewTiles} from '../pattern-export.mjs';
const props=defineProps({revision:Object,options:Object});const canvas=ref(),page=ref(0);
const tiles=ref([]);let renderId=0;
async function draw(){await nextTick();const tile=tiles.value[page.value];if(!tile||!canvas.value)return;drawPattern(canvas.value,props.revision,{cellSize:14,offsetX:tile.x*14,offsetY:tile.y*14,width:tile.width*14,height:tile.height*14,grid:true,symbols:true,monochrome:props.options.monochrome,completed:props.options.completed??[]});}
watch(()=>[props.revision,props.options],async()=>{const current=++renderId;try{const next=await patternPreviewTiles(props.revision,props.options);if(current!==renderId)return;tiles.value=next;page.value=Math.min(page.value,Math.max(0,next.length-1));await draw();}catch{if(current===renderId)tiles.value=[];}},{deep:true,immediate:true});watch(page,draw);
</script>
<template><section v-if="tiles.length" class="stack"><div class="actions"><h3>{{t('printChartPreview')}}</h3><div class="actions"><button class="icon-button" :aria-label="t('previousPage')" :disabled="page===0" @click="page--"><ChevronLeft :size="18"/></button><span role="status">{{page+1}} / {{tiles.length}}</span><button class="icon-button" :aria-label="t('nextPage')" :disabled="page+1===tiles.length" @click="page++"><ChevronRight :size="18"/></button></div></div><p class="field-help">{{t('printChartPreviewHelp')}}</p><div class="table-wrap" style="max-height:420px"><canvas ref="canvas" role="img" :aria-label="t('printChartPreview')" style="display:block;max-width:100%;height:auto"/></div></section></template>
