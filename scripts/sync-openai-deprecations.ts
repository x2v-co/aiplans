#!/usr/bin/env tsx
/** Manual only. Default read-only diff; --apply writes one serializable transaction. */
import { config } from 'dotenv';
import { shutdownSeedMode, OPENAI_DEPRECATION_SOURCE } from './data/openai-shutdowns';
import { parseDeprecationsHtml, parseModelShutdowns } from './data/openai-deprecation-sync';
import { runShutdownSeed } from './seed-openai-shutdowns';

async function main() {
  const mode = shutdownSeedMode(process.argv.slice(2));
  config({ path: '.env.local', quiet: true });
  const apiKey = process.env.OPENAI_API_KEY;
  const response = await fetch(apiKey ? 'https://api.openai.com/v1/models' : OPENAI_DEPRECATION_SOURCE, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Deprecation source HTTP ${response.status}; nothing written.`);
  const shutdowns = apiKey ? parseModelShutdowns(await response.json()) : parseDeprecationsHtml(await response.text());
  if (!shutdowns.length) throw new Error('No explicit shutdown fields/table rows found; nothing written. Review source markup or API permissions.');
  console.log(`Parsed ${shutdowns.length} notices from ${apiKey ? 'GET /v1/models' : OPENAI_DEPRECATION_SOURCE}. Missing rows/fields are not evidence of availability.`);
  await runShutdownSeed(shutdowns, mode);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
