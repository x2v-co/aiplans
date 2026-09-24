import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * 汇率 API 端点
 * 每天更新一次汇率，简化版
 */

export async function GET() {
  try {
    // Query exchange rates from database
    const rates = await sql<any[]>`
      SELECT * FROM exchange_rates
      WHERE is_active = true
      ORDER BY updated_at DESC
    `;

    if (rates.length === 0) {
      return NextResponse.json(
        {
          error: 'No exchange rates found in database',
          hint: 'Ask the administrator to refresh exchange rates',
        },
        { status: 503 }
      );
    }

    // Transform database rows into rates object
    // Group by from_currency
    const ratesMap: Record<string, Record<string, number>> = {};

    for (const row of rates) {
      const from = row.from_currency;
      const to = row.to_currency;
      const rate = parseFloat(row.rate);

      if (!ratesMap[from]) {
        ratesMap[from] = {};
      }
      ratesMap[from][to] = rate;
    }

    // Get the most recent update time
    const lastUpdated = rates[0]?.updated_at || new Date().toISOString();

    // Get unique sources
    const sources = [...new Set(rates.map(r => r.source))];

    return NextResponse.json({
      rates: ratesMap['USD'] || {}, // Default to USD base rates
      allRates: ratesMap, // Include all currency pairs
      lastUpdated,
      count: rates.length,
      sources: sources.reduce((acc, src) => {
        acc[src] = `Data from ${src}`;
        return acc;
      }, {} as Record<string, string>),
    });
  } catch (error) {
    console.error('Exchange rates API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Public compatibility endpoint is read-only, regardless of credentials.
function readOnly() {
  return NextResponse.json({ error: 'Method not allowed' }, {
    status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
  });
}
export const POST = readOnly;
export const PUT = readOnly;
export const PATCH = readOnly;
export const DELETE = readOnly;
