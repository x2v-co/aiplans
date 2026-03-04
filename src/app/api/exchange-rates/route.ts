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
    // 当前使用固定汇率（数据库表创建后将使用实时汇率）
    const FIXED_RATES = {
      'USD': {
        'CNY': 7.2,
        'EUR': 0.92,
        'GBP': 0.79,
        'JPY': 149.5,
        'KRW': 1320,
      },
      'CNY': { 'USD': 1 / 7.2 },
      'EUR': { 'USD': 1 / 0.92 },
      'GBP': { 'USD': 1 / 0.79 },
      'JPY': { 'USD': 1 / 149.5 },
      'KRW': { 'USD': 1 / 1320 },
      };

    return NextResponse.json({
      rates: FIXED_RATES.USD,
      lastUpdated: new Date().toISOString(),
      sources: {
        fixed: 'hardcoded fallback values (database table setup pending)',
        manualUpdateUrl: '/api/admin/refresh-rates',
        openExchangeRatesUrl: 'https://openexchangerates.org/api/latest.json',
        adminKeyRequired: false,
        enabled: true,
        reason: 'Using ON CONFLICT DO NOTHING to handle constraints',
      },
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
