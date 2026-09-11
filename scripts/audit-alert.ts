#!/usr/bin/env tsx
/**
 * Audit alert gate.
 *
 * Reads `npm run audit:json` output on stdin, and alerts only on findings we
 * have never alerted on before:
 *   - every `critical` finding (data integrity), and
 *   - the external-reference checks (C19 price divergence, C20 coding-plan
 *     entitlement drift), even at warning severity.
 *
 * State lives in audit_alert_state (migration 022). New fingerprints are
 * upserted; the human-readable digest is printed to stdout. Exit code is
 * always 0 — a missing Telegram credential must not fail the nightly chain —
 * and the digest is also available as JSON on stderr for the shell wrapper.
 *
 * Usage:
 *   npm run audit:json --silent | npx tsx scripts/audit-alert.ts
 *   ... | AUDIT_ALERT_APPLY=1 npx tsx scripts/audit-alert.ts   # persist state
 */
import { databaseSql } from './db/postgres-admin';

const APPLY = process.env.AUDIT_ALERT_APPLY === '1';

type Finding = {
  check: string;
  severity: 'critical' | 'warning';
  message: string;
  ref?: Record<string, unknown>;
};

const ALWAYS_ALERT_CHECKS = new Set([
  'prices.modelsdev_divergence',
  'plans.modelsdev_entitlements',
]);

/** Stable identity: check name + the entity slug (the part before '#'/id). */
function fingerprint(f: Finding): string {
  const ref = f.ref ?? {};
  const entity =
    (typeof ref.model === 'string' && ref.model.split('#')[0]) ||
    (typeof ref.plan === 'string' && ref.plan.split('#')[0]) ||
    (typeof ref.provider === 'string' && ref.provider) ||
    f.message.slice(0, 80);
  return `${f.check}:${entity}`;
}

async function main() {
  const raw = await new Promise<string>((resolve, reject) => {
    let data = '';
    process.stdin.on('data', c => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });

  let report: { findings?: Finding[] };
  try {
    report = JSON.parse(raw);
  } catch {
    console.error('audit-alert: could not parse audit JSON from stdin; skipping');
    process.exit(0);
    return;
  }

  const findings = (report.findings ?? []).filter(
    f => f.severity === 'critical' || ALWAYS_ALERT_CHECKS.has(f.check),
  );
  if (findings.length === 0) {
    console.log('audit-alert: no critical/models.dev findings');
    return;
  }

  const existing = new Set(
    (await databaseSql<{ fingerprint: string }[]>`SELECT fingerprint FROM audit_alert_state`)
      .map(r => r.fingerprint),
  );

  const fresh = findings.filter(f => !existing.has(fingerprint(f)));
  if (fresh.length === 0) {
    console.log(`audit-alert: ${findings.length} known finding(s), 0 new`);
    // Still refresh last_seen for present ones.
    if (APPLY) {
      for (const f of findings) {
        await databaseSql`UPDATE audit_alert_state SET last_seen = now() WHERE fingerprint = ${fingerprint(f)}`;
      }
    }
    return;
  }

  if (APPLY) {
    for (const f of fresh) {
      const fp = fingerprint(f);
      const entity = fp.split(':').slice(1).join(':');
      await databaseSql`
        INSERT INTO audit_alert_state (fingerprint, check_name, ref, message)
        VALUES (${fp}, ${f.check}, ${entity}, ${f.message})
        ON CONFLICT (fingerprint) DO UPDATE SET last_seen = now()
      `;
    }
  }

  // Human digest (one line per finding) for Telegram.
  const lines = fresh.map(f => {
    const icon = f.severity === 'critical' ? '🔴' : '🟡';
    return `${icon} ${f.check.replace(/^(prices|plans)\./, '')}\n   ${f.message}`;
  });
  const digest = [
    `⚠️ planprice data audit: ${fresh.length} NEW finding(s)${APPLY ? '' : ' [dry-run]'}`,
    '',
    ...lines,
  ].join('\n');
  console.log(digest);
}

main().catch(e => {
  // Never break the scrape chain over an alerting failure.
  console.error('audit-alert failed (non-fatal):', (e as Error).message);
  process.exit(0);
});
