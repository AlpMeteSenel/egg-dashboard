import {NextResponse} from 'next/server';
import {busFeed} from '@/lib/bus-feed';
export const runtime='nodejs';
export async function GET(){return NextResponse.json(await busFeed(),{headers:{'Cache-Control':'no-store'}});}
