import {NextResponse} from 'next/server';
import {transitAnalytics} from '@/lib/store';
export const runtime='nodejs';
export async function GET(){return NextResponse.json(transitAnalytics(),{headers:{'Cache-Control':'no-store'}});}
