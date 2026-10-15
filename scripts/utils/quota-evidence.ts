import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parse } from 'yaml';
import { measuredQuota, type Range } from '../../src/lib/quota/engine';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = z.number().positive().finite();
const pct = z.number().min(0).max(100);
const link = z.url().refine((value) => ['https:', 'http:'].includes(new URL(value).protocol), 'Use an HTTP(S) URL');
const tokens = z.strictObject({ input: count, cached_input: count, output: count });
const prices = z.strictObject({ input: z.number().nonnegative(), cached_input: z.number().nonnegative(), output: z.number().nonnegative() });
const mix = z.strictObject({ cache_read_pct: pct, input_pct: pct, output_pct: pct })
  .refine((value) => Math.abs(value.cache_read_pct + value.input_pct + value.output_pct - 100) < 1e-9, 'Mix must sum to 100');

/** No inferred vendor prices, workload, or reset cadence. Unknown fields are errors. */
export const evidenceSchema = z.strictObject({
  plan_slug: z.string().trim().min(1),
  source_name: z.string().trim().min(1),
  url: link.optional(),
  screenshot_url: link.optional(),
  author_handle: z.string().trim().min(1).optional(),
  // Curator-attested original reporter. Reposts must retain the same key.
  independent_source_id: z.string().trim().min(1).optional(),
  observed_at: z.iso.datetime({ offset: true }),
  captured_at: z.iso.date(),
  raw_value: z.string().trim().min(1),
  tokens: tokens.optional(),
  quota_pct_before: pct.optional(),
  quota_pct_after: pct.optional(),
  window: z.enum(['5h', 'daily', 'weekly', 'monthly']).optional(),
  usage_mix_id: z.string().trim().min(1).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().default(''),
  calculation: z.strictObject({
    list_prices: prices,
    mix,
    windows_per_week: positive.optional(),
    pct_rounding_uncertainty: z.number().nonnegative().optional(),
  }).optional(),
}).superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (!value.url && !value.screenshot_url) issue('url or screenshot_url is required');
  if (new Date(value.observed_at).toISOString().slice(0, 10) > value.captured_at) {
    issue('captured_at must not precede observed_at (UTC date)');
  }
  if ((value.quota_pct_before === undefined) !== (value.quota_pct_after === undefined)) issue('Both percentage readings are required');
  if (value.quota_pct_before !== undefined && value.quota_pct_after! <= value.quota_pct_before) issue('Consumed percentage must increase in the same reset window');
  if (value.calculation && (!value.tokens || value.quota_pct_before === undefined || !value.window || !value.usage_mix_id)) {
    issue('calculation requires tokens, both percentages, window and usage_mix_id');
  }
  if (value.calculation && (value.window === '5h' || value.window === 'daily') && !value.calculation.windows_per_week) {
    issue('Short windows require an explicit windows_per_week assumption');
  }
});

export type Evidence = z.infer<typeof evidenceSchema>;

export function parseEvidence(text: string, filename: string): Evidence {
  const value: unknown = /\.json$/i.test(filename) ? JSON.parse(text) : parse(text, { maxAliasCount: 0 });
  return evidenceSchema.parse(value);
}

export function monthlyRange(evidence: Evidence): Range | undefined {
  if (!evidence.calculation) return undefined;
  const { list_prices: p, mix: m } = evidence.calculation;
  return measuredQuota({
    tokensConsumed: { input: evidence.tokens!.input, cachedInput: evidence.tokens!.cached_input, output: evidence.tokens!.output },
    listPrices: { input: p.input, cachedInput: p.cached_input, output: p.output },
    mix: { cacheReadPct: m.cache_read_pct, inputPct: m.input_pct, outputPct: m.output_pct },
    quotaPctBefore: evidence.quota_pct_before!, quotaPctAfter: evidence.quota_pct_after!,
    windowKind: evidence.window!, windowsPerWeek: evidence.calculation.windows_per_week,
    pctRoundingUncertainty: evidence.calculation.pct_rounding_uncertainty,
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Hash the observation, excluding capture/review metadata so recaptures dedupe. */
export function evidenceHash(e: Evidence): string {
  return createHash('sha256').update(canonical({
    plan_slug: e.plan_slug, source_name: e.source_name.toLowerCase(),
    url: e.url ?? null, screenshot_url: e.screenshot_url ?? null,
    author_handle: e.author_handle ?? null, observed_at: new Date(e.observed_at).toISOString(),
    raw_value: e.raw_value, tokens: e.tokens ?? null, quota_pct_before: e.quota_pct_before ?? null,
    quota_pct_after: e.quota_pct_after ?? null, window: e.window ?? null,
  })).digest('hex');
}

export function planInsert(e: Evidence) {
  const range = monthlyRange(e);
  // Requested confidence is advisory; community intake can never establish high.
  const confidence = range ? 'medium' : 'low';
  const derivation = e.calculation ? `\nIntake calculation: ${canonical(e.calculation)}; usage_mix_id=${e.usage_mix_id}; implied monthly tokens=${canonical({ low: range!.low, high: range!.high })}` : '';
  return {
    plan_slug: e.plan_slug, evidence_type: e.source_name === 'self' || e.source_name === 'ccusage' ? 'self_measured' : 'community',
    url: e.url ?? null, screenshot_url: e.screenshot_url ?? null,
    captured_at: e.captured_at, observed_at: new Date(e.observed_at).toISOString(),
    source_name: e.source_name, author_handle: e.author_handle ?? null,
    raw_value: e.raw_value, tokens_input: e.tokens?.input ?? null,
    tokens_cached: e.tokens?.cached_input ?? null, tokens_output: e.tokens?.output ?? null,
    quota_pct_before: e.quota_pct_before ?? null, quota_pct_after: e.quota_pct_after ?? null,
    window: e.window ?? null, usage_mix_id: e.usage_mix_id ?? null,
    confidence, review_status: 'pending', reviewed_at: null,
    content_hash: evidenceHash(e),
    notes: `${e.notes}${derivation}${e.independent_source_id ? `\nIndependent origin (curator assertion): ${e.independent_source_id}` : ''}\nRequested confidence: ${e.confidence}; intake confidence: ${confidence}`.trim(),
  };
}

/** Suggestions only: same comparison assumptions, distinct attested origins, <=30% midpoint spread. */
export function agreementSuggestions(evidence: Evidence[]): string[] {
  const suggestions = new Set<string>();
  const seen = new Set<string>();
  const measured = evidence.filter((e) => {
    const hash = evidenceHash(e);
    if (seen.has(hash)) return false;
    seen.add(hash);
    return Boolean(e.independent_source_id && e.calculation);
  }).map((e) => ({ e, range: monthlyRange(e)! }));
  for (let i = 0; i < measured.length; i++) {
    for (let j = i + 1; j < measured.length; j++) {
      const a = measured[i], b = measured[j];
      if (a.e.plan_slug !== b.e.plan_slug || a.e.window !== b.e.window || a.e.usage_mix_id !== b.e.usage_mix_id
        || canonical(a.e.calculation) !== canonical(b.e.calculation)
        || a.e.independent_source_id === b.e.independent_source_id
        || (a.e.author_handle && a.e.author_handle === b.e.author_handle)) continue;
      const midA = (a.range.low + a.range.high) / 2, midB = (b.range.low + b.range.high) / 2;
      if (Math.max(midA, midB) / Math.min(midA, midB) <= 1.3) {
        suggestions.add(`${a.e.plan_slug}: medium suggestion — independent origins ${a.e.independent_source_id} and ${b.e.independent_source_id} agree within 30%; manual review required`);
      }
    }
  }
  return [...suggestions];
}

export const ccusageSchema = z.object({ daily: z.array(z.object({
  date: z.iso.date(), inputTokens: count, outputTokens: count,
  cacheCreationTokens: count, cacheReadTokens: count,
  totalCost: z.number().nonnegative().finite(), modelsUsed: z.array(z.string()),
})).min(1) });

/** One daily sample; combining days could silently cross quota resets. */
export function ccusageDraft(value: unknown, options: { plan: string; before: number; after: number; date?: string; url?: string; screenshotUrl?: string }, now = new Date()) {
  const { daily } = ccusageSchema.parse(value);
  const samples = options.date ? daily.filter((day) => day.date === options.date) : daily;
  if (samples.length !== 1) throw new Error('Select exactly one daily sample with --date YYYY-MM-DD (multiple days may cross resets)');
  const day = samples[0];
  const readings = z.object({ before: pct, after: pct }).refine((v) => v.after > v.before, 'Consumed percentage must increase').parse(options);
  if (!options.plan.trim()) throw new Error('--plan must not be empty');
  if (options.url) link.parse(options.url);
  if (options.screenshotUrl) link.parse(options.screenshotUrl);
  return {
    plan_slug: options.plan, source_name: 'ccusage',
    ...(options.url ? { url: options.url } : {}), ...(options.screenshotUrl ? { screenshot_url: options.screenshotUrl } : {}),
    observed_at: `${day.date}T00:00:00.000Z`, captured_at: now.toISOString().slice(0, 10),
    raw_value: JSON.stringify(day),
    tokens: { input: day.inputTokens, cached_input: day.cacheReadTokens, output: day.outputTokens },
    quota_pct_before: readings.before, quota_pct_after: readings.after,
    confidence: 'low',
    notes: `DRAFT: verify observed_at (daily export gives date only) and readings cover exactly this sample in one reset window. Models: ${day.modelsUsed.join(', ')}. Reported cost USD: ${day.totalCost}. Cache creation tokens (${day.cacheCreationTokens}) are excluded: the engine has no cache-write category; justify their treatment before derivation. Add source URL/screenshot, window, usage_mix_id and explicit calculation prices/mix/cadence before intake.`,
  };
}

export type IntakeOptions = { apply: boolean; files: string[]; review?: { id: number; status: 'accepted' | 'rejected' }; ccusage?: string; plan?: string; before?: number; after?: number; date?: string; url?: string; screenshotUrl?: string; output?: string };

export function intakeOptions(args: string[]): IntakeOptions {
  const result: IntakeOptions = { apply: false, files: [] };
  const values: Record<string, string> = {};
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') { result.apply = true; continue; }
    if (arg === '--dry-run') { dryRun = true; continue; }
    if (['--review', '--from-ccusage', '--plan', '--pct-before', '--pct-after', '--date', '--url', '--screenshot-url', '--output'].includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} requires a value`);
      if (values[arg] !== undefined) throw new Error(`Duplicate option ${arg}`);
      values[arg] = args[++i];
      if (arg === '--review') {
        const action = args[++i];
        if (!/^[1-9]\d*$/.test(values[arg]) || !Number.isSafeInteger(Number(values[arg])) || !['accept', 'reject'].includes(action)) throw new Error('Use --review <positive id> accept|reject --apply');
        result.review = { id: Number(values[arg]), status: action === 'accept' ? 'accepted' : 'rejected' };
      }
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    if (!/\.(json|ya?ml)$/i.test(arg)) throw new Error(`Expected a JSON/YAML file: ${arg}`);
    result.files.push(arg);
  }
  if (dryRun && result.apply) throw new Error('--dry-run and --apply are mutually exclusive');
  if (result.review && !result.apply) throw new Error('--review requires --apply');
  result.ccusage = values['--from-ccusage'];
  if (result.review && (result.files.length || Object.keys(values).length > 1)) throw new Error('--review cannot be combined with intake/import');
  const importKeys = Object.keys(values).filter((key) => key !== '--review');
  if (!result.ccusage && importKeys.length) throw new Error('Import options require --from-ccusage');
  if (result.ccusage) {
    if (result.apply || result.files.length) throw new Error('--from-ccusage only generates a draft; it cannot apply/intake');
    if (!values['--plan'] || values['--pct-before'] === undefined || values['--pct-after'] === undefined) throw new Error('ccusage requires --plan, --pct-before and --pct-after');
    Object.assign(result, { plan: values['--plan'], before: Number(values['--pct-before']), after: Number(values['--pct-after']), date: values['--date'], url: values['--url'], screenshotUrl: values['--screenshot-url'], output: values['--output'] });
  }
  return result;
}
