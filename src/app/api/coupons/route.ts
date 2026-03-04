import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select(`
        *,
        providers:provider_id (
          id,
          name,
          slug,
          logo
        )
      `)
      .order('is_verified', { ascending: false })
      .order('discount_value', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
  }
}
