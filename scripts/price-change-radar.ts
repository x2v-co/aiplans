import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { loadRadarInput } from '../src/lib/price-radar-input';
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

async function main(): Promise<void> {
  // --fixture requires synthetic inputs; the bundled examples are also the default.
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
  const currentBundle = JSON.parse(await readFile(currentPath, 'utf8'));
  const previousBundle = baseline ? null : JSON.parse(await readFile(previousPath, 'utf8'));
  // Explicit comparison clock; individual snapshot observation times may differ.
  const asOf = new Date(option('--as-of', currentBundle.as_of));
  if (Number.isNaN(asOf.getTime())) throw new Error('invalid comparison --as-of timestamp');
  if (historyBundle.fixture === true && historyBundle.not_market_data !== true) {
    throw new Error('history fixture must set not_market_data:true');
  }
  const previous = previousBundle ? loadRadarInput(previousBundle, asOf, maxAgeDays) : null;
  const current = loadRadarInput(currentBundle, asOf, maxAgeDays);
  if (process.argv.includes('--fixture') && (!current.fixture || (previous && !previous.fixture) || historyBundle.fixture !== true)) {
    throw new Error('--fixture requires synthetic quote and history inputs');
  }
  const report = analyzeObservations(previous?.observations ?? null, current.observations, {
    thresholdPercent: threshold,
    asOf,
    maxAgeDays,
    fixture: previous?.fixture === true || current.fixture || historyBundle.fixture === true,
    redistributionUnpublished: previous?.fixture === false || !current.fixture || (historyBundle.fixture !== true && (historyBundle.rows?.length ?? 0) > 0),
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
  process.exitCode = 1;
});
