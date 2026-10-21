import {offset,destination,walk,areaIn,density,landPerPerson,similarity,normalizedName} from './geo.js';
import {encodeState,decodeState,PALETTE} from './state.js';
import {renderPNG} from './export.js';
const $=id=>document.getElementById(id),L=window.L,fmt=new Intl.NumberFormat('en-US');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map=L.map('map',{zoomControl:false,minZoom:3,maxZoom:16,zoomSnap:.25}).setView([32.9,-97],9);
L.control.zoom({position:'topright'}).addTo(map);L.control.scale({position:'bottomleft',metric:true,imperial:true,maxWidth:100}).addTo(map);
let catalog,baseChoice,baseRegion,baseLayer,overlays=[],units='km',busy=false,toastTimer,shareTimer,initializing=true,exportURL;
const countryCache=new Map();let tileLoaded=false;
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{crossOrigin:'anonymous',maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
tiles.on('tileload',()=>{tileLoaded=true;$('tile-warning').hidden=true});tiles.on('tileerror',()=>{if(!tileLoaded)$('tile-warning').hidden=false});
function toast(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6000)}
function setBusy(value){busy=value;$('busy').hidden=!value;for(const id of ['base-select','city-search','similar','browse','align','fit','reset','comparison-open','share','export'])$(id).disabled=value}
async function loadGeometry(region){
 if(!countryCache.has(region.iso3))countryCache.set(region.iso3,fetch(`data/${region.iso3}.json`).then(r=>{if(!r.ok)throw Error('Geographic file unavailable');return r.json()}).catch(e=>{countryCache.delete(region.iso3);throw e}));
 const data=await countryCache.get(region.iso3);if(!data[region.id])throw Error('Boundary missing from catalog');return data[region.id];
}
function allLayers(){return baseLayer?[baseLayer,...overlays]:[]}
function regionGeometry(r){return r.isBase?r.raw:{type:r.raw.type,coordinates:walk(r.local,p=>destination(r.position,p))}}
function createLayer(region,options={}){
 const r={...region,isBase:false,color:'#e07832',opacity:.3,visible:true,position:[...baseRegion.anchor],...options};
 r.local=walk(r.raw.coordinates,p=>offset(r.anchor,p));
 r.layer=L.geoJSON(null,{onEachFeature:(_,layer)=>layer.on('add',()=>{if(!r.isBase&&layer.getElement())layer.getElement().dataset.overlay=r.id})});
 r.label=L.marker([0,0],{interactive:false,keyboard:false,icon:L.divIcon({className:'region-label',html:`<span style="color:${r.color}">${escape(r.displayName||r.name)}</span>`,iconSize:null,iconAnchor:[0,0]})});
 draw(r);return r;
}
function draw(r){
 r.layer.clearLayers().addData({type:'Feature',properties:{},geometry:regionGeometry(r)});
 r.layer.setStyle({color:r.color,weight:r.isBase?2:2.5,fillColor:r.color,fillOpacity:r.opacity,opacity:.95});
 const bounds=r.layer.getBounds();r.label.setLatLng(r.isBase?bounds.getSouthWest():bounds.getNorthEast());
 if(r.visible){r.layer.addTo(map);r.label.addTo(map)}else{map.removeLayer(r.layer);map.removeLayer(r.label)}
}
function removeLayer(r){map.removeLayer(r.layer);map.removeLayer(r.label)}
function fitAll(){const ls=allLayers().filter(r=>r.visible);if(ls.length){const bounds=L.featureGroup(ls.map(r=>r.layer)).getBounds();map.fitBounds(bounds,{padding:[55,65],maxZoom:11,animate:false})}}
function centerOverlays(){for(const r of overlays){r.position=[...baseRegion.anchor];draw(r)}$('map-status').textContent='Region centers aligned';scheduleState()}
function sourceNote(choice,region){
 if(choice.name==='Riverside–San Bernardino')return 'Uses the broader Los Angeles functional region, shared with the Los Angeles selection.';
 if(choice.name==='Los Angeles')return 'Uses the broader Los Angeles functional region, shared with the Riverside selection.';
 if(choice.name==='San Francisco–Oakland')return 'Uses the broader San Jose functional region, which includes the Bay Area.';
 if(choice.name==='San Diego')return 'Uses the U.S. portion of the source’s Tijuana functional region.';
 return '';
}
async function changeBase(choice,{preserve=false,saved=null}={}){
 const region=catalog.regions.find(r=>r.id===choice.regionId),raw=await loadGeometry(region);
 if(baseLayer)removeLayer(baseLayer);baseChoice=choice;baseRegion=region;
 baseLayer=createLayer(region,{raw,isBase:true,displayName:choice.name,color:'#2386bd',opacity:saved?.baseOpacity??.13,visible:saved?.baseVisible??true,position:[...region.anchor]});
 $('base-select').value=choice.id;$('base-name').textContent=choice.name.toUpperCase();
 const note=sourceNote(choice,region);$('boundary-note').textContent=note;$('boundary-note').hidden=!note;
 $('base-help').textContent=`#${choice.rank} U.S. metro · ${fmt.format(choice.censusPopulation2025)} people in 2025. Comparison below uses its 2015 functional region.`;
 if(!preserve)centerOverlays();renderCards();fitAll();scheduleState();
}
async function addOverlay(id,options={},fit=true){
 if(overlays.some(r=>r.id===id))return;
 if(overlays.length>=8){toast('Use up to eight international overlays. Remove one to add another.');return;}
 const region=catalog.regions.find(r=>r.id===id&&r.iso3!=='USA');if(!region)throw Error('International region not found');
 const raw=await loadGeometry(region),used=new Set(overlays.map(r=>r.color)),color=PALETTE.find(c=>!used.has(c))||PALETTE[overlays.length];
 const r=createLayer(region,{raw,color,...options,position:options.position||[...baseRegion.anchor]});overlays.push(r);renderCards();if(fit)fitAll();scheduleState();
}
function renderCards(){
 $('cards').replaceChildren();for(const r of allLayers()){
  const card=document.createElement('article');card.className='card';card.style.setProperty('--color',r.color);const name=r.displayName||r.name;
  card.innerHTML=`<div class="card-head"><span class="city-name"><span class="swatch"></span><span class="name" title="${escape(name)}">${escape(name)}</span></span><span class="role">${r.isBase?'BASE':'OVERLAY'}</span><input class="switch" type="checkbox" aria-label="Show ${escape(name)}" ${r.visible?'checked':''}>${r.isBase?'':`<button class="remove" aria-label="Remove ${escape(name)}">×</button>`}</div><div class="card-subtitle">${escape(r.country)}${r.isBase&&r.name!==r.displayName?' · source: '+escape(r.name):''}</div><div class="stats"><div><div class="value">${(r.population/1e6).toFixed(2)}M</div><div class="metric">People · 2015</div></div><div><div class="value">${fmt.format(Math.round(areaIn(r,units)))}</div><div class="metric">Region · ${units}²</div></div><div><div class="value">${fmt.format(Math.round(density(r,units)))}</div><div class="metric">People / ${units}²</div></div></div><div class="land-metric"><span>Regional area per resident</span><strong>${fmt.format(Math.round(landPerPerson(r)))} m²</strong></div><label class="opacity">Fill <input type="range" min="0" max="75" value="${Math.round(r.opacity*100)}" aria-label="${escape(name)} fill opacity"><output>${Math.round(r.opacity*100)}%</output></label>${r.isBase?'':`<div class="nudge" aria-label="Move ${escape(name)}"><button data-direction="west" aria-label="Move ${escape(name)} west">←</button><button data-direction="north" aria-label="Move ${escape(name)} north">↑</button><button data-direction="south" aria-label="Move ${escape(name)} south">↓</button><button data-direction="east" aria-label="Move ${escape(name)} east">→</button><span>2 km per step</span></div>`}`;
  card.querySelector('[type=checkbox]').addEventListener('change',e=>{r.visible=e.target.checked;draw(r);scheduleState()});
  card.querySelector('[type=range]').addEventListener('input',e=>{r.opacity=+e.target.value/100;card.querySelector('output').textContent=e.target.value+'%';r.layer.setStyle({fillOpacity:r.opacity});scheduleState()});
  card.querySelector('.remove')?.addEventListener('click',()=>{removeLayer(r);overlays=overlays.filter(x=>x!==r);renderCards();renderSearch($('city-search').value);scheduleState()});
  for(const btn of card.querySelectorAll('[data-direction]'))btn.addEventListener('click',()=>{const bearing={north:0,east:Math.PI/2,south:Math.PI,west:-Math.PI/2}[btn.dataset.direction];r.position=destination(r.position,[2000/6371008.8,bearing]);draw(r);$('map-status').textContent=`${r.name} moved ${btn.dataset.direction}`;scheduleState()});
  $('cards').append(card);
 }
}
function renderSearch(query='',mode='search'){
 if(!catalog)return;
 const search=normalizedName(query.trim()),selected=new Set(overlays.map(r=>r.id));
 let items=catalog.regions.filter(r=>r.iso3!=='USA'&&(!search||normalizedName(`${r.name} ${r.country} ${r.iso3}`).includes(search)));
 if(mode==='similar')items.sort((a,b)=>similarity(a,baseRegion)-similarity(b,baseRegion));else items.sort((a,b)=>b.population-a.population);
 const box=$('search-results');box.hidden=false;box.replaceChildren();
 if(!items.length){box.innerHTML='<div class="result-message">No matching regions. Try another city name, country, or country code.</div>';return;}
 const heading=document.createElement('div');heading.className='result-message';heading.textContent=mode==='similar'?'Closest to the base region’s 2015 population':search?`${fmt.format(items.length)} matches · showing up to 30`:'Largest international regions · 2015';box.append(heading);
 for(const r of items.slice(0,30)){
  const b=document.createElement('button');b.className='result'+(selected.has(r.id)?' result-added':'');b.disabled=selected.has(r.id)||busy;
  b.innerHTML=`<span><strong>${escape(r.name)}</strong><small>${escape(r.country)}${mode==='similar'?' · '+Math.round((r.population/baseRegion.population-1)*100)+'% vs base':''}</small></span><span class="result-pop">${(r.population/1e6).toFixed(2)}M ${selected.has(r.id)?'✓':'+'}</span>`;
  b.addEventListener('click',()=>run(async()=>{await addOverlay(r.id);$('city-search').value='';box.hidden=true;toast(`${r.name} added`)}));box.append(b);
 }
}
function snapshot(){const c=map.getCenter();return {base:baseChoice.id,units,baseVisible:baseLayer.visible,baseOpacity:baseLayer.opacity,layers:overlays.map(r=>({id:r.id,visible:r.visible,opacity:r.opacity,color:r.color,position:r.position.map(v=>+v.toFixed(6))})),view:{center:[+c.lng.toFixed(6),+c.lat.toFixed(6)],zoom:map.getZoom()}}}
function scheduleState(){if(initializing||!baseLayer)return;clearTimeout(shareTimer);shareTimer=setTimeout(()=>history.replaceState(null,'',encodeState(snapshot())),180)}
map.on('moveend',scheduleState);
let dragging=null;
const container=map.getContainer();
container.addEventListener('pointerdown',e=>{const id=e.target.closest?.('[data-overlay]')?.dataset.overlay;if(!id||busy)return;const r=overlays.find(x=>x.id===id);if(!r)return;e.preventDefault();e.stopPropagation();const p=map.mouseEventToLatLng(e);dragging={r,start:[p.lng,p.lat],position:[...r.position]};map.dragging.disable();container.setPointerCapture(e.pointerId);container.style.cursor='grabbing'});
container.addEventListener('pointermove',e=>{if(!dragging)return;e.preventDefault();const p=map.mouseEventToLatLng(e);dragging.r.position=destination(dragging.position,offset(dragging.start,[p.lng,p.lat]));draw(dragging.r);$('map-status').textContent=`${dragging.r.name} moved · geographic scale preserved`});
function finishDrag(){if(!dragging)return;dragging=null;map.dragging.enable();container.style.cursor='';scheduleState()}
container.addEventListener('pointerup',finishDrag);container.addEventListener('pointercancel',finishDrag);container.addEventListener('lostpointercapture',finishDrag);
async function run(fn){if(busy)return;setBusy(true);try{await fn()}catch(e){console.error(e);toast(e.message||'Could not complete that action. Please try again.',true)}finally{setBusy(false)}}
function compareTable(){
 $('area-head').textContent=`Area · ${units}²`;$('density-head').textContent=`People / ${units}²`;
 $('comparison-body').innerHTML=allLayers().filter(r=>r.visible).map(r=>`<tr><td><div class="table-name"><i style="background:${r.color}"></i>${escape(r.displayName||r.name)}</div><div class="table-source">${escape(r.country)}${r.isBase?' · source region: '+escape(r.name):''}</div></td><td>${fmt.format(r.population)}</td><td>${fmt.format(Math.round(areaIn(r,units)))}</td><td>${fmt.format(Math.round(density(r,units)))}</td><td>${fmt.format(Math.round(landPerPerson(r)))}</td></tr>`).join('');$('comparison').showModal();
}
async function exportPNG(){
 const visible=allLayers().filter(r=>r.visible);if(!visible.length){toast('Show at least one region before exporting.');return;}
 if(tiles.isLoading()){toast('Street tiles are still loading. Wait a moment, then export.');return;}
 $('export').textContent='Creating PNG…';try{
  const result=await renderPNG({map,regions:visible.map(r=>({...r,geometry:regionGeometry(r)})),baseName:baseChoice.name,units,baseNote:sourceNote(baseChoice,baseRegion)});
  if(exportURL)URL.revokeObjectURL(exportURL);exportURL=URL.createObjectURL(result.blob);
  $('export-image').src=exportURL;$('download-png').href=exportURL;$('download-png').download=`urban-footprints-${baseChoice.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`;
  $('export-details').textContent=`${result.width.toLocaleString()} × ${result.height.toLocaleString()} pixels · ${(result.blob.size/1024/1024).toFixed(1)} MB${result.tilesMissing?' · Some street tiles were unavailable.':''}`;$('export-preview').showModal();
 }finally{$('export').textContent='Export PNG ↗'}
}
for(const id of ['method','comparison','export-preview']){const dialog=$(id);dialog.querySelector('.close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()})}
$('method-open').onclick=$('notes-link').onclick=()=>$('method').showModal();$('comparison-open').onclick=compareTable;
$('base-select').onchange=e=>run(()=>changeBase(catalog.bases.find(b=>b.id===e.target.value)));
$('city-search').addEventListener('input',e=>renderSearch(e.target.value));$('city-search').addEventListener('keydown',e=>{if(e.key==='Escape')$('search-results').hidden=true});
$('similar').onclick=()=>{$('city-search').value='';renderSearch('','similar')};$('browse').onclick=()=>{$('city-search').value='';renderSearch('','largest')};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.add-section'))$('search-results').hidden=true});
$('align').onclick=()=>{centerOverlays();fitAll()};$('fit').onclick=fitAll;
$('reset').onclick=()=>run(async()=>{for(const r of overlays)removeLayer(r);overlays=[];units='km';setUnits('km');await changeBase(catalog.bases.find(b=>b.id==='us-dallas'));for(const name of ['Madrid','Xi’an']){const r=catalog.regions.find(r=>r.name===name&&r.iso3!=='USA');if(r)await addOverlay(r.id,{},false)}fitAll();$('map-status').textContent='Region centers aligned';$('search-results').hidden=true;scheduleState()});
function setUnits(value){units=value;$('units-km').setAttribute('aria-pressed',value==='km');$('units-mi').setAttribute('aria-pressed',value==='mi');if(baseLayer)renderCards();scheduleState()}
$('units-km').onclick=()=>setUnits('km');$('units-mi').onclick=()=>setUnits('mi');
$('share').onclick=async()=>{try{const url=new URL(location.href);url.hash=encodeState(snapshot());await navigator.clipboard.writeText(url.href);history.replaceState(null,'',url.href);toast('Comparison link copied, including overlay positions.')}catch{toast('Copy this page’s URL from your address bar to share the comparison.')}};
$('export').onclick=()=>run(exportPNG);
async function init(){
 setBusy(true);try{
  const res=await fetch('data/catalog.json');if(!res.ok)throw Error('Catalog is unavailable. Reload to try again.');catalog=await res.json();
  $('base-select').innerHTML=catalog.bases.map(b=>`<option value="${b.id}">${b.rank}. ${escape(b.name)}</option>`).join('');
  $('catalog-count').textContent=fmt.format(catalog.regions.filter(r=>r.iso3!=='USA').length)+' regions';
  const saved=decodeState(location.hash,catalog);units=saved?.units||'km';setUnits(units);
  await changeBase(catalog.bases.find(b=>b.id===(saved?.base||'us-dallas')),{preserve:true,saved});
  if(saved){for(const layer of saved.layers)await addOverlay(layer.id,layer,false)}else for(const name of ['Madrid','Xi’an']){const r=catalog.regions.find(r=>r.name===name&&r.iso3!=='USA');await addOverlay(r.id,{},false)}
  if(saved?.view)map.setView([saved.view.center[1],saved.view.center[0]],saved.view.zoom,{animate:false});else fitAll();
  $('map-status').textContent=saved?'Saved comparison restored':'Region centers aligned';initializing=false;scheduleState();
 }catch(e){console.error(e);$('cards').innerHTML='<p class="helper">Could not load the map catalog. Reload this page to try again.</p>';toast(e.message,true)}finally{setBusy(false)}
}
init();
