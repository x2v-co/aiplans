#!/usr/bin/env node

/**
 * Remove immutable Planprice v1 catalog snapshots older than the retention
 * window. The live aliases are never touched. This is intentionally a
 * conservative cleanup: files that cannot be parsed are retained for audit.
 */
import { readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const snapshotDir = process.env.PLANPRICE_V1_SNAPSHOT_DIR ?? '/var/lib/planprice/snapshots';
const retentionDays = Number(process.env.PLANPRICE_SNAPSHOT_RETENTION_DAYS ?? 90);
const now = process.env.PLANPRICE_SNAPSHOT_NOW ? new Date(process.env.PLANPRICE_SNAPSHOT_NOW) : new Date();
const dryRun = process.argv.includes('--dry-run');

if (!Number.isFinite(retentionDays) || retentionDays < 90) {
  throw new Error('PLANPRICE_SNAPSHOT_RETENTION_DAYS must be at least 90');
}
if (Number.isNaN(now.getTime())) throw new Error('PLANPRICE_SNAPSHOT_NOW must be an ISO timestamp');

const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
const files = await readdir(snapshotDir, { withFileTypes: true });
let removed = 0;
let retained = 0;

for (const entry of files) {
  if (!entry.isFile() || !/^cat_[A-Za-z0-9._~-]+\.json$/.test(entry.name)) continue;
  const path = join(snapshotDir, entry.name);
  let generatedAt;
  try {
    const payload = JSON.parse(await readFile(path, 'utf8'));
    generatedAt = new Date(payload.generatedAt).getTime();
  } catch {
    retained += 1;
    console.warn(`retaining unreadable snapshot ${entry.name}`);
    continue;
  }
  if (!Number.isFinite(generatedAt)) {
    retained += 1;
    console.warn(`retaining snapshot without generatedAt ${entry.name}`);
    continue;
  }
  if (generatedAt >= cutoff) {
    retained += 1;
    continue;
  }
  if (dryRun) {
    console.log(`would remove ${entry.name}`);
  } else {
    await unlink(path);
    console.log(`removed ${entry.name}`);
  }
  removed += 1;
}

console.log(JSON.stringify({
  schemaVersion: 'planprice-v1-retention/1',
  status: dryRun ? 'dry-run' : 'cleaned',
  snapshotDir,
  retentionDays,
  cutoff: new Date(cutoff).toISOString(),
  removed,
  retained,
}, null, 2));
