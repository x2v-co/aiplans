import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/planprice-v1-snapshot';
import {
  canonicalPriceUnit,
  channelKey,
  fullKey,
  type Observation,
  type Rejection,
} from '@/lib/citable-price-facts';

/** Initial denoising setting. A smaller move can still be real; this only keeps drafts shorter. */
export const DEFAULT_CHANGE_THRESHOLD_PERCENT = 15;

export interface RadarOptions {
  thresholdPercent?: number;
  asOf?: Date;
  maxAgeDays?: number;
  fixture?: boolean;
  previousSnapshotId?: string | null;
  currentSnapshotId?: string | null;
  previousAsOf?: string | null;
  currentAsOf?: string | null;
  duplicatesCollapsed?: number;
  previousExcludedCounts?: Record<string, number>;
  currentExcludedCounts?: Record<string, number>;
}

export interface PriceComponentChange {
  component: 'input' | 'output' | 'cached_input';
  old_price: number;
  new_price: number;
  change_percent: number;
}

export interface PriceChangeEvent {
  event_id: string;
  model_slug: string;
  model_name: string;
  provider_slug: string;
  provider_name: string;
  currency: string;
  price_unit: string;
  billing_conditions: string;
  source_url_previous: string;
  source_url_current: string;
  verified_at_previous: string;
  verified_at_current: string;
  citation_url_en: string;
  citation_url_zh: string;
  components: PriceComponentChange[];
  threshold_percent: number;
}

export interface WithheldChange {
  identity: string;
  reason: string;
  detail?: string;
}

export interface HistoryRow {
  model_slug?: unknown;
  model_name?: unknown;
  provider_slug?: unknown;
  provider_name?: unknown;
  old_currency?: unknown;
  new_currency?: unknown;
  currency?: unknown;
  old_price_unit?: unknown;
  new_price_unit?: unknown;
  price_unit?: unknown;
  old_billing_conditions?: unknown;
  new_billing_conditions?: unknown;
  billing_conditions?: unknown;
  old_input_price?: unknown;
  new_input_price?: unknown;
  old_output_price?: unknown;
  new_output_price?: unknown;
  old_cached_input_price?: unknown;
  new_cached_input_price?: unknown;
  source_url_previous?: unknown;
  source_url_current?: unknown;
  source_url?: unknown;
  source?: unknown;
  verified_at_previous?: unknown;
  verified_at_current?: unknown;
  verified_at?: unknown;
  change_percent?: unknown;
  channel_price_id?: unknown;
  recorded_at?: unknown;
}

export interface RadarReport {
  schema: 'aiplans-price-change-radar/1';
  threshold_percent: number;
  fixture: boolean;
  baseline_only: boolean;
  previous_snapshot_id: string | null;
  current_snapshot_id: string | null;
  previous_as_of: string | null;
  current_as_of: string | null;
  publishable_events: PriceChangeEvent[];
  withheld: WithheldChange[];
  withheld_counts: Record<string, number>;
  duplicates_collapsed: number;
  history_rows_reviewed: number;
  history_publishable_events: PriceChangeEvent[];
  history_withheld_counts: Record<string, number>;
  previous_excluded_counts: Record<string, number>;
  current_excluded_counts: Record<string, number>;
}

const REASON_TEXT = {
  en: {
    below_threshold: 'below the denoising threshold',
    zero_value: 'a zero price makes the move incomparable',
    stale: 'verification is older than the staleness window',
    unverified: 'verification time is missing',
    missing_source: 'a verifiable https source is missing',
    missing_price: 'a comparable input or output price is missing',
    currency_changed: 'currency changed',
    unit_changed: 'price unit changed',
    condition_changed: 'billing conditions changed',
    billing_scope_changed: 'more than one billing field changed',
    ambiguous_channel_rows: 'more than one previous row shares the channel',
    ambiguous_duplicate: 'duplicate rows disagree',
    version_replaced: 'model version was replaced',
    new_listing: 'no previous row for this model and channel',
    not_in_current_rows: 'absent from the current rows',
    baseline_without_previous: 'no previous snapshot',
    incomplete_history: 'the history row lacks same-scope fields',
    currency_pair_changed: 'old and new currencies differ',
    source_unverified: 'history source URLs are not both https',
  },
  zh: {
    below_threshold: '变化低于去噪阈值',
    zero_value: '出现零值，不能当作同口径调价',
    stale: '核验时间早于有效窗口',
    unverified: '缺少核验时间',
    missing_source: '缺少可核验的 https 来源',
    missing_price: '缺少可比较的输入或输出价格',
    currency_changed: '币种变了',
    unit_changed: '计价单位变了',
    condition_changed: '计费条件变了',
    billing_scope_changed: '币种、单位或计费条件里有多项变化',
    ambiguous_channel_rows: '同一渠道有多条上一份记录',
    ambiguous_duplicate: '重复记录彼此不一致',
    version_replaced: '模型版本被替换',
    new_listing: '上一份里没有这个模型与渠道',
    not_in_current_rows: '当前记录里没有这一行',
    baseline_without_previous: '没有上一份快照',
    incomplete_history: '历史行缺少同口径字段',
    currency_pair_changed: '新旧币种不同',
    source_unverified: '历史来源不是两条 https 链接',
  },
} as const;

function thresholdOf(options: RadarOptions | undefined): number {
  const value = options?.thresholdPercent ?? DEFAULT_CHANGE_THRESHOLD_PERCENT;
  if (!Number.isFinite(value) || value < 0) throw new Error('thresholdPercent must be a non-negative finite number');
  return value;
}

function signedPercent(oldPrice: number, newPrice: number): number {
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

function meetsThreshold(percent: number, threshold: number): boolean {
  return Math.abs(percent) + 1e-6 >= threshold;
}

function eventId(event: Omit<PriceChangeEvent, 'event_id'>): string {
  return `sha256:${createHash('sha256').update(canonicalJson({
    model_slug: event.model_slug,
    provider_slug: event.provider_slug,
    currency: event.currency,
    price_unit: event.price_unit,
    billing_conditions: event.billing_conditions,
    components: event.components,
  }), 'utf8').digest('hex')}`;
}

function component(name: PriceComponentChange['component'], previous: number | null, next: number | null): PriceComponentChange | null {
  if (previous === null || next === null || previous <= 0 || next <= 0) return null;
  return { component: name, old_price: previous, new_price: next, change_percent: signedPercent(previous, next) };
}

function comparePair(previous: Observation, current: Observation, threshold: number): { event: PriceChangeEvent | null; withheld: WithheldChange | null } {
  const identity = fullKey(current);
  const withhold = current.withhold ?? previous.withhold;
  if (withhold) return { event: null, withheld: { identity, reason: withhold } };
  if (previous.zero_price || current.zero_price) return { event: null, withheld: { identity, reason: 'zero_value' } };
  if (!previous.source_url || !current.source_url || !previous.verified_at || !current.verified_at) {
    return { event: null, withheld: { identity, reason: 'missing_source' } };
  }
  const components = [
    component('input', previous.input_price, current.input_price),
    component('output', previous.output_price, current.output_price),
    component('cached_input', previous.cached_input_price, current.cached_input_price),
  ].filter((item): item is PriceComponentChange => item !== null);
  if (components.length === 0) return { event: null, withheld: { identity, reason: 'missing_price' } };
  const largest = Math.max(...components.map((item) => Math.abs(item.change_percent)));
  if (!components.some((item) => meetsThreshold(item.change_percent, threshold))) {
    return { event: null, withheld: { identity, reason: 'below_threshold', detail: `max_abs_percent=${largest.toFixed(2)}` } };
  }
  const draft = {
    model_slug: current.model_slug,
    model_name: current.model_name,
    provider_slug: current.provider_slug,
    provider_name: current.provider_name,
    currency: current.currency,
    price_unit: current.price_unit,
    billing_conditions: current.billing_conditions,
    source_url_previous: previous.source_url,
    source_url_current: current.source_url,
    verified_at_previous: previous.verified_at,
    verified_at_current: current.verified_at,
    citation_url_en: current.citation_url_en,
    citation_url_zh: current.citation_url_zh,
    components,
    threshold_percent: threshold,
  };
  return { event: { ...draft, event_id: eventId(draft) }, withheld: null };
}

function mismatch(previous: Observation, current: Observation): WithheldChange {
  const reasons: string[] = [];
  if (previous.currency !== current.currency) reasons.push('currency_changed');
  if (previous.price_unit !== current.price_unit) reasons.push('unit_changed');
  if (previous.billing_conditions !== current.billing_conditions) reasons.push('condition_changed');
  return {
    identity: channelKey(current),
    reason: reasons.length === 1 ? reasons[0] : 'billing_scope_changed',
    detail: reasons.length > 1 ? reasons.join('+') : undefined,
  };
}

function countsOf(rows: WithheldChange[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function readPositive(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function readTime(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function classifyPriceHistoryRow(row: HistoryRow, options: RadarOptions & { asOf?: Date; maxAgeDays?: number } = {}): { event: PriceChangeEvent | null; reason: string; detail?: string } {
  const threshold = thresholdOf(options);
  const asOf = options.asOf ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? 30;
  const model = typeof row.model_slug === 'string' ? row.model_slug.trim() : '';
  const provider = typeof row.provider_slug === 'string' ? row.provider_slug.trim() : '';
  const oldCurrency = typeof row.old_currency === 'string' ? row.old_currency.trim().toUpperCase() : '';
  const newCurrency = typeof row.new_currency === 'string' ? row.new_currency.trim().toUpperCase() : '';
  const oldUnit = canonicalPriceUnit(row.old_price_unit);
  const newUnit = canonicalPriceUnit(row.new_price_unit);
  const oldConditions = typeof row.old_billing_conditions === 'string' ? row.old_billing_conditions : '';
  const newConditions = typeof row.new_billing_conditions === 'string' ? row.new_billing_conditions : '';
  const previousSource = httpsUrl(row.source_url_previous);
  const currentSource = httpsUrl(row.source_url_current);
  const previousVerified = readTime(row.verified_at_previous);
  const currentVerified = readTime(row.verified_at_current);
  if (!model || !provider || !oldCurrency || !newCurrency || !oldUnit || !newUnit || !oldConditions || !newConditions || !previousSource || !currentSource || !previousVerified || !currentVerified) {
    return { event: null, reason: 'incomplete_history' };
  }
  if (oldCurrency !== newCurrency) return { event: null, reason: 'currency_pair_changed' };
  if (oldUnit !== newUnit) return { event: null, reason: 'unit_changed' };
  if (oldConditions !== newConditions) return { event: null, reason: 'condition_changed' };
  const staleCutoff = asOf.getTime() - maxAgeDays * 86_400_000;
  if (previousVerified.getTime() > asOf.getTime() || currentVerified.getTime() > asOf.getTime() || previousVerified.getTime() < staleCutoff || currentVerified.getTime() < staleCutoff) {
    return { event: null, reason: 'stale' };
  }
  const oldInput = readPositive(row.old_input_price);
  const newInput = readPositive(row.new_input_price);
  const oldOutput = readPositive(row.old_output_price);
  const newOutput = readPositive(row.new_output_price);
  if (!oldInput || !newInput || !oldOutput || !newOutput) return { event: null, reason: 'zero_value' };
  const components = [
    component('input', oldInput, newInput),
    component('output', oldOutput, newOutput),
    component('cached_input', readPositive(row.old_cached_input_price), readPositive(row.new_cached_input_price)),
  ].filter((item): item is PriceComponentChange => item !== null);
  if (!components.some((item) => meetsThreshold(item.change_percent, threshold))) {
    const largest = Math.max(...components.map((item) => Math.abs(item.change_percent)));
    return { event: null, reason: 'below_threshold', detail: `max_abs_percent=${largest.toFixed(2)}` };
  }
  const modelName = typeof row.model_name === 'string' && row.model_name.trim() ? row.model_name.trim() : model;
  const providerName = typeof row.provider_name === 'string' && row.provider_name.trim() ? row.provider_name.trim() : provider;
  const draft = {
    model_slug: model,
    model_name: modelName,
    provider_slug: provider,
    provider_name: providerName,
    currency: newCurrency,
    price_unit: newUnit,
    billing_conditions: newConditions,
    source_url_previous: previousSource,
    source_url_current: currentSource,
    verified_at_previous: previousVerified.toISOString(),
    verified_at_current: currentVerified.toISOString(),
    citation_url_en: `https://aiplans.dev/en/models/${model}`,
    citation_url_zh: `https://aiplans.dev/zh/models/${model}`,
    components,
    threshold_percent: threshold,
  };
  return { event: { ...draft, event_id: eventId(draft) }, reason: 'event' };
}

export function analyzeObservations(
  previous: Observation[] | null,
  current: Observation[],
  options: RadarOptions = {},
  historyRows: HistoryRow[] = [],
  currentRejections: Rejection[] = [],
): RadarReport {
  const threshold = thresholdOf(options);
  const withheld: WithheldChange[] = [];
  const events: PriceChangeEvent[] = [];
  let duplicates = options.duplicatesCollapsed ?? 0;
  const baseline = previous === null;
  if (baseline) {
    withheld.push({ identity: '*', reason: 'baseline_without_previous' });
  } else {
    const consumed = new Set<string>();
    for (const item of current) {
      const exact = previous.find((candidate) => fullKey(candidate) === fullKey(item));
      if (exact) {
        const compared = comparePair(exact, item, threshold);
        if (compared.event) events.push(compared.event);
        if (compared.withheld) withheld.push(compared.withheld);
        consumed.add(fullKey(exact));
        continue;
      }
      if (item.replaces_model_slug) {
        const replaced = previous.filter((candidate) => candidate.provider_slug === item.provider_slug && candidate.model_slug === item.replaces_model_slug);
        if (replaced.length > 0) {
          for (const candidate of replaced) consumed.add(fullKey(candidate));
          withheld.push({ identity: channelKey(item), reason: 'version_replaced', detail: `${replaced.map((candidate) => candidate.model_slug).join(',')} -> ${item.model_slug}` });
          continue;
        }
      }
      const siblings = previous.filter((candidate) => candidate.model_slug === item.model_slug && candidate.provider_slug === item.provider_slug);
      if (siblings.length === 1) {
        withheld.push(mismatch(siblings[0], item));
        consumed.add(fullKey(siblings[0]));
        continue;
      }
      if (siblings.length > 1) {
        for (const candidate of siblings) consumed.add(fullKey(candidate));
        withheld.push({ identity: channelKey(item), reason: 'ambiguous_channel_rows' });
        continue;
      }
      withheld.push({ identity: channelKey(item), reason: 'new_listing' });
    }
    for (const candidate of previous) {
      if (consumed.has(fullKey(candidate))) continue;
      const rejection = currentRejections.find((item) => item.model_slug === candidate.model_slug && item.provider_slug === candidate.provider_slug);
      withheld.push({ identity: channelKey(candidate), reason: rejection?.reason ?? 'not_in_current_rows' });
    }
  }

  const historyWithheld: WithheldChange[] = [];
  const historyEvents: PriceChangeEvent[] = [];
  const seen = new Set(events.map((event) => event.event_id));
  for (const row of historyRows) {
    const classified = classifyPriceHistoryRow(row, { ...options, thresholdPercent: threshold });
    if (classified.event) {
      if (seen.has(classified.event.event_id)) duplicates += 1;
      else {
        seen.add(classified.event.event_id);
        historyEvents.push(classified.event);
      }
      continue;
    }
    historyWithheld.push({ identity: typeof row.model_slug === 'string' ? row.model_slug : '*', reason: classified.reason, detail: classified.detail });
  }

  const uniqueEvents = new Map<string, PriceChangeEvent>();
  for (const event of events) {
    if (uniqueEvents.has(event.event_id)) duplicates += 1;
    else uniqueEvents.set(event.event_id, event);
  }
  const withheldUnique = new Map<string, WithheldChange>();
  for (const item of withheld) {
    const key = `${item.identity}\t${item.reason}`;
    if (withheldUnique.has(key)) duplicates += 1;
    else withheldUnique.set(key, item);
  }

  return {
    schema: 'aiplans-price-change-radar/1',
    threshold_percent: threshold,
    fixture: options.fixture === true,
    baseline_only: baseline,
    previous_snapshot_id: options.previousSnapshotId ?? null,
    current_snapshot_id: options.currentSnapshotId ?? null,
    previous_as_of: options.previousAsOf ?? null,
    current_as_of: options.currentAsOf ?? null,
    publishable_events: [...uniqueEvents.values()].sort((left, right) => left.model_slug.localeCompare(right.model_slug) || left.provider_slug.localeCompare(right.provider_slug)),
    withheld: [...withheldUnique.values()].sort((left, right) => left.identity.localeCompare(right.identity) || left.reason.localeCompare(right.reason)),
    withheld_counts: countsOf([...withheldUnique.values()]),
    duplicates_collapsed: duplicates,
    history_rows_reviewed: historyRows.length,
    history_publishable_events: historyEvents,
    history_withheld_counts: countsOf(historyWithheld),
    previous_excluded_counts: options.previousExcludedCounts ?? {},
    current_excluded_counts: options.currentExcludedCounts ?? {},
  };
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2);
  return `${rounded > 0 ? '+' : ''}${text}%`;
}

function formatPrice(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function renderRadarDraft(report: RadarReport, locale: 'en' | 'zh'): string {
  const zh = locale === 'zh';
  const reasons = REASON_TEXT[locale];
  const lines: string[] = [];
  lines.push(zh ? '# 调价雷达待审稿（不要发送）' : '# Price-change radar draft (do not send)');
  lines.push('');
  if (report.fixture) {
    lines.push(zh
      ? '> 示例数据，不是市场价格，不能当作事实引用。'
      : '> Synthetic fixture. This is not market data and must not be cited as fact.');
    lines.push('');
  }
  lines.push(zh ? '- 状态：待审。不要发布，不要发送到飞书、邮件或外部平台。' : '- Status: draft. Do not publish or send it to Feishu, email, or an external platform.');
  lines.push(zh
    ? `- 去噪阈值：${report.threshold_percent}%（可配置参数，用来减少草稿噪音）`
    : `- Denoising threshold: ${report.threshold_percent}% (a configurable parameter that shortens the draft)`);
  if (report.current_as_of) lines.push(zh ? `- 比较时钟：${report.current_as_of}` : `- Comparison clock: ${report.current_as_of}`);
  lines.push(zh
    ? `- 上一份可引用样本：${report.previous_snapshot_id ?? '无'}`
    : `- Previous citable sample: ${report.previous_snapshot_id ?? 'none'}`);
  lines.push(zh
    ? `- 当前可引用样本：${report.current_snapshot_id ?? '无'}`
    : `- Current citable sample: ${report.current_snapshot_id ?? 'none'}`);
  if (report.baseline_only) {
    lines.push(zh
      ? '- 已用当前样本建立基线。没有上一份快照，所以没有可发的快照对比事件。'
      : '- The current sample is the baseline. There is no previous snapshot, so there is no snapshot-comparison event to publish.');
  }
  lines.push(zh
    ? `- 快照对比可发事件：${report.publishable_events.length}`
    : `- Publishable snapshot-comparison events: ${report.publishable_events.length}`);
  lines.push('');
  lines.push(zh ? '## 可发事件' : '## Publishable events');
  lines.push('');
  if (report.publishable_events.length === 0) {
    lines.push(zh ? '没有可发事件。' : 'No publishable events.');
    lines.push('');
  }
  for (const event of report.publishable_events) {
    lines.push(`### ${event.model_name} / ${event.provider_name}`);
    lines.push('');
    lines.push(`- ${zh ? '模型标识' : 'Model slug'}: \`${event.model_slug}\``);
    lines.push(`- ${zh ? '渠道' : 'Channel'}: \`${event.provider_slug}\``);
    lines.push(`- ${zh ? '币种 / 单位 / 条件' : 'Currency / unit / conditions'}: ${event.currency} / ${event.price_unit} / \`${event.billing_conditions}\``);
    for (const part of event.components) {
      const label = zh
        ? part.component === 'input' ? '输入' : part.component === 'output' ? '输出' : '缓存输入'
        : part.component;
      lines.push(`- ${label}: ${formatPrice(part.old_price)} → ${formatPrice(part.new_price)} (${formatPercent(part.change_percent)})`);
    }
    lines.push(`- ${zh ? '来源（旧）' : 'Previous source'}: ${event.source_url_previous}`);
    lines.push(`- ${zh ? '来源（新）' : 'Current source'}: ${event.source_url_current}`);
    lines.push(`- ${zh ? '核验（旧）' : 'Previous verification'}: ${event.verified_at_previous}`);
    lines.push(`- ${zh ? '核验（新）' : 'Current verification'}: ${event.verified_at_current}`);
    lines.push(`- ${zh ? '本站引用' : 'Site citation'}: ${zh ? event.citation_url_zh : event.citation_url_en}`);
    lines.push('');
  }
  lines.push(zh ? '## 未作为事件发出' : '## Not emitted as events');
  lines.push('');
  if (report.withheld.length === 0) lines.push(zh ? '无。' : 'None.');
  for (const item of report.withheld) {
    const text = reasons[item.reason as keyof typeof reasons] ?? item.reason;
    lines.push(`- \`${item.identity.replaceAll('\t', ' / ')}\`: ${item.reason} (${text})${item.detail ? `; ${item.detail}` : ''}`);
  }
  lines.push('');
  lines.push(zh ? '## 未进入可引用样本' : '## Left out of the citable sample');
  lines.push('');
  const excluded = Object.entries(report.current_excluded_counts);
  if (excluded.length === 0) lines.push(zh ? '当前样本没有排除计数。' : 'The current sample has no exclusion counts.');
  for (const [reason, count] of excluded) lines.push(`- ${reason}: ${count}`);
  lines.push('');
  lines.push(zh ? '## 价格历史日志' : '## Price-history log');
  lines.push('');
  lines.push(zh
    ? `审阅 ${report.history_rows_reviewed} 行。其中可单独成稿 ${report.history_publishable_events.length} 行。现有 price_history 只保存一条币种和价格，没有新旧单位、计费条件、来源链接和两侧核验时间，这种行会记为 incomplete_history，不会变成事件。`
    : `Reviewed ${report.history_rows_reviewed} rows. ${report.history_publishable_events.length} can stand alone as drafts. A stock price_history row stores one currency and the prices, without old/new units, billing conditions, source URLs, and verification times on both sides. Those rows stay incomplete_history and do not become events.`);
  if (report.history_publishable_events.length === 0) {
    lines.push(zh ? '历史日志没有可发事件。' : 'The history log has no publishable events.');
  }
  for (const [reason, count] of Object.entries(report.history_withheld_counts)) {
    lines.push(`- ${reason}: ${count}`);
  }
  lines.push('');
  lines.push(zh
    ? '同口径指同一模型标识、同一渠道、同一币种、同一计价单位和同一计费条件。缺失、零值、单位或币种变化、新上架、版本替换、过期或未核验，都不进入可发事件。'
    : 'Same scope means the same model slug, channel, currency, price unit, and billing conditions. Missing values, zeros, unit or currency changes, new listings, version replacements, stale rows, and unverified rows stay out of the publishable events.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}
