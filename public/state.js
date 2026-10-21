export const PALETTE=['#e07832','#8a51ba','#119a87','#d34c72','#7e851d','#4f65c4','#b57235','#9a4596'];
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=-180&&p[0]<=180&&p[1]>=-85&&p[1]<=85;
export function encodeState(state){return '#'+encodeURIComponent(JSON.stringify({v:2,...state}))}
export function decodeState(hash,catalog){
 try{
  const s=JSON.parse(decodeURIComponent(hash.replace(/^#/,'')));
  if((s.v!==1&&s.v!==2)||!catalog.bases.some(b=>b.id===s.base))return null;
  const known=new Map(catalog.regions.map(r=>[r.id,r]));const seen=new Set();
  const layers=(Array.isArray(s.layers)?s.layers:[]).filter(l=>l&&known.has(l.id)&&known.get(l.id).iso3!=='USA'&&!seen.has(l.id)&&(seen.add(l.id),true)).slice(0,8).map((l,i)=>({id:l.id,visible:l.visible!==false,opacity:Number.isFinite(l.opacity)?Math.min(.75,Math.max(0,l.opacity)):.3,color:PALETTE.includes(l.color)?l.color:PALETTE[i],position:point(l.position)?l.position:null}));
  return {base:s.base,layers,units:s.v===1?'mi':s.units==='km'?'km':'mi',baseVisible:s.baseVisible!==false,baseOpacity:Number.isFinite(s.baseOpacity)?Math.min(.75,Math.max(0,s.baseOpacity)):.13,view:s.view&&point(s.view.center)&&Number.isFinite(s.view.zoom)?{center:s.view.center,zoom:Math.min(16,Math.max(3,s.view.zoom))}:null};
 }catch{return null}
}
