import {NextResponse} from 'next/server';import {updateNode} from '@/lib/store';import {body,failure,sameOrigin} from '@/lib/http';
export const runtime='nodejs';
export async function PATCH(req:Request,ctx:{params:Promise<{id:string}>}){if(!sameOrigin(req))return NextResponse.json({error:'Use the dashboard to update a camera.'},{status:403});try{return NextResponse.json(updateNode((await ctx.params).id,await body(req,30000)));}catch(e){return failure(e);}}
