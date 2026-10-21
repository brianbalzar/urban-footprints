import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {offset,destination,transplant,R,density,areaIn,landPerPerson,walk,similarity} from '../public/geo.js';
const catalog=JSON.parse(readFileSync(new URL('../public/data/catalog.json',import.meta.url)));
test('transplanted points retain radial distances across latitude changes',()=>{
 for(const origin of [[-3.7,40.4],[108.94,34.26],[139.7,35.7],[0,70]])for(const target of [[-97,33],[-74,41],[-122,48]])for(const bearing of [0,.7,2,3,-1])for(const distance of [0,1000,50000,200000]){
  const p=destination(origin,[distance/R,bearing]),moved=transplant({type:'Point',coordinates:p},origin,target).coordinates;
  assert.ok(Math.abs(offset(target,moved)[0]*R-distance)<.001);
 }
});
test('area and density unit conversion preserve population',()=>{
 const r={population:7077558,area:19826};
 for(const units of ['km','mi'])assert.ok(Math.abs(areaIn(r,units)*density(r,units)-r.population)<.001);
 assert.equal(landPerPerson(r,'km'),r.area*1e6/r.population);
 assert.ok(Math.abs(landPerPerson(r,'mi')*.09290304-landPerPerson(r,'km'))<1e-8);
 assert.equal(similarity(r,r),0);
});
test('all 30 Census choices map to known U.S. functional regions',()=>{
 assert.equal(catalog.bases.length,30);assert.equal(new Set(catalog.bases.map(b=>b.id)).size,30);
 const lookup=new Map(catalog.regions.map(r=>[r.id,r]));
 for(const [i,b] of catalog.bases.entries()){
  assert.equal(b.rank,i+1);assert.ok(b.censusPopulation2025>0);assert.equal(lookup.get(b.regionId).iso3,'USA');
  if(i)assert.ok(b.censusPopulation2025<=catalog.bases[i-1].censusPopulation2025);
 }
 assert.equal(catalog.bases.find(b=>b.id==='us-riverside').regionId,catalog.bases.find(b=>b.id==='us-los-angeles').regionId);
});
test('every catalog geometry loads, closes rings, and contains valid coordinates',()=>{
 const buckets=new Map();
 for(const r of catalog.regions){
  assert.ok(r.population>0&&r.area>0);assert.ok(r.anchor.every(Number.isFinite));
  if(!buckets.has(r.iso3))buckets.set(r.iso3,JSON.parse(readFileSync(new URL(`../public/data/${r.iso3}.json`,import.meta.url))));
  const geometry=buckets.get(r.iso3)[r.id];assert.equal(geometry.type,'MultiPolygon');
  for(const poly of geometry.coordinates)for(const ring of poly){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));}
  walk(geometry.coordinates,p=>{assert.ok(Number.isFinite(p[0])&&p[0]>=-180&&p[0]<=180);assert.ok(Number.isFinite(p[1])&&p[1]>=-90&&p[1]<=90);return p});
 }
 assert.equal(catalog.regions.filter(r=>r.iso3!=='USA').length,1285);
});
