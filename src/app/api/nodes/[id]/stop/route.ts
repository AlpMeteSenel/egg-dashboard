import {NextResponse} from 'next/server';
import {assignStop} from '@/lib/store';
import {body,failure,sameOrigin} from '@/lib/http';
export const runtime='nodejs';
export async function PATCH(req:Request,ctx:{params:Promise<{id:string}>}){if(!sameOrigin(req))return NextResponse.json({error:'Use the dashboard to link stops.'},{status:403});try{return NextResponse.json(assignStop((await ctx.params).id,(await body(req,2000)).stop_id));}catch(e){return failure(e);}}
