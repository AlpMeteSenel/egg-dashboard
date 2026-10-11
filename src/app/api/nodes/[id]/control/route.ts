import {NextResponse} from 'next/server';import {controlNode} from '@/lib/store';import {body,failure,sameOrigin} from '@/lib/http';
export const runtime='nodejs';
export async function POST(req:Request,ctx:{params:Promise<{id:string}>}){if(!sameOrigin(req))return NextResponse.json({error:'Use the dashboard to control a camera.'},{status:403});try{return NextResponse.json(controlNode((await ctx.params).id,await body(req,1000)));}catch(e){return failure(e);}}
