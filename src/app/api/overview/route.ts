import {NextResponse} from 'next/server';import {overview} from '@/lib/store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json(overview(),{headers:{'Cache-Control':'no-store'}});}
