import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [result] = await sql<Array<{ ok: number }>>`SELECT 1 AS ok`;
    if (result?.ok !== 1) throw new Error('Unexpected database response');

    return NextResponse.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'error', database: 'unavailable' },
      { status: 503 },
    );
  }
}
