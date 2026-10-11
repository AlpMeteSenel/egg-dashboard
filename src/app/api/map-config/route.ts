import {NextResponse} from 'next/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
type MapConfig={style:string;source:string;height:string;base:string;provider:string;fallback:boolean};
let cached:{at:number;config:MapConfig}|undefined;
export async function GET(req:Request){
 if(cached&&Date.now()-cached.at<60000)return NextResponse.json(cached.config);
 const key=process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
 let works=false;
 if(key)try{const origin=new URL(req.url).origin;const r=await fetch('https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json?secure=true&access_token='+encodeURIComponent(key),{headers:{Origin:origin,Referer:origin+'/'},signal:AbortSignal.timeout(3500),cache:'no-store'});works=r.ok;}catch{}
 const config:MapConfig=works?{style:'mapbox://styles/mapbox/light-v11',source:'composite',height:'height',base:'min_height',provider:'Mapbox',fallback:false}:{style:'https://tiles.openfreemap.org/styles/positron',source:'openmaptiles',height:'render_height',base:'render_min_height',provider:'OpenFreeMap / OpenStreetMap',fallback:true};
 cached={at:Date.now(),config};return NextResponse.json(config,{headers:{'Cache-Control':'no-store'}});
}
