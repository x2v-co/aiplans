import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';

/** Append Console BYOK security note to OpenCode Zen / Go provider notes (Intel 2026-10-18). */
export const OPENCODE_SECURITY_SOURCE = 'https://x.com/opencode/status/2111519637049319818';
export const OPENCODE_PROVIDER_SLUGS = ['opencode-zen', 'opencode-go'] as const;
export const OPENCODE_SECURITY_NOTE =
  'Security note (2026-10-17): OpenCode reported that about 1.4% of Console users who had linked external providers were affected by a distillation-related incident; users also reported that BYOK keys may have been exposed via a legacy system. OpenCode stated the open-source CLI was not affected. Prefer local CLI + machine-local env vars over storing official provider keys in Console BYOK. '
  + `Source: ${OPENCODE_SECURITY_SOURCE}.`;

export function opencodeSecurityOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-opencode-console-security-2026-10-18.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface OpencodeSecurityStep {
  table: 'providers';
  target: string;
  action: 'update';
  changes: ReturnType<typeof seedChanges>;
}

function mergeNotes(existing: unknown, addition: string): string {
  const current = String(existing ?? '').trim();
  if (current.includes('Console BYOK') || current.includes(OPENCODE_SECURITY_SOURCE)) return current;
  return current ? `${current}\n${addition}` : addition;
}

/** Caller owns a serializable transaction. Default preview SELECT-only. Never creates providers. */
export async function seedOpenCodeConsoleSecurity(tx: Sql, apply = false): Promise<OpencodeSecurityStep[]> {
  const steps: OpencodeSecurityStep[] = [];
  for (const slug of OPENCODE_PROVIDER_SLUGS) {
    const rows = await tx<Row[]>`SELECT * FROM providers WHERE slug = ${slug}`;
    if (rows.length > 1) throw new Error(`Ambiguous providers/${slug}; nothing written.`);
    const existing = rows[0];
    if (!existing) continue; // optional: Zen/Go may be absent in empty fixtures
    const values = { notes: mergeNotes(existing.notes, OPENCODE_SECURITY_NOTE) };
    const changes = seedChanges(existing, values);
    if (!Object.keys(changes).length) continue;
    steps.push({ table: 'providers', target: slug, action: 'update', changes });
    if (apply) {
      const payload = { ...values, updated_at: new Date() };
      await tx`UPDATE providers SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${existing.id}`;
    }
  }
  return steps;
}
