import {suggestPatternEffects} from '../core/pattern-effect-suggestions.mjs';
self.onmessage=({data})=>{try{self.postMessage({result:suggestPatternEffects(data.revision,data.options)});}catch(error){self.postMessage({error:{code:error.code||error.message||'pattern_effect_invalid'}});}};
