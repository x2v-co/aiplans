import { NextResponse } from 'next/server';
import { citableRequestPlan, prepareQuotes, snapshotToCsv } from '@/lib/citable-price-facts';
import { loadOfficialChannelRows } from '@/lib/citable-price-query';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const plan = citableRequestPlan(new URL(request.url));
  if (plan.kind === 'history_missing') {
    return NextResponse.json({
      error: 'historical_snapshot_not_retained',
      prior_snapshots_retained: false,
    }, { status: 404, headers: noStore });
  }
  if (plan.kind !== 'ok') {
    return NextResponse.json({
      error: plan.kind === 'bad_format' ? 'unsupported_format' : 'unsupported_parameter',
    }, { status: 400, headers: noStore });
  }

  try {
    const prepared = prepareQuotes(await loadOfficialChannelRows(), { allowFixture: false });
    const headers = { ...noStore, 'X-Snapshot-Id': prepared.snapshot.snapshot_id };
    if (plan.format === 'csv') {
      return new NextResponse(snapshotToCsv(prepared.snapshot), {
        headers: {
          ...headers,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="aiplans-official-quotes.csv"',
        },
      });
    }
    return NextResponse.json(prepared.snapshot, {
      headers: { ...headers, 'Content-Disposition': 'inline; filename="aiplans-official-quotes.json"' },
    });
  } catch {
    console.error('citable prices query failed');
    return NextResponse.json({
      error: 'source_unavailable',
      quotes: [],
      prior_snapshots_retained: false,
    }, { status: 503, headers: noStore });
  }
}
