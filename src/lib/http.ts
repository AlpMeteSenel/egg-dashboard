import {NextResponse} from 'next/server';
export function failure(e:unknown,status=400){return NextResponse.json({error:e instanceof Error?e.message:'Request failed'},{status});}
export async function body(req:Request,max=1_500_000){if(!req.headers.get('content-type')?.includes('application/json'))throw Error('Use application/json.');const text=await req.text();if(Buffer.byteLength(text)>max)throw Error('Request too large.');return JSON.parse(text);}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
