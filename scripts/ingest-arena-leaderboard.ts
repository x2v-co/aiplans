#!/usr/bin/env tsx
/**
 * Ingest Chatbot Arena leaderboard top-60 into model_benchmark_scores.
 *
 * Snapshot source: arena.ai/leaderboard/text via web-info-extractor agent on
 * 2026-04-14. Until the Playwright scraper (scripts/scrape-arena-leaderboard
 * .ts.disabled) is revived + wired into this ingestion path, this script is
 * the one-shot data refresh tool.
 *
 * What it does:
 *   1. Bootstrap benchmarks / benchmark_versions / benchmark_tasks /
 *      benchmark_metrics chain for Arena (text category + ELO metric).
 *   2. For each leaderboard row, fuzzy-match `models.slug` using several
 *      normalization strategies.
 *   3. Call upsertBenchmarkScore — idempotent, re-runs fine.
 *   4. Report matched / unmatched so a follow-up can add missing models.
 *
 * Usage: npx tsx scripts/ingest-arena-leaderboard.ts [--dry-run]
 */
import { supabaseAdmin, upsertBenchmarkScore } from './db/queries';

const DRY_RUN = process.argv.includes('--dry-run');
const AS_OF = '2026-04-14';
const SOURCE_URL = 'https://arena.ai/leaderboard/text';

interface ArenaRow {
  rank: number;
  modelName: string;   // slug-like name from arena
  elo: number;
  votes: number;
  org: string;
}

// Top 60 from arena.ai/leaderboard/text as of 2026-04-14 (web agent snapshot).
const ARENA_TOP60: ArenaRow[] = [
  { rank: 1,  modelName: 'claude-opus-4-6-thinking',                 elo: 1504, votes: 16278, org: 'Anthropic' },
  { rank: 2,  modelName: 'claude-opus-4-6',                          elo: 1496, votes: 17416, org: 'Anthropic' },
  { rank: 3,  modelName: 'muse-spark',                               elo: 1493, votes: 3268,  org: 'Meta' },
  { rank: 4,  modelName: 'gemini-3.1-pro-preview',                   elo: 1492, votes: 20531, org: 'Google' },
  { rank: 5,  modelName: 'gemini-3-pro',                             elo: 1486, votes: 41585, org: 'Google' },
  { rank: 6,  modelName: 'grok-4.20-beta1',                          elo: 1486, votes: 9689,  org: 'xAI' },
  { rank: 7,  modelName: 'gpt-5.4-high',                             elo: 1484, votes: 9681,  org: 'OpenAI' },
  { rank: 8,  modelName: 'grok-4.20-beta-0309-reasoning',            elo: 1478, votes: 9781,  org: 'xAI' },
  { rank: 9,  modelName: 'gpt-5.2-chat-latest-20260210',             elo: 1477, votes: 15704, org: 'OpenAI' },
  { rank: 10, modelName: 'grok-4.20-multi-agent-beta-0309',          elo: 1476, votes: 10112, org: 'xAI' },
  { rank: 11, modelName: 'gemini-3-flash',                           elo: 1474, votes: 30918, org: 'Google' },
  { rank: 12, modelName: 'claude-opus-4-5-20251101-thinking-32k',    elo: 1473, votes: 37307, org: 'Anthropic' },
  { rank: 13, modelName: 'glm-5.1',                                  elo: 1471, votes: 5326,  org: 'Zhipu' },
  { rank: 14, modelName: 'grok-4.1-thinking',                        elo: 1471, votes: 47508, org: 'xAI' },
  { rank: 15, modelName: 'claude-opus-4-5-20251101',                 elo: 1468, votes: 47320, org: 'Anthropic' },
  { rank: 16, modelName: 'qwen3.5-max-preview',                      elo: 1466, votes: 7952,  org: 'Alibaba' },
  { rank: 17, modelName: 'gpt-5.4',                                  elo: 1466, votes: 9977,  org: 'OpenAI' },
  { rank: 18, modelName: 'gemini-3-flash-thinking-minimal',          elo: 1463, votes: 33555, org: 'Google' },
  { rank: 19, modelName: 'claude-sonnet-4-6',                        elo: 1462, votes: 10940, org: 'Anthropic' },
  { rank: 20, modelName: 'dola-seed-2.0-pro',                        elo: 1461, votes: 18882, org: 'ByteDance' },
  { rank: 21, modelName: 'grok-4.1',                                 elo: 1460, votes: 51452, org: 'xAI' },
  { rank: 22, modelName: 'gpt-5.4-mini-high',                        elo: 1459, votes: 7169,  org: 'OpenAI' },
  { rank: 23, modelName: 'gpt-5.3-chat-latest',                      elo: 1456, votes: 14444, org: 'OpenAI' },
  { rank: 24, modelName: 'glm-5',                                    elo: 1456, votes: 14093, org: 'Zhipu' },
  { rank: 25, modelName: 'gpt-5.1-high',                             elo: 1454, votes: 41042, org: 'OpenAI' },
  { rank: 26, modelName: 'claude-sonnet-4-5-20250929-thinking-32k',  elo: 1452, votes: 60401, org: 'Anthropic' },
  { rank: 27, modelName: 'kimi-k2.5-thinking',                       elo: 1452, votes: 17735, org: 'Moonshot' },
  { rank: 28, modelName: 'claude-sonnet-4-5-20250929',               elo: 1451, votes: 58292, org: 'Anthropic' },
  { rank: 29, modelName: 'gemma-4-31b',                              elo: 1451, votes: 5957,  org: 'Google' },
  { rank: 30, modelName: 'ernie-5.0-0110',                           elo: 1450, votes: 22778, org: 'Baidu' },
  { rank: 31, modelName: 'ernie-5.0-preview-1203',                   elo: 1449, votes: 9810,  org: 'Baidu' },
  { rank: 32, modelName: 'claude-opus-4-1-20250805-thinking-16k',    elo: 1448, votes: 50152, org: 'Anthropic' },
  { rank: 33, modelName: 'gemini-2.5-pro',                           elo: 1448, votes: 107824, org: 'Google' },
  { rank: 34, modelName: 'qwen3.5-397b-a17b',                        elo: 1447, votes: 15408, org: 'Alibaba' },
  { rank: 35, modelName: 'claude-opus-4-1-20250805',                 elo: 1447, votes: 77864, org: 'Anthropic' },
  { rank: 36, modelName: 'mimo-v2-pro',                              elo: 1446, votes: 8397,  org: 'Xiaomi' },
  { rank: 37, modelName: 'gpt-4.5-preview-2025-02-27',               elo: 1444, votes: 14547, org: 'OpenAI' },
  { rank: 38, modelName: 'chatgpt-4o-latest-20250326',               elo: 1443, votes: 82998, org: 'OpenAI' },
  { rank: 39, modelName: 'glm-4.7',                                  elo: 1443, votes: 12180, org: 'Zhipu' },
  { rank: 40, modelName: 'gpt-5.2-high',                             elo: 1442, votes: 30488, org: 'OpenAI' },
  { rank: 41, modelName: 'longcat-flash-chat-2602-exp',              elo: 1440, votes: 5790,  org: 'Meituan' },
  { rank: 42, modelName: 'gpt-5.2',                                  elo: 1439, votes: 27564, org: 'OpenAI' },
  { rank: 43, modelName: 'gpt-5.1',                                  elo: 1439, votes: 43708, org: 'OpenAI' },
  { rank: 44, modelName: 'gemma-4-26b-a4b',                          elo: 1438, votes: 5927,  org: 'Google' },
  { rank: 45, modelName: 'gemini-3.1-flash-lite-preview',            elo: 1435, votes: 15996, org: 'Google' },
  { rank: 46, modelName: 'qwen3-max-preview',                        elo: 1435, votes: 27940, org: 'Alibaba' },
  { rank: 47, modelName: 'gpt-5-high',                               elo: 1433, votes: 32259, org: 'OpenAI' },
  { rank: 48, modelName: 'kimi-k2.5-instant',                        elo: 1433, votes: 8241,  org: 'Moonshot' },
  { rank: 49, modelName: 'grok-4-1-fast-reasoning',                  elo: 1432, votes: 42592, org: 'xAI' },
  { rank: 50, modelName: 'o3-2025-04-16',                            elo: 1431, votes: 60172, org: 'OpenAI' },
  { rank: 51, modelName: 'kimi-k2-thinking-turbo',                   elo: 1430, votes: 46203, org: 'Moonshot' },
  { rank: 52, modelName: 'amazon-nova-experimental-chat-26-02-10',   elo: 1428, votes: 3452,  org: 'Amazon' },
  { rank: 53, modelName: 'gpt-5-chat',                               elo: 1426, votes: 31851, org: 'OpenAI' },
  { rank: 54, modelName: 'glm-4.6',                                  elo: 1426, votes: 35917, org: 'Zhipu' },
  { rank: 55, modelName: 'deepseek-v3.2-exp-thinking',               elo: 1425, votes: 9146,  org: 'DeepSeek' },
  { rank: 56, modelName: 'qwen3-max-2025-09-23',                     elo: 1424, votes: 9242,  org: 'Alibaba' },
  { rank: 57, modelName: 'deepseek-v3.2',                            elo: 1424, votes: 41182, org: 'DeepSeek' },
  { rank: 58, modelName: 'claude-opus-4-20250514-thinking-16k',      elo: 1424, votes: 37191, org: 'Anthropic' },
  { rank: 59, modelName: 'qwen3-235b-a22b-instruct-2507',            elo: 1423, votes: 82043, org: 'Alibaba' },
  { rank: 60, modelName: 'deepseek-v3.2-exp',                        elo: 1423, votes: 12019, org: 'DeepSeek' },
];

/** Generate slug candidates to match against models.slug */
function slugCandidates(arenaName: string): string[] {
  const base = arenaName.toLowerCase();
  const candidates = new Set<string>([base]);

  // Replace dash-before-version with dot: claude-opus-4-6 → claude-opus-4.6
  const versionFix = base.replace(/-(\d+)-(\d+)(?=-|$)/g, '-$1.$2');
  candidates.add(versionFix);

  // Replace any trailing -NN with .NN (single-digit-pair versions)
  const tailVersion = base.replace(/-(\d+)-(\d+)$/, '-$1.$2');
  candidates.add(tailVersion);

  // Strip common suffix variants to try base model
  const stripSuffixes = [
    /-thinking(-\d+k)?$/,
    /-thinking-minimal$/,
    /-thinking-turbo$/,
    /-latest(-\d{8})?$/,
    /-latest(-\d{4}-\d{2}-\d{2})?$/,
    /-chat-latest(-\d{8})?$/,
    /-preview(-\d{4}-\d{2}-\d{2})?$/,
    /-preview-\d{4}$/,
    /-instant$/,
    /-high$/,
    /-mini-high$/,
    /-\d{8}$/,                  // -20251101
    /-\d{4}-\d{2}-\d{2}$/,      // -2025-09-29
    /-\d{2}-\d{2}-\d{2}$/,      // -26-02-10
    /-exp$/,
    /-exp-thinking$/,
    /-\d{4}$/,                  // -2602, -0110 etc
    /-reasoning$/,
    /-beta\d*(-\d+)?$/,
    /-multi-agent-beta-\d+$/,
    /-0\d{3}$/,                 // -0309, -0110
    /-chat$/,
  ];
  // Run up to 4 passes so iterative stripping works:
  //   claude-opus-4-5-20251101-thinking-32k
  //     → claude-opus-4-5-20251101 (pass 1: -thinking-32k)
  //     → claude-opus-4-5 (pass 2: -\d{8}$)
  //     → claude-opus-4.5 (pass 3: version dash-to-dot)
  for (let pass = 0; pass < 4; pass++) {
    const before = candidates.size;
    for (const c of [...candidates]) {
      for (const re of stripSuffixes) {
        const stripped = c.replace(re, '');
        if (stripped && stripped !== c) candidates.add(stripped);
      }
      // Also add version dash-to-dot form of every candidate
      candidates.add(c.replace(/-(\d+)-(\d+)/g, '-$1.$2'));
    }
    if (candidates.size === before) break; // stable
  }

  return [...candidates];
}

async function bootstrapArenaChain(): Promise<{ taskId: number; metricId: number } | null> {
  // 1. benchmarks row
  let { data: benchmark } = await supabaseAdmin
    .from('benchmarks').select('id').eq('slug', 'arena').maybeSingle();
  if (!benchmark) {
    console.log('➕ creating benchmarks row: arena');
    if (!DRY_RUN) {
      const res = await supabaseAdmin.from('benchmarks').insert({
        name: 'Chatbot Arena', slug: 'arena', type: 'human-preference',
        offical_url: 'https://arena.ai/leaderboard',
      }).select('id').single();
      if (res.error) { console.error(res.error); return null; }
      benchmark = res.data;
    } else {
      benchmark = { id: -1 };
    }
  }

  // 2. benchmark_versions (is_current=true)
  let { data: version } = await supabaseAdmin
    .from('benchmark_versions').select('id')
    .eq('benchmark_id', benchmark.id).eq('is_current', true).maybeSingle();
  if (!version) {
    console.log('➕ creating benchmark_versions row');
    if (!DRY_RUN) {
      const res = await supabaseAdmin.from('benchmark_versions').insert({
        benchmark_id: benchmark.id, version_label: 'live', is_current: true,
        release_date: AS_OF, notes: `Live Arena ELO as of ${AS_OF}`,
      }).select('id').single();
      if (res.error) { console.error(res.error); return null; }
      version = res.data;
    } else {
      version = { id: -1 };
    }
  }

  // 3. benchmark_tasks (text category)
  let { data: task } = await supabaseAdmin
    .from('benchmark_tasks').select('id')
    .eq('benchmark_version_id', version.id).eq('name', 'Text').maybeSingle();
  if (!task) {
    console.log('➕ creating benchmark_tasks row: Text');
    if (!DRY_RUN) {
      const res = await supabaseAdmin.from('benchmark_tasks').insert({
        benchmark_version_id: version.id, name: 'Text',
      }).select('id').single();
      if (res.error) { console.error(res.error); return null; }
      task = res.data;
    } else {
      task = { id: -1 };
    }
  }

  // 4. ELO metric
  let { data: metric } = await supabaseAdmin
    .from('benchmark_metrics').select('id').eq('name', 'ELO').maybeSingle();
  if (!metric) {
    console.log('➕ creating benchmark_metrics row: ELO');
    if (!DRY_RUN) {
      const res = await supabaseAdmin.from('benchmark_metrics').insert({
        name: 'ELO', unit: 'score', description: 'Chatbot Arena ELO rating', higher_better: true,
      }).select('id').single();
      if (res.error) { console.error(res.error); return null; }
      metric = res.data;
    } else {
      metric = { id: -1 };
    }
  }

  console.log(`✓ arena chain ready: benchmark=${benchmark.id} version=${version.id} task=${task.id} metric=${metric.id}`);
  return { taskId: task.id, metricId: metric.id };
}

async function findModelBySlug(slug: string): Promise<{ id: number; slug: string } | null> {
  const { data } = await supabaseAdmin
    .from('models').select('id, slug').eq('slug', slug).maybeSingle();
  return data ?? null;
}

async function main() {
  console.log(`\n🏆 ingest-arena-leaderboard ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  const chain = await bootstrapArenaChain();
  if (!chain) { console.error('bootstrap failed'); process.exit(1); }

  const { taskId, metricId } = chain;
  if (taskId <= 0 || metricId <= 0) {
    console.log('\n(dry-run — chain not created, skipping score ingestion)');
    return;
  }

  // Phase 1: resolve every arena row to a DB model slug (or none).
  interface Resolved { row: ArenaRow; modelId: number; modelSlug: string; usedCandidate: string }
  const resolved: Resolved[] = [];
  const unmatched: string[] = [];

  for (const row of ARENA_TOP60) {
    const candidates = slugCandidates(row.modelName);
    let model: { id: number; slug: string } | null = null;
    let usedCandidate: string | null = null;
    for (const c of candidates) {
      model = await findModelBySlug(c);
      if (model) { usedCandidate = c; break; }
    }

    if (!model) {
      unmatched.push(`${row.rank.toString().padStart(2)} ${row.modelName}  (tried: ${candidates.slice(0, 4).join(', ')}${candidates.length > 4 ? '…' : ''})`);
      continue;
    }
    resolved.push({ row, modelId: model.id, modelSlug: model.slug, usedCandidate: usedCandidate! });
  }

  // Phase 2: collision dedupe — when multiple arena rows map to the same
  // DB slug (e.g. gpt-5.4, gpt-5.4-high, gpt-5.4-mini-high all → gpt-5.4),
  // pick the highest ELO (best variant of the model family) so last-write
  // doesn't win arbitrarily. Keep the arena row that contributed.
  const bySlug = new Map<string, Resolved>();
  for (const r of resolved) {
    const prev = bySlug.get(r.modelSlug);
    if (!prev || r.row.elo > prev.row.elo) bySlug.set(r.modelSlug, r);
  }
  const winners = [...bySlug.values()];
  const losers = resolved.filter(r => bySlug.get(r.modelSlug)?.row.rank !== r.row.rank);

  const matched: string[] = [];
  for (const r of winners) {
    const note = r.usedCandidate === r.row.modelName ? '' : ` (via "${r.usedCandidate}")`;
    matched.push(`${r.row.rank.toString().padStart(2)} ${r.row.modelName} → ${r.modelSlug}  ELO=${r.row.elo}${note}`);

    if (!DRY_RUN) {
      try {
        const result = await upsertBenchmarkScore({
          model_id: r.modelId,
          benchmark_task_id: taskId,
          metric_id: metricId,
          value: r.row.elo,
          release_date: AS_OF,
        });
        if (result.action === 'updated') {
          console.log(`  🔧 ${r.row.modelName} → ${r.modelSlug}: ${result.oldValue} → ${r.row.elo}`);
        } else if (result.action === 'inserted') {
          console.log(`  ➕ ${r.row.modelName} → ${r.modelSlug}: ${r.row.elo}`);
        }
      } catch (e) {
        console.error(`  ❌ ${r.row.modelName}: ${(e as Error).message}`);
      }
    }
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`Written:       ${winners.length} unique DB models`);
  console.log(`Collisions:    ${losers.length} arena rows merged into higher-ELO winner`);
  console.log(`Unmatched:     ${unmatched.length}`);

  if (losers.length > 0) {
    console.log(`\nCollision losers (mapped to same DB slug as a higher-ELO row):`);
    for (const l of losers) {
      const winner = bySlug.get(l.modelSlug)!;
      console.log(`  ${l.row.rank.toString().padStart(2)} ${l.row.modelName} ELO=${l.row.elo} → ${l.modelSlug} (winner: rank ${winner.row.rank} ${winner.row.modelName} ELO=${winner.row.elo})`);
    }
  }

  if (unmatched.length > 0) {
    console.log(`\nUnmatched rows (need DB model entry or better slug candidate):`);
    for (const u of unmatched) console.log(`  ${u}`);
  }

  console.log(`\nSource: ${SOURCE_URL}  as_of=${AS_OF}`);
  if (DRY_RUN) console.log(`(dry-run — no writes)`);
}

main().catch(e => { console.error(e); process.exit(1); });
