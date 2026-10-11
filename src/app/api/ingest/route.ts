import {NextResponse} from 'next/server';
import {ingest,ingestBatch,validSecret} from '@/lib/store';
import {body,failure} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request){if(!validSecret(req.headers.get('authorization')))return NextResponse.json({error:'Invalid node credential'},{status:401});try{const data=await body(req);return NextResponse.json(data&&Array.isArray(data.samples)?ingestBatch(data):ingest(data));}catch(e){return failure(e);}}
