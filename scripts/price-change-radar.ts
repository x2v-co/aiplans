import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { prepareQuotes, type RawChannelQuote } from '../src/lib/citable-price-facts';
import { analyzeObservations, renderRadarDraft, type HistoryRow } from '../src/lib/price-change-radar';

function option(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith('--'))) {
    console.error(`missing value for ${name}`);
    process.exit(1);
  }
  return value ?? fallback ?? '';
}

interface QuoteBundle {
  fixture?: unknown;
  not_market_data?: unknown;
  as_of?: unknown;
  rows?: RawChannelQuote[];
}

async function loadQuotes(path: string): Promise<QuoteBundle> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as QuoteBundle;
  if (parsed.fixture === true && parsed.not_market_data !== true) {
    console.error(`${path} is marked fixture but not not_market_data`);
    process.exit(1);
  }
  return parsed;
}

async function main(): Promise<void> {
  const baseline = process.argv.includes('--baseline');
  const previousPath = option('--previous', 'scripts/fixtures/citable-radar/previous.json');
  const currentPath = option('--current', 'scripts/fixtures/citable-radar/current.json');
  const historyPath = option('--history', 'scripts/fixtures/citable-radar/stock-history.json');
  const out = option('--out', 'docs/examples/price-change-radar');
  if (out.split(/[\\/]/).includes('public')) {
    console.error('refusing to write drafts into public/');
    process.exit(1);
  }
  const threshold = Number(option('--threshold', '15'));
  const maxAgeDays = Number(option('--max-age-days', '30'));
  if (!Number.isFinite(threshold) || threshold < 0 || !Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    console.error('threshold must be >= 0 and max-age-days must be > 0');
    process.exit(1);
  }

  const historyBundle = JSON.parse(await readFile(historyPath, 'utf8')) as { rows?: HistoryRow[]; fixture?: unknown; not_market_data?: unknown };
  const currentBundle = await loadQuotes(currentPath);
  const previousBundle = baseline ? null : await loadQuotes(previousPath);
  if (!baseline && (typeof previousBundle?.as_of !== 'string' || previousBundle.as_of !== currentBundle.as_of)) {
    console.error('previous and current as_of must be the same timestamp');
    process.exit(1);
  }
  if (typeof currentBundle.as_of !== 'string') {
    console.error('current as_of must be a timestamp');
    process.exit(1);
  }
  const asOf = new Date(currentBundle.as_of);
  if (Number.isNaN(asOf.getTime())) {
    console.error('as_of is not a timestamp');
    process.exit(1);
  }
  if (historyBundle.fixture === true && historyBundle.not_market_data !== true) {
    console.error('history fixture must set not_market_data:true');
    process.exit(1);
  }
  const allowPrevious = previousBundle?.fixture === true;
  const allowCurrent = currentBundle.fixture === true;
  const previous = previousBundle ? prepareQuotes(previousBundle.rows ?? [], { allowFixture: allowPrevious, asOf, generatedAt: asOf, maxAgeDays }) : null;
  const current = prepareQuotes(currentBundle.rows ?? [], { allowFixture: allowCurrent, asOf, generatedAt: asOf, maxAgeDays });
  const report = analyzeObservations(previous?.observations ?? null, current.observations, {
    thresholdPercent: threshold,
    asOf,
    maxAgeDays,
    fixture: allowPrevious || allowCurrent || historyBundle.fixture === true,
    previousSnapshotId: previous?.snapshot.snapshot_id ?? null,
    currentSnapshotId: current.snapshot.snapshot_id,
    previousAsOf: previous?.as_of ?? null,
    currentAsOf: current.as_of,
    duplicatesCollapsed: (previous?.duplicates_collapsed ?? 0) + current.duplicates_collapsed,
    previousExcludedCounts: previous?.excluded_counts ?? {},
    currentExcludedCounts: current.excluded_counts,
  }, historyBundle.rows ?? [], current.rejections);

  await mkdir(out, { recursive: true });
  await writeFile(`${out}/draft.zh.md`, renderRadarDraft(report, 'zh'));
  await writeFile(`${out}/draft.en.md`, renderRadarDraft(report, 'en'));
  await writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    out,
    fixture: report.fixture,
    publishable_events: report.publishable_events.length,
    history_publishable_events: report.history_publishable_events.length,
    previous_snapshot_id: report.previous_snapshot_id,
    current_snapshot_id: report.current_snapshot_id,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'radar draft failed');
  process.exit(1);
});
