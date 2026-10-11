import {NextResponse} from 'next/server';import {audioBytes} from '@/lib/fish-bridge';import {failure} from '@/lib/http';import {localOperator} from '@/lib/local-operator';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){if(!localOperator(req))return NextResponse.json({error:'Local operator only'},{status:403});try{return new Response(await audioBytes(new URL(req.url).searchParams.get('url')||''),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}});}catch(e){return failure(e);}}
