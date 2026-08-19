import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * 汇率 API 端点
 * 每天更新一次汇率，简化版
 */

export async function GET(request: NextRequest) {
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
          hint: 'Use PUT /api/exchange-rates with authorization to fetch rates from Open Exchange Rates API',
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

/**
 * POST - 更新汇率（管理员功能，预留）
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.EXCHANGE_RATE_API_KEY || 'demo-update-key';
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { from, to, rate } = body;

    if (!from || !to || !rate) {
      return NextResponse.json({ error: 'Missing required fields: from, to, rate' }, { status: 400 });
    }

    const [data] = await sql<any[]>`
      INSERT INTO exchange_rates (
        from_currency, to_currency, rate, source, is_active, valid_at, updated_at
      ) VALUES (
        ${from}, ${to}, ${parseFloat(rate)}, 'manual', true, NOW(), NOW()
      )
      ON CONFLICT (from_currency, to_currency) DO UPDATE SET
        rate = EXCLUDED.rate,
        source = EXCLUDED.source,
        is_active = true,
        valid_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      rate: {
        from,
        to,
      },
      updated: data.updated_at,
    });
  } catch (error) {
    console.error('Update exchange rate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - 刷新所有汇率（从 Open Exchange Rates API 获取）
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.EXCHANGE_RATE_API_KEY || 'demo-update-key';
    if (authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取免费汇率数据
    const ratesResponse = await fetch('https://openexchangerates.org/api/latest.json', {
      headers: {
        'User-Agent': 'PlanPrice-Scraper/1.0',
      },
    });

    if (!ratesResponse.ok) {
      throw new Error(`Failed to fetch rates: ${ratesResponse.statusText}`);
    }

    const ratesData = await ratesResponse.json();

    // USD 是基准货币
    const usdRates = ratesData.rates as Record<string, number>;
    const currencies = ['CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'SGD'];

    // 批量更新汇率
    const now = new Date().toISOString();
    const updates = [];

    for (const currency of currencies) {
      if (!usdRates[currency]) continue;

      const [data] = await sql<any[]>`
        INSERT INTO exchange_rates (
          from_currency, to_currency, rate, source, is_active, valid_at, updated_at
        ) VALUES (
          'USD', ${currency}, ${usdRates[currency]}, 'openexchangerates', true, NOW(), NOW()
        )
        ON CONFLICT (from_currency, to_currency) DO UPDATE SET
          rate = EXCLUDED.rate,
          source = EXCLUDED.source,
          is_active = true,
          valid_at = NOW(),
          updated_at = NOW()
        RETURNING id
      `;

      if (data) {
        updates.push(`USD->${currency}: ${usdRates[currency]}`);
      }
    }

    console.log(`✅ Updated ${updates.length} exchange rates from Open Exchange Rates`);

    return NextResponse.json({
      success: true,
      updated: updates,
      count: updates.length,
      timestamp: now,
    });
  } catch (error) {
    console.error('Refresh exchange rates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
