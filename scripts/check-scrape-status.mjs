#!/usr/bin/env node
import process from 'node:process';

const base = process.env.PLANPRICE_PUBLIC_URL ?? 'https://aiplans.dev';
const maxAgeHours = Number(process.env.PLANPRICE_MAX_RATE_AGE_HOURS ?? 30);
const result = { schemaVersion: 'planprice.scrape-status.v1', checkedAt: new Date().toISOString(), baseUrl: base };
try {
  const response = await fetch(new URL('/api/exchange-rates', base), { redirect: 'error', signal: AbortSignal.timeout(10_000) });
  const body = await response.json();
  const updatedAt = Date.parse(body.lastUpdated);
  const ageHours = Number.isFinite(updatedAt) ? (Date.now() - updatedAt) / 3_600_000 : null;
  const output = { ...result, httpStatus: response.status, lastUpdated: body.lastUpdated ?? null, ageHours, sources: body.sources ?? {}, status: response.ok && ageHours !== null && ageHours <= maxAgeHours ? 'fresh' : 'stale' };
  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.status === 'fresh' ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ ...result, status: 'unreachable', error: error instanceof Error ? error.message : 'unknown' }, null, 2));
  process.exitCode = 1;
}
