import {NextResponse} from 'next/server';
export const runtime='nodejs';
const cache=new Map<string,{bytes:Uint8Array;type:string}>();
export async function GET(req:Request){
 const target=new URL(req.url).searchParams.get('url');if(!target||target.length>1500)return NextResponse.json({error:'Missing map resource'},{status:400});
 let u:URL;try{u=new URL(target);}catch{return new Response(null,{status:400});}
 if(u.protocol!=='https:'||u.hostname!=='tiles.openfreemap.org'||u.port||u.username||u.password)return new Response(null,{status:403});
 const saved=cache.get(target);if(saved)return new Response(new Uint8Array(saved.bytes),{headers:{'Content-Type':saved.type,'Cache-Control':'public, max-age=3600'}});
 try{const r=await fetch(target,{headers:{'User-Agent':'Mozilla/5.0','Accept':'*/*'},redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)return new Response(null,{status:r.status});const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>8_000_000)return new Response(null,{status:413});const type=r.headers.get('content-type')||'application/octet-stream';if(cache.size>=96)cache.delete(cache.keys().next().value!);cache.set(target,{bytes,type});return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=3600'}});}catch{return NextResponse.json({error:'Map resource temporarily unavailable'},{status:502});}
}
