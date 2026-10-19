#!/usr/bin/env tsx
/**
 * Deploy step: switch off API channels of models whose shutdown_date (UTC) has
 * been reached. One way only (true → false). Default read-only dry-run;
 * --apply writes; --check is the audit form and exits 1 if any row is left.
 */
import { runShutdownAvailability, shutdownAvailabilityMode, sqlShutdownStore } from './data/shutdown-availability';

async function main() {
  const mode = shutdownAvailabilityMode(process.argv.slice(2));
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const result = await sql.begin('isolation level serializable', async rawTx => {
      const tx = rawTx as unknown as typeof sql;
      if (mode !== 'apply') await tx`SET TRANSACTION READ ONLY`;
      return runShutdownAvailability(sqlShutdownStore(tx), mode);
    });
    console.log(`seed-shutdown-availability [${mode.toUpperCase()}] UTC day ${result.today}`);
    for (const target of result.targets) {
      const change = target.action === 'disable' ? 'is_available: true → false, availability_locked → true' : 'already unavailable; availability_locked → true';
      console.log(`  ${target.table}#${target.id} ${target.slug} (shutdown ${target.shutdown_date}): ${change}`);
    }
    const live = result.targets.filter(target => target.action === 'disable');
    if (mode === 'apply') {
      console.log(`Applied: ${result.written} rows set is_available=false / locked (${live.length} were available).`);
    } else if (mode === 'check') {
      if (live.length) {
        console.error(`CRITICAL: ${live.length} channel rows are still available after their model's shutdown_date; run npm run seed:shutdown-availability -- --apply`);
        process.exitCode = 1;
      } else {
        console.log('OK: no available channel rows past shutdown_date.');
      }
    } else {
      console.log(`Dry-run; no writes. ${result.targets.length} rows would change (${live.length} available → false).`);
    }
  } finally {
    await sql.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
