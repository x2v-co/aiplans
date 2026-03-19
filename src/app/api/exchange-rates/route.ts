import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 汇率 API 端点
 * 每天更新一次汇率，简化版
 */

export async function GET(request: NextRequest) {
  try {
    // Query exchange rates from database
    const { data: rates, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch exchange rates from database', details: error.message },
        { status: 500 }
      );
    }

    if (!rates || rates.length === 0) {
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

    const now = new Date().toISOString();

    // 使用 ON CONFLICT DO NOTHING 避免约束冲突
    const { data, error } = await supabase
      .from('exchange_rates')
      .upsert({
        from_currency: from,
        to_currency: to,
        rate: parseFloat(rate),
        source: 'manual',
        updated_at: now,
        is_active: true,
      }, {
        onConflict: 'from_currency,to_currency',
      })
      .select()
      .single();

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
    const currencies = ['CNY', 'EUR', 'GBP', 'JPY', 'KRW'];

    // 批量更新汇率
    const now = new Date().toISOString();
    const updates = [];

    for (const currency of currencies) {
      if (!usdRates[currency]) continue;

      const { data } = await supabase
        .from('exchange_rates')
        .upsert({
          from_currency: 'USD',
          to_currency: currency,
          rate: parseFloat(usdRates[currency].toString()),
          source: 'openexchangerates',
          updated_at: now,
          is_active: true,
        }, {
          onConflict: 'from_currency,to_currency',
        })
        .select()
        .single();

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
