import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { prepareQuotes, snapshotToCsv, type RawChannelQuote } from '../src/lib/citable-price-facts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (index >= 0 && (!value || value.startsWith('--'))) {
    console.error(`missing value for ${name}`);
    process.exit(1);
  }
  return value;
}

function refusePublic(out: string): void {
  if (out.split(/[\\/]/).includes('public')) {
    console.error('refusing to write a citation sample into public/');
    process.exit(1);
  }
}

async function fixtureRows(): Promise<{ rows: RawChannelQuote[]; asOf: Date }> {
  const path = option('--fixture-file') ?? 'scripts/fixtures/citable-radar/current.json';
  const parsed = JSON.parse(await readFile(path, 'utf8')) as { fixture?: unknown; not_market_data?: unknown; as_of?: unknown; rows?: RawChannelQuote[] };
  if (parsed.fixture !== true || parsed.not_market_data !== true) {
    console.error('fixture export requires fixture:true and not_market_data:true');
    process.exit(1);
  }
  const asOf = new Date(typeof parsed.as_of === 'string' ? parsed.as_of : '');
  if (Number.isNaN(asOf.getTime())) {
    console.error('fixture as_of is not a timestamp');
    process.exit(1);
  }
  return { rows: parsed.rows ?? [], asOf };
}

async function main(): Promise<void> {
  const live = process.argv.includes('--live');
  const format = option('--format') ?? 'json';
  if (format !== 'json' && format !== 'csv') {
    console.error('format must be json or csv');
    process.exit(1);
  }
  let rows: RawChannelQuote[];
  let asOf = new Date();
  let generatedAt = new Date();
  let allowFixture = false;
  if (live) {
    // Redistribution is unpublished: export an empty envelope without contacting a database.
    rows = [];
  } else {
    const fixture = await fixtureRows();
    rows = fixture.rows;
    asOf = fixture.asOf;
    generatedAt = fixture.asOf;
    allowFixture = true;
  }
  const prepared = prepareQuotes(rows, { allowFixture, asOf, generatedAt });
  const body = format === 'csv' ? snapshotToCsv(prepared.snapshot) : `${JSON.stringify(prepared.snapshot, null, 2)}\n`;
  const out = option('--out');
  if (!out) {
    process.stdout.write(body);
    return;
  }
  refusePublic(out);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, body);
  console.error(`wrote ${prepared.snapshot.quotes.length} quotes ${prepared.snapshot.snapshot_id}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'export failed');
  process.exitCode = 1;
});
