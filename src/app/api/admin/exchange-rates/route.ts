import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { authorizeExchangeRateAdmin } from '@/lib/exchange-rate-admin';

/**
 * POST - 更新汇率（管理员功能，预留）
 */
export async function POST(request: NextRequest) {
  try {
    const denied = authorizeExchangeRateAdmin(request);
    if (denied) return denied;

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
    const denied = authorizeExchangeRateAdmin(request);
    if (denied) return denied;

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
