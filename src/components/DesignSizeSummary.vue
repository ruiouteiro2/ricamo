<script setup>
import {computed} from 'vue';
import {t,number} from '../i18n';
import {stitchedBounds,physicalStitchedBounds} from '../../core/design-size.mjs';
const props=defineProps({revision:{type:Object,required:true},grid:{type:Object,default:null}});
// Only detail/calculator views mount this component; lists never scan the grid.
const bounds=computed(()=>stitchedBounds(props.revision));
const physical=computed(()=>physicalStitchedBounds(bounds.value,props.grid));
</script>
<template>
  <div class="stat-row"><span>{{t('designFullGrid')}}</span><strong>{{number(revision.width)}} × {{number(revision.height)}} {{t('designGridUnits')}}<small class="cell-subtitle">{{grid?`${number(grid.widthCm)} × ${number(grid.heightCm)} cm`:t('unknown')}}</small></strong></div>
  <div class="stat-row"><span>{{t('designStitchedExtent')}}</span><strong v-if="bounds">{{number(bounds.width)}} × {{number(bounds.height)}} {{t('designGridUnits')}}<small class="cell-subtitle">{{physical?`${number(physical.widthCm)} × ${number(physical.heightCm)} cm`:t('unknown')}}</small></strong><strong v-else>{{t('designEmptyExtent')}}</strong></div>
  <p v-if="bounds" class="field-help">{{t('designExtentCoordinates')}}: X {{number(bounds.x)}}–{{number(bounds.right)}}, Y {{number(bounds.y)}}–{{number(bounds.bottom)}}</p>
  <p class="field-help">{{t('designExtentHelp')}}</p>
</template>
