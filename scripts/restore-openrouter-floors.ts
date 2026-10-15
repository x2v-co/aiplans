#!/usr/bin/env tsx
/** Retired by audit #5 (2026-10-15): endpoint floors must never be headlines. */
console.error('restore-openrouter-floors is retired. Apply scripts/sql/2026-10-15-openrouter-default-route-fix.sql, then run npm run scrape -- --provider=OpenRouter. Cheapest endpoints are stored as non-headline variants.');
process.exitCode = 1;
