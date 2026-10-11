import {localOperator} from '@/lib/local-operator';
import {NextResponse} from 'next/server';import {body,failure} from '@/lib/http';import {crashStatus,saveCrashSettings,armCalls,generatePreview,cancelIncident,requestIncidentCall} from '@/lib/crash-service';
export const runtime='nodejs';export const dynamic='force-dynamic';

export async function GET(req:Request){if(!localOperator(req))return NextResponse.json({error:'Local operator only'},{status:403});return NextResponse.json(await crashStatus(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){if(!localOperator(req))return NextResponse.json({error:'Local operator only'},{status:403});try{const p=await body(req,2000);switch(p.action){
 case 'settings':saveCrashSettings(p.settings);break;
 case 'arm':if(typeof p.enabled!=='boolean')throw Error('Choose enabled or disabled');await armCalls(p.enabled,p.acceptCharges===true);break;
 case 'preview':await generatePreview(p.id);break;
 case 'cancel':cancelIncident(p.id);break;
 case 'call':if(p.confirmed!==true)throw Error('Confirm the real call and provider charges');await requestIncidentCall(p.id,true);break;
 default:throw Error('Unknown action');}
 return NextResponse.json(await crashStatus());}catch(e){return failure(e);}}

