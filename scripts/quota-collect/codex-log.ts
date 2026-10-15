import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { WindowKind } from '../../src/lib/quota/engine';
import { PLAN_TYPES } from './config';
import { CollectorSkipped, TOKEN_KEYS, count, emptyTokens, opaqueLabel, safeName, uniqueSamples, type Collector, type Sample, type Tokens } from './types';

type Usage = {
  input_tokens?: number; cached_input_tokens?: number; cache_write_input_tokens?: number;
  output_tokens?: number; reasoning_output_tokens?: number;
};
type Meter = { used_percent?: number; window_minutes?: number; resets_at?: number };
type LogLine = {
  timestamp?: string; type?: string;
  payload?: {
    type?: string; id?: string; model?: string;
    info?: { total_token_usage?: Usage; last_token_usage?: Usage };
    rate_limits?: { limit_id?: string; plan_type?: string; primary?: Meter; secondary?: Meter };
  };
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function* sessionFiles(directory: string): AsyncGenerator<string> {
  // Dirent checks intentionally do not follow symlinks outside sessions/.
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) yield* sessionFiles(join(directory, entry.name));
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) yield join(directory, entry.name);
  }
}
function usageTokens(usage?: Usage): Tokens {
  if (!usage) return emptyTokens();
  const input = count(usage.input_tokens);
  const cached = count(usage.cached_input_tokens);
  if (input !== null && cached !== null && cached > input) throw new Error('Cached input exceeds inclusive input');
  return {
    tokensInput: input !== null && cached !== null ? input - cached : null,
    tokensCached: cached, tokensCacheWrite: count(usage.cache_write_input_tokens),
    tokensOutput: count(usage.output_tokens), tokensReasoning: count(usage.reasoning_output_tokens),
  };
}
function windowKind(minutes: number | undefined): WindowKind | undefined {
  return ({ 300: '5h', 1440: 'daily', 10080: 'weekly', 43200: 'monthly' } as Record<number, WindowKind>)[minutes ?? 0];
}

/** Parallel sessions can emit at exactly the same millisecond. The required DB key
 * has no session ID, so combine agreeing meters and retain individual token event IDs.
 * This also lets daily summaries dedupe events when short/weekly meters overlap only partly.
 */
export function coalesceCodexSamples(samples: Sample[]): Sample[] {
  const groups = new Map<string, Sample[]>();
  for (const s of samples) {
    const key = JSON.stringify([s.collector, s.accountLabel, s.observedAt, s.window]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return uniqueSamples([...groups.values()].map((rows) => {
    const first = rows[0];
    if (rows.length === 1) return first;
    for (const s of rows) {
      if (s.planSlug !== first.planSlug || s.usedPct !== first.usedPct || s.resetsAt !== first.resetsAt
        || s.windowMinutes !== first.windowMinutes || s.raw.limitId !== first.raw.limitId) {
        throw new Error(`Conflicting simultaneous Codex meters at ${first.observedAt} (${first.window})`);
      }
    }
    const events = [...new Map(rows.flatMap((s) => s.raw.usageEvents ?? [{ eventId: s.raw.eventId,
      ...Object.fromEntries(TOKEN_KEYS.map((key) => [key, s[key]])) as Tokens,
    }]).map((event) => [event.eventId, event])).values()].sort((a, b) => a.eventId.localeCompare(b.eventId));
    const tokens = Object.fromEntries(TOKEN_KEYS.map((key) => {
      const values = events.flatMap((s) => s[key] === null ? [] : [s[key]]);
      const sum = values.reduce((a, b) => a + b, 0);
      if (!Number.isSafeInteger(sum)) throw new Error('Simultaneous usage exceeds safe integer precision');
      // Unknown components must remain unknown for inference, not silently become zero.
      return [key, values.length === events.length ? sum : null];
    })) as Tokens;
    return {
      ...first, ...tokens,
      model: rows.every((s) => s.model === first.model) ? first.model : null,
      raw: {
        source: 'token_count', eventId: hash(JSON.stringify(events.map((s) => s.eventId))),
        ...(first.raw.limitId ? { limitId: first.raw.limitId } : {}), usageEvents: events,
      },
    };
  }));
}

export const codexLog: Collector = {
  id: 'codex-log',
  async collect(opts) {
    const accountLabel = opaqueLabel(opts.accountLabel);
    const root = join(opts.codexDir ?? process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions');
    const samples: Sample[] = [];
    // Total counters repeat on meter-only updates. Count last usage once per session/counter.
    const seenTotals = new Set<string>();
    const seenEvents = new Set<string>();
    let malformed = 0;
    let unsupported = 0;
    try {
      for await (const path of sessionFiles(root)) {
        let session = hash(path); // Hash only, never persist paths/session content.
        let model: string | null = null;
        const input = createReadStream(path, { encoding: 'utf8' });
        const lines = createInterface({ input, crlfDelay: Infinity });
        try {
          for await (const text of lines) {
            let line: LogLine;
            try { line = JSON.parse(text) as LogLine; } catch { malformed++; continue; }
            if (!line || !line.payload) continue;
            if (line.type === 'session_meta' && typeof line.payload.id === 'string') session = hash(line.payload.id);
            if (line.type === 'turn_context') model = safeName(line.payload.model);
            if (line.payload.type !== 'token_count') continue;
            const timestamp = Date.parse(line.timestamp ?? '');
            if (!Number.isFinite(timestamp)) { malformed++; continue; }
            const observedAt = new Date(timestamp).toISOString();
            const { info, rate_limits: limits } = line.payload;
            const last = usageTokens(info?.last_token_usage);
            const total = info?.total_token_usage ? usageTokens(info.total_token_usage) : undefined;
            const totalKey = total ? JSON.stringify([session, total]) : undefined;
            const duplicate = totalKey !== undefined && seenTotals.has(totalKey);
            const eventId = hash(JSON.stringify([session, observedAt, last, total, limits]));
            if (seenEvents.has(eventId)) continue;
            seenEvents.add(eventId);
            if (totalKey) seenTotals.add(totalKey);
            const tokens = duplicate ? { tokensInput: 0, tokensCached: 0, tokensCacheWrite: 0, tokensOutput: 0, tokensReasoning: 0 } : last;
            const mappedPlan = PLAN_TYPES[limits?.plan_type ?? ''];
            const base = {
              ...tokens, planSlug: mappedPlan ?? 'codex-unknown', collector: 'codex-log' as const,
              accountLabel, observedAt, model,
              raw: {
                source: 'token_count' as const, eventId,
                usageStatus: duplicate ? 'duplicate-total' as const : info?.last_token_usage ? 'counted' as const : 'missing' as const,
                ...(total ? { totalTokenUsage: total } : {}),
                ...(safeName(limits?.limit_id) ? { limitId: safeName(limits?.limit_id)! } : {}),
              },
              confidence: mappedPlan ? 'high' as const : 'low' as const,
            };
            let emitted = false;
            for (const channel of ['primary', 'secondary'] as const) {
              const meter = limits?.[channel];
              if (!meter) continue;
              const window = windowKind(meter.window_minutes);
              if (!window) { unsupported++; continue; }
              const pct = meter.used_percent;
              const reset = meter.resets_at;
              if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100
                || typeof reset !== 'number' || !Number.isFinite(reset) || !Number.isFinite(new Date(reset * 1000).getTime())) {
                malformed++; continue;
              }
              samples.push({
                ...base, window, windowMinutes: meter.window_minutes!, usedPct: pct,
                resetsAt: new Date(reset * 1000).toISOString(), raw: { ...base.raw, channel },
              });
              emitted = true;
            }
            // Keep usage even if this client/log lacks a usable meter. No quota inference.
            if (!emitted) samples.push({ ...base, window: 'daily', windowMinutes: null, usedPct: null, resetsAt: null });
          }
        } finally {
          lines.close();
          input.destroy();
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new CollectorSkipped('codex-log: sessions directory not found; needs local Codex session logs (--codex-dir or CODEX_HOME)');
      throw error;
    }
    if (malformed) opts.warn?.(`codex-log: ignored ${malformed} malformed lines/meters (including possible partial log tail)`);
    if (unsupported) opts.warn?.(`codex-log: ignored ${unsupported} unsupported meter windows; usage retained without those meters`);
    return coalesceCodexSamples(samples);
  },
};
