import {NextResponse} from 'next/server';
import {HUB_PORT, ingestUrls} from '@/lib/hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({port: HUB_PORT, ingest: ingestUrls()});
}
