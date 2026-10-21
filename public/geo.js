// Spherical azimuthal transfer, not a Web Mercator pixel translation.
// Coordinates are consistently [longitude, latitude].
export const R=6371008.8;
const RAD=Math.PI/180;
export function offset(origin,point){
 const a=origin[1]*RAD,b=point[1]*RAD,dl=(point[0]-origin[0])*RAD,dp=b-a;
 const h=Math.min(1,Math.max(0,Math.sin(dp/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2));
 return [2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)),Math.atan2(Math.sin(dl)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl))];
}
export function destination(origin,[d,t]){
 const a=origin[1]*RAD,b=origin[0]*RAD;
 const lat=Math.asin(Math.min(1,Math.max(-1,Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(t))));
 const lon=(b+Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(lat)))/RAD;
 return [((lon+540)%360)-180,lat/RAD];
}
export function walk(c,fn){return typeof c[0]==='number'?fn(c):c.map(v=>walk(v,fn));}
export function transplant(geometry,origin,target){return {type:geometry.type,coordinates:walk(geometry.coordinates,p=>destination(target,offset(origin,p)))}}
export function density(region,units='km'){return region.population/region.area*(units==='mi'?2.589988110336:1)}
export function areaIn(region,units='km'){return region.area/(units==='mi'?2.589988110336:1)}
export function landPerPerson(region){return region.area*1e6/region.population}
export function similarity(a,b){return Math.abs(Math.log(a.population/b.population))}
export function normalizedName(text){return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’'`-]/g,'').toLowerCase()}
