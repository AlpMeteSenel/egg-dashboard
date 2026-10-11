import {normalizeBuses,ageBuses,type BusFeed} from './live-buses';
const source=process.env.BUSTO_API_URL||'https://app.bus.to.it/api/paths';
let saved:BusFeed={vehicles:[],source:'BusTO / MaTO vehicle positions',fetched_at:null,error:null},checked=0,pending:Promise<void>|null=null;
export async function busFeed():Promise<BusFeed>{
 if(Date.now()-checked>10000&&!pending){pending=(async()=>{try{const r=await fetch(source,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Feed request failed');const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>5_000_000)throw Error('Feed too large');const data=JSON.parse(new TextDecoder().decode(bytes));if(!data?.paths||typeof data.paths!=='object')throw Error('Invalid feed');saved={vehicles:normalizeBuses(data),source:saved.source,fetched_at:Date.now(),error:null};}catch{saved={...saved,error:'BusTO feed temporarily unavailable'};}finally{checked=Date.now();pending=null;}})();}
 if(pending)await pending;return {...saved,vehicles:ageBuses(saved.vehicles)};
}
