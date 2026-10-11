import {NextResponse} from 'next/server';import {nodeConfig,saveNodeConfig} from '@/lib/store';import {body,failure,sameOrigin} from '@/lib/http';
export const runtime='nodejs';
export async function GET(_:Request,ctx:{params:Promise<{id:string}>}){try{return NextResponse.json(nodeConfig((await ctx.params).id),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function PUT(req:Request,ctx:{params:Promise<{id:string}>}){if(!sameOrigin(req))return NextResponse.json({error:'Use the dashboard to update a camera.'},{status:403});try{return NextResponse.json(saveNodeConfig((await ctx.params).id,await body(req,20000)));}catch(e){return failure(e);}}
