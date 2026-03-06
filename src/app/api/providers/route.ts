import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Enable ISR with 5 minute revalidation
export const revalidate = 300;

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .order('name');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching providers:', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}
