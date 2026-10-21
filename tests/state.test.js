import test from 'node:test';import assert from 'node:assert/strict';import {encodeState,decodeState,PALETTE} from '../public/state.js';
const catalog={bases:[{id:'us-dallas'}],regions:[{id:'3147',iso3:'ESP'},{id:'5543',iso3:'USA'}]};
test('comparison URLs preserve positions, visibility, units and view',()=>{
 const s={base:'us-dallas',units:'mi',baseVisible:false,baseOpacity:.2,layers:[{id:'3147',position:[-97.2,33.1],visible:false,opacity:.45,color:PALETTE[0]}],view:{center:[-97.1,33],zoom:8.5}};
 assert.deepEqual(decodeState(encodeState(s),catalog),s);
});
test('untrusted URL state cannot inject colors, duplicate IDs or invalid locations',()=>{
 const hash=encodeState({base:'us-dallas',layers:[{id:'3147',opacity:99,color:'url(evil)',position:[900,100]},{id:'3147'},{id:'5543'},{id:'missing'}],view:{center:[-97,33],zoom:100}});
 const parsed=decodeState(hash,catalog);assert.equal(parsed.layers.length,1);assert.equal(parsed.layers[0].color,PALETTE[0]);assert.equal(parsed.layers[0].position,null);assert.equal(parsed.layers[0].opacity,.75);assert.equal(parsed.view.zoom,16);
});
test('invalid URL state falls back safely',()=>{for(const hash of ['','%ZZ','#{}',encodeState({base:'unknown'})])assert.equal(decodeState(hash,catalog),null)});

test('legacy metric links migrate to imperial while new explicit metric choices survive',()=>{
 const legacy='#'+encodeURIComponent(JSON.stringify({v:1,base:'us-dallas',units:'km',layers:[]}));assert.equal(decodeState(legacy,catalog).units,'mi');
 assert.equal(decodeState(encodeState({base:'us-dallas',units:'km',layers:[]}),catalog).units,'km');
});
