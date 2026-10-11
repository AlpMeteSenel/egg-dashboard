import {localOperator} from '@/lib/local-operator';
import {NextResponse} from 'next/server';import {body,failure} from '@/lib/http';import {crashStatus,saveCrashSettings,armCalls,makeIncident,generatePreview,cancelIncident,requestIncidentCall} from '@/lib/crash-service';import {saveDashboardEvent} from '@/lib/store';
export const runtime='nodejs';export const dynamic='force-dynamic';

export async function GET(req:Request){if(!localOperator(req))return NextResponse.json({error:'Local operator only'},{status:403});return NextResponse.json(await crashStatus(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){if(!localOperator(req))return NextResponse.json({error:'Local operator only'},{status:403});try{const p=await body(req,2000);switch(p.action){
 case 'settings':saveCrashSettings(p.settings);break;
 case 'arm':if(typeof p.enabled!=='boolean')throw Error('Choose enabled or disabled');await armCalls(p.enabled,p.acceptCharges===true);break;
 case 'test':{const i=makeIncident({person_id:0,car_id:0,person_conf:1,car_conf:1,overlap:50,person_speed:5,car_speed:30,relative_min:25,relative_max:35,frames:3,duration_ms:1000},true);saveDashboardEvent(i);break;}
 case 'preview':await generatePreview(p.id);break;
 case 'cancel':cancelIncident(p.id);break;
 case 'call':if(p.confirmed!==true)throw Error('Confirm the real call and provider charges');await requestIncidentCall(p.id,true);break;
 default:throw Error('Unknown action');}
 return NextResponse.json(await crashStatus());}catch(e){return failure(e);}}
