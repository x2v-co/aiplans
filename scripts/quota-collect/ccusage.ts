import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { CollectorSkipped, count, opaqueLabel, safeName, uniqueSamples, type Collector, type Sample } from './types';

/** Standard daily JSON only. Never retain project names, prompts or arbitrary export fields.
 * Formats: https://ccusage.com/guide/json-output and /guide/daily-reports
 */
export const ccusage: Collector = {
  id: 'ccusage',
  async collect(opts) {
    const accountLabel = opaqueLabel(opts.accountLabel);
    if (!opts.ccusageJson) throw new CollectorSkipped('ccusage: input not configured: needs --ccusage-json FILE from ccusage daily --json');
    if (!opts.ccusagePlan || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(opts.ccusagePlan)) {
      throw new Error('ccusage needs --ccusage-plan PLAN_SLUG (daily JSON does not identify the paid plan)');
    }
    const json = JSON.parse(await readFile(opts.ccusageJson, 'utf8'));
    const rows: unknown = json.daily ?? (json.type === 'daily' ? json.data : undefined);
    if (!Array.isArray(rows)) throw new Error('Expected standard ccusage daily JSON (daily[] or type=daily/data[]); project-grouped reports are unsupported');
    const samples: Sample[] = rows.map((row) => {
      if (!row || typeof row !== 'object' || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
        || !Number.isFinite(Date.parse(row.date)) || new Date(row.date).toISOString().slice(0, 10) !== row.date) {
        throw new Error('Invalid ccusage daily date');
      }
      const models = row.modelsUsed ?? row.models;
      const model = Array.isArray(models) && models.length === 1 ? safeName(models[0]) : null;
      const tokens = {
        tokensInput: count(row.inputTokens), tokensCached: count(row.cacheReadTokens),
        tokensCacheWrite: count(row.cacheCreationTokens), tokensOutput: count(row.outputTokens), tokensReasoning: null,
      };
      if (tokens.tokensInput === null || tokens.tokensOutput === null) throw new Error('ccusage daily row lacks inputTokens/outputTokens');
      return {
        ...tokens, planSlug: opts.ccusagePlan!, collector: 'ccusage', accountLabel,
        observedAt: `${row.date}T00:00:00.000Z`, window: 'daily', windowMinutes: 1440,
        resetsAt: null, usedPct: null, model,
        raw: { source: 'ccusage-daily', eventId: createHash('sha256').update(JSON.stringify([accountLabel, row.date])).digest('hex') },
        confidence: 'medium', // No quota meter or independently verified plan in this export.
      };
    });
    return uniqueSamples(samples);
  },
};
