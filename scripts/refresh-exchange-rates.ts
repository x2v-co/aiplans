import { sql } from '../src/lib/db';

const currencies = ['CNY', 'EUR', 'GBP', 'JPY', 'KRW', 'SGD'];
const endpoint = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,EUR,GBP,JPY,KRW,SGD';

type FrankfurterResponse = { base?: string; date?: string; rates?: Record<string, number> };

async function main() {
  const response = await fetch(endpoint, { headers: { Accept: 'application/json', 'User-Agent': 'PlanPrice-FX/1.0' }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`FX provider returned HTTP ${response.status}`);
  const payload = await response.json() as FrankfurterResponse;
  if (payload.base !== 'USD' || !payload.rates) throw new Error('FX provider returned an invalid USD payload');
  const updates = currencies.map((currency) => ({ currency, rate: payload.rates?.[currency] })).filter((item): item is { currency: string; rate: number } => Number.isFinite(item.rate) && item.rate > 0);
  if (updates.length !== currencies.length) throw new Error(`FX provider omitted currencies: ${currencies.filter((currency) => !updates.some((item) => item.currency === currency)).join(',')}`);

  await sql.begin(async (transaction) => {
    for (const { currency, rate } of updates) {
      await transaction`
        UPDATE exchange_rates
           SET is_active = false, updated_at = NOW()
         WHERE from_currency = 'USD' AND to_currency = ${currency} AND is_active = true
      `;
      await transaction`
        INSERT INTO exchange_rates (from_currency, to_currency, rate, source, is_active, valid_at, updated_at)
        VALUES ('USD', ${currency}, ${rate}, 'frankfurter', true, NOW(), NOW())
      `;
    }
  });
  console.log(JSON.stringify({ schemaVersion: 'planprice-fx-refresh/1', status: 'updated', source: 'frankfurter', currencies: updates.map((item) => item.currency), observedDate: payload.date ?? null }, null, 2));
  await sql.end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error(`exchange-rate refresh failed: ${error instanceof Error ? error.message : String(error)}`);
  await sql.end({ timeout: 5 }).catch(() => undefined);
  process.exitCode = 1;
});
