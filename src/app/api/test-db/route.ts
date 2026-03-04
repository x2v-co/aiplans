import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Test 1: Check Supabase connection
    const { data: providers, error: providerError } = await supabase
      .from('providers')
      .select('*')
      .limit(5);

    if (providerError) {
      return NextResponse.json({
        error: 'Provider query failed',
        details: providerError
      }, { status: 500 });
    }

    // Test 2: Check products
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .limit(5);

    if (productError) {
      return NextResponse.json({
        error: 'Product query failed',
        details: productError
      }, { status: 500 });
    }

    // Test 3: Check plans
    const { data: plans, error: planError } = await supabase
      .from('plans')
      .select('*')
      .limit(5);

    if (planError) {
      return NextResponse.json({
        error: 'Plan query failed',
        details: planError
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'ok',
      providersCount: providers?.length || 0,
      productsCount: products?.length || 0,
      plansCount: plans?.length || 0,
      providers: providers || [],
      products: products || [],
      plans: plans || [],
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
