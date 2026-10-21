#!/usr/bin/env python3
"""Rebuild the browser catalog from the original JRC GeoPackage and Census table.
Python 3.10+ standard library only. Downloads are cached outside public/.
"""
import argparse, json, math, pathlib, sqlite3, struct, urllib.request, zipfile, xml.etree.ElementTree as ET
ROOT = pathlib.Path(__file__).resolve().parents[1]
FUA_URL = 'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_FUA_UCDB2015_GLOBE_R2019A/V1-0/GHS_FUA_UCDB2015_GLOBE_R2019A_54009_1K_V1_0.zip'
CENSUS_URL = 'https://www2.census.gov/programs-surveys/popest/tables/2020-2025/metro/totals/cbsa-met-est2025-pop.xlsx'
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
# Explicit, reviewed crosswalk: Census MSA name prefix -> JRC FUA ID, display name.
# The source boundary is a functional region, never an MSA polygon. Neighboring
# metros can intentionally resolve to the same global region; the UI flags this.
CROSSWALK = [
 ('New York',7244,'New York'),('Los Angeles',1642,'Los Angeles'),('Chicago',6654,'Chicago'),
 ('Dallas',5543,'Dallas–Fort Worth'),('Houston',5511,'Houston'),('Atlanta',6451,'Atlanta'),
 ('Washington',7068,'Washington, D.C.'),('Miami',6442,'Miami'),('Philadelphia',7165,'Philadelphia'),
 ('Phoenix',4211,'Phoenix'),('Boston',7347,'Boston'),('Riverside',1642,'Riverside–San Bernardino'),
 ('San Francisco',1255,'San Francisco–Oakland'),('Detroit',6948,'Detroit'),('Seattle',4510,'Seattle'),
 ('Minneapolis',6433,'Minneapolis–St. Paul'),('Tampa',6237,'Tampa Bay'),('San Diego',2204,'San Diego'),
 ('Denver',5332,'Denver'),('Orlando',6487,'Orlando'),('Charlotte',6851,'Charlotte'),
 ('Baltimore',7123,'Baltimore'),('St. Louis',6192,'St. Louis'),('San Antonio',5229,'San Antonio'),
 ('Austin',5349,'Austin'),('Portland',4444,'Portland'),('Sacramento',3652,'Sacramento'),
 ('Pittsburgh',7020,'Pittsburgh'),('Las Vegas',4143,'Las Vegas'),('Cincinnati',6790,'Cincinnati')]
COUNTRIES={'USA':'United States','GBR':'United Kingdom','CHN':'China','KOR':'South Korea','PRK':'North Korea','TWN':'Taiwan','JPN':'Japan','RUS':'Russia','VNM':'Vietnam','COD':'DR Congo','COG':'Republic of Congo','CZE':'Czechia','ARE':'United Arab Emirates','CIV':'Côte d’Ivoire','TZA':'Tanzania','IRN':'Iran','VEN':'Venezuela','BOL':'Bolivia','LAO':'Laos','SYR':'Syria','PSE':'Palestine','HKG':'Hong Kong','MAC':'Macao'}
def download(url, path):
 if not path.exists():
  print('Downloading',path.name,flush=True)
  with urllib.request.urlopen(url,timeout=120) as r:path.write_bytes(r.read())
def inverse_moll(x,y):
 theta=math.asin(max(-1,min(1,y/(math.sqrt(2)*6378137))))
 lat=math.asin(max(-1,min(1,(2*theta+math.sin(2*theta))/math.pi)))
 lon=math.pi*x/(2*math.sqrt(2)*6378137*math.cos(theta))
 return [round(math.degrees(lon),6),round(math.degrees(lat),6)]
def read_wkb(b,p):
 order='<' if b[p]==1 else '>';p+=1
 typ=struct.unpack_from(order+'I',b,p)[0];p+=4
 n=struct.unpack_from(order+'I',b,p)[0];p+=4
 if typ==6:
  polygons=[]
  for _ in range(n):g,p=read_wkb(b,p);polygons.append(g)
  return polygons,p
 if typ!=3:raise ValueError(f'Unsupported WKB type {typ}')
 rings=[]
 for _ in range(n):
  k=struct.unpack_from(order+'I',b,p)[0];p+=4
  ring=[]
  for _ in range(k):
   x,y=struct.unpack_from(order+'dd',b,p);p+=16;ring.append((x,y))
  rings.append(ring)
 return rings,p
def geometry(blob):
 env=(blob[3]>>1)&7;p=8+{0:0,1:32,2:48,3:48,4:64}[env]
 polys,end=read_wkb(blob,p)
 # Area-weighted centroid of exterior rings in the equal-area source CRS.
 weight=sx=sy=0
 for poly in polys:
  ring=poly[0];twice=cx=cy=0
  for (x,y),(u,v) in zip(ring,ring[1:]):
   cross=x*v-u*y;twice+=cross;cx+=(x+u)*cross;cy+=(y+v)*cross
  if abs(twice)>1e-6:
   area=abs(twice);sx+=cx/(3*twice)*area;sy+=cy/(3*twice)*area;weight+=area
 anchor=inverse_moll(sx/weight,sy/weight)
 coords=[[[inverse_moll(x,y) for x,y in ring] for ring in poly] for poly in polys]
 return {'type':'MultiPolygon','coordinates':coords},anchor

def census_top30(path):
 with zipfile.ZipFile(path) as z:
  strings=[''.join(el.itertext()) for el in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',NS)]
  out=[]
  for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:sheetData/s:row',NS):
   vals={}
   for cell in row:
    v=cell.find('s:v',NS)
    if v is not None:vals[''.join(filter(str.isalpha,cell.attrib['r']))]=strings[int(v.text)] if cell.attrib.get('t')=='s' else v.text
   if vals.get('A','').startswith('.') and vals['A'].endswith(' Metro Area') and ', PR ' not in vals['A']:
    out.append({'msaName':vals['A'][1:-11],'censusPopulation2025':int(vals['H'])})
 return sorted(out,key=lambda r:-r['censusPopulation2025'])[:30]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--cache',type=pathlib.Path,default=ROOT/'.cache');args=ap.parse_args();args.cache.mkdir(exist_ok=True,parents=True)
 zp=args.cache/'fua.zip';xp=args.cache/'metro2025.xlsx';download(FUA_URL,zp);download(CENSUS_URL,xp)
 with zipfile.ZipFile(zp) as z:
  name=next(n for n in z.namelist() if n.endswith('.gpkg'));gp=args.cache/name
  if not gp.exists():gp.write_bytes(z.read(name))
 c=sqlite3.connect(gp);c.row_factory=sqlite3.Row;t=c.execute('select table_name from gpkg_contents').fetchone()[0]
 rows=c.execute('select * from '+t).fetchall();mapped_ids={x[1] for x in CROSSWALK}
 chosen=[r for r in rows if (r['Cntry_ISO']!='USA' and r['FUA_p_2015']>=500000) or int(r['eFUA_ID']) in mapped_ids]
 output=ROOT/'public/data';(output/'regions').mkdir(parents=True,exist_ok=True);catalog=[]
 for row in chosen:
  geom,anchor=geometry(row['geom']);rid=str(int(row['eFUA_ID']));country=COUNTRIES.get(row['Cntry_ISO'],row['Cntry_name'])
  if country==row['Cntry_name']:
   import re
   country=re.sub(r'(?<=[a-z])(?=[A-Z])',' ',country)
  name=row['eFUA_name'].replace("Xi'an",'Xi’an')
  entry={'id':rid,'name':name,'country':country,'iso3':row['Cntry_ISO'],'area':row['FUA_area'],'population':round(row['FUA_p_2015']),'anchor':anchor}
  catalog.append(entry)
  (output/'regions'/f'{rid}.json').write_text(json.dumps(geom,separators=(',',':')))
 bases=[]
 for rank,msa in enumerate(census_top30(xp),1):
  matches=[x for x in CROSSWALK if msa['msaName'].startswith(x[0])]
  if len(matches)!=1:raise ValueError(f'Missing crosswalk: {msa}')
  _,rid,name=matches[0]
  bases.append({'id':'us-'+__import__('re').sub(r'[^a-z0-9]+','-',matches[0][0].lower()).strip('-'),'rank':rank,'regionId':str(rid),'name':name,**msa})
 assert len(bases)==30
 meta={'boundaryYear':2015,'rankingYear':2025,'dataset':'GHS-FUA R2019A','source':FUA_URL,'censusSource':CENSUS_URL,'built':'2026-10-21','internationalMinimumPopulation':500000}
 (output/'catalog.json').write_text(json.dumps({'metadata':meta,'bases':bases,'regions':catalog},ensure_ascii=False,separators=(',',':')))
 # Country buckets keep both GitHub synchronization and static hosting lightweight.
 groups={}
 for r in catalog:
  group=r['iso3'];groups.setdefault(group,{})[r['id']]=json.loads((output/'regions'/f"{r['id']}.json").read_text())
 for iso,regions in groups.items():(output/f'{iso}.json').write_text(json.dumps(regions,separators=(',',':')))
 # Individual files were only staging; keep them out of the committed app.
 for p in (output/'regions').glob('*.json'):p.unlink()
 (output/'regions').rmdir()
 print(f'Prepared {len(bases)} U.S. choices, {sum(r["iso3"]!="USA" for r in catalog)} international regions, {len(groups)} country files.')
if __name__=='__main__':main()
