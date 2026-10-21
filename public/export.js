import {areaIn,density,landPerPerson} from './geo.js';
const fmt=new Intl.NumberFormat('en-US');
function text(ctx,value,x,y,font='12px Arial',color='#42574a'){ctx.font=font;ctx.fillStyle=color;ctx.fillText(value,x,y)}
function wrap(ctx,value,x,y,width,lineHeight=17){let line='';for(const word of value.split(/\s+/)){const next=line?line+' '+word:word;if(ctx.measureText(next).width>width&&line){ctx.fillText(line,x,y);y+=lineHeight;line=word}else line=next}if(line){ctx.fillText(line,x,y);y+=lineHeight}return y}
function regionPath(ctx,geometry,map){
 const polys=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];ctx.beginPath();
 for(const poly of polys)for(const ring of poly){ring.forEach(([lng,lat],i)=>{const p=map.latLngToContainerPoint([lat,lng]);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)});ctx.closePath()}
}
export async function renderPNG({map,regions,baseName,units,baseNote=''}){
 const el=map.getContainer(),rect=el.getBoundingClientRect();
 // Export actual viewport geometry and loaded tiles, at 2x CSS resolution.
 const mw=Math.round(rect.width),mh=Math.round(rect.height),side=350,header=104,footer=126;
 const logicalWidth=mw+side,logicalHeight=Math.max(header+mh+footer,header+regions.length*175+footer);
 const scale=Math.min(2,8192/logicalWidth,8192/logicalHeight);
 const canvas=document.createElement('canvas');canvas.width=Math.round(logicalWidth*scale);canvas.height=Math.round(logicalHeight*scale);
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('PNG export is unavailable in this browser.');ctx.scale(scale,scale);ctx.fillStyle='#f6f5f0';ctx.fillRect(0,0,logicalWidth,logicalHeight);
 text(ctx,'URBAN FOOTPRINTS',28,30,'bold 12px Arial','#397d74');text(ctx,baseName+' / a geographic comparison',28,65,'28px Georgia','#243e30');
 text(ctx,'2015 functional urban regions · Same geographic scale · North up',28,87,'11px Arial','#7b8b7c');
 ctx.save();ctx.translate(0,header);ctx.beginPath();ctx.rect(0,0,mw,mh);ctx.clip();ctx.fillStyle='#e8ece3';ctx.fillRect(0,0,mw,mh);
 let tilesDrawn=0,tilesMissing=0;
 for(const img of el.querySelectorAll('.leaflet-tile')){
  const b=img.getBoundingClientRect(),x=b.left-rect.left,y=b.top-rect.top;
  if(x+b.width<=0||y+b.height<=0||x>=mw||y>=mh)continue;
  if(!img.complete||!img.naturalWidth||!img.classList.contains('leaflet-tile-loaded')){tilesMissing++;continue;}
  try{ctx.drawImage(img,x,y,b.width,b.height);tilesDrawn++}catch{tilesMissing++}
 }
 for(const r of regions){regionPath(ctx,r.geometry,map);ctx.fillStyle=r.color;ctx.globalAlpha=r.opacity;ctx.fill('evenodd');ctx.globalAlpha=.95;ctx.strokeStyle=r.color;ctx.lineWidth=r.isBase?2:2.5;ctx.stroke();ctx.globalAlpha=1}
 // The legend provides unambiguous labels, avoiding collisions on the map.
 text(ctx,'↑ N',20,27,'bold 12px Arial','#40584a');
 const center=map.getCenter(),left=map.containerPointToLatLng([25,mh-40]),right=map.containerPointToLatLng([125,mh-40]);
 const distance=left.distanceTo(right),unit=units==='mi'?1609.344:1000,maxUnits=distance/unit;
 const magnitude=10**Math.floor(Math.log10(maxUnits)),nice=[1,2,5,10].filter(n=>n*magnitude<=maxUnits).pop()*magnitude;
 const pixels=100*nice/maxUnits;
 ctx.fillStyle='#ffffffed';ctx.fillRect(16,mh-65,145,48);ctx.strokeStyle='#40584a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(25,mh-40);ctx.lineTo(25+pixels,mh-40);ctx.moveTo(25,mh-45);ctx.lineTo(25,mh-35);ctx.moveTo(25+pixels,mh-45);ctx.lineTo(25+pixels,mh-35);ctx.stroke();text(ctx,fmt.format(nice)+' '+units,25,mh-49,'11px Arial');
 text(ctx,'© OpenStreetMap contributors',Math.max(175,mw-205),mh-12,'10px Arial','#526b59');
 if(!tilesDrawn||tilesMissing){ctx.fillStyle='#fff4d9';ctx.fillRect(15,45,Math.min(405,mw-30),30);text(ctx,'Some street tiles unavailable; outlines remain accurate.',25,64,'11px Arial','#836733')}
 ctx.restore();
 const x=mw+25,w=side-50;text(ctx,'VISIBLE REGIONS',x,header+20,'bold 10px Arial','#7a8e7d');let y=header+49;
 for(const r of regions){
  ctx.fillStyle=r.color;ctx.beginPath();ctx.arc(x+5,y-4,5,0,Math.PI*2);ctx.fill();
  ctx.font='bold 15px Arial';ctx.fillStyle='#314d3b';y=wrap(ctx,r.displayName||r.name,x+19,y,w-19,19);
  text(ctx,r.country+(r.isBase?' · BASE':' · OVERLAY'),x,y+1,'10px Arial','#84907e');y+=24;
  text(ctx,(r.population/1e6).toFixed(2)+'M people',x,y,'bold 15px Arial','#405b46');
  text(ctx,fmt.format(Math.round(areaIn(r,units)))+' '+units+'²',x+155,y,'bold 15px Arial','#405b46');y+=20;
  text(ctx,fmt.format(Math.round(density(r,units)))+' people / '+units+'²',x,y,'11px Arial','#6f806c');y+=17;
  text(ctx,fmt.format(Math.round(landPerPerson(r)))+' m² of region per resident',x,y,'11px Arial','#6f806c');y+=19;
  if(r.isBase){ctx.font='10px Arial';ctx.fillStyle='#87927f';y=wrap(ctx,'Source region: '+r.name,x,y,w,14)}
  ctx.strokeStyle='#dce3d5';ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x+w,y+2);ctx.stroke();y+=25;
 }
 let fy=Math.max(header+mh+22,y+12);ctx.font='11px Arial';ctx.fillStyle='#60765f';
 fy=wrap(ctx,'Regions include modeled commuting zones and rural land. Area is not a measure of developed or paved land.',25,fy,logicalWidth-50,17);
 if(baseNote){ctx.font='10px Arial';ctx.fillStyle='#826d46';fy=wrap(ctx,baseNote,25,fy+2,logicalWidth-50,15)}
 text(ctx,'Sources: European Commission JRC / OECD · GHS-FUA R2019A (2015). U.S. choices ranked using Census Vintage 2025.',25,fy+10,'10px Arial','#81917d');
 text(ctx,'github.com/brianbalzar/urban-footprints · Spherical distance-and-bearing transfer; small shape/area differences are possible.',25,fy+27,'10px Arial','#81917d');
 // A tiled provider without CORS must never silently break export.
 const blob=await new Promise((resolve,reject)=>{try{canvas.toBlob(b=>b?resolve(b):reject(Error('The browser could not create the PNG.')),'image/png')}catch{reject(Error('The street-map provider blocked image export. Reload and try again.'))}});
 return {blob,width:canvas.width,height:canvas.height,tilesMissing:tilesMissing>0||tilesDrawn===0};
}
