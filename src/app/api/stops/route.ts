import {NextResponse} from 'next/server';
import {stopCatalog} from '@/lib/stops';
export const runtime='nodejs';
export async function GET(){return NextResponse.json(stopCatalog(),{headers:{'Cache-Control':'public, max-age=3600'}});}
