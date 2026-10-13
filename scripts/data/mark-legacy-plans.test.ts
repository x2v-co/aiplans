import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterPlansCreatedBefore,
  isCreatedBefore,
  markLegacyPlans,
  type LegacyDb,
  type LegacyPlanRow,
  type LegacyProviderRow,
} from './mark-legacy-plans';
import { LEGACY_CLOSED_MARKER, LEGACY_CLOSED_RULES, LEGACY_CREATED_BEFORE_ISO } from './verified-2026-10-subscriptions';

test('legacy rules treat grok and xai as xAI; Cursor stays warn-and-skip', () => {
  const superGrok = LEGACY_CLOSED_RULES.find((r) => r.label === 'SuperGrok');
  const xPremium = LEGACY_CLOSED_RULES.find((r) => r.label === 'X Premium');
  const cursor = LEGACY_CLOSED_RULES.find((r) => r.label === 'Cursor (pre-X-Subscription plans)');
  assert.ok(superGrok && xPremium && cursor);
  assert.deepEqual(superGrok.providerSlugs, ['xai', 'grok']);
  assert.ok(xPremium.providerSlugs.includes('grok'));
  assert.ok(xPremium.providerSlugs.includes('xai'));
  assert.deepEqual(cursor.providerSlugs, ['cursor', 'anysphere']);
});

test('isCreatedBefore / filterPlansCreatedBefore cut off at launch day', () => {
  assert.equal(isCreatedBefore('2026-10-11T23:59:59.000Z', LEGACY_CREATED_BEFORE_ISO), true);
  assert.equal(isCreatedBefore('2026-10-12T00:00:00.000Z', LEGACY_CREATED_BEFORE_ISO), false);
  assert.equal(isCreatedBefore(null, LEGACY_CREATED_BEFORE_ISO), false);
  const rows: LegacyPlanRow[] = [
    { id: 1, slug: 'old', name: 'SuperGrok', notes: null, created_at: '2026-10-01T00:00:00.000Z' },
    { id: 2, slug: 'new', name: 'SuperGrok', notes: null, created_at: '2026-10-13T00:00:00.000Z' },
  ];
  assert.deepEqual(filterPlansCreatedBefore(rows).map((r) => r.id), [1]);
});

/** Mock that only supports select().in() and update().eq() — no .lt. */
function makeDbMock(plans: LegacyPlanRow[], updates: Array<{ id: number; notes: string }> = []): LegacyDb {
  return {
    from(table: string) {
      assert.equal(table, 'plans');
      return {
        select(columns: string) {
          assert.ok(columns.includes('created_at'), 'must select created_at for JS filter');
          assert.ok(!('lt' in Object.getPrototypeOf({})), 'sanity');
          const builder: {
            in(column: string, values: unknown[]): Promise<{ data: LegacyPlanRow[]; error: null }>;
            lt?: unknown;
          } = {
            in(column: string, values: unknown[]) {
              assert.equal(column, 'provider_id');
              const idSet = new Set(values);
              return Promise.resolve({
                data: plans.filter((p) => idSet.has((p as LegacyPlanRow & { provider_id?: number }).provider_id ?? 85)),
                error: null,
              });
            },
          };
          // Explicitly ensure .lt is absent so a regression fails loudly.
          assert.equal('lt' in builder, false);
          return builder;
        },
        update(data: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              assert.equal(column, 'id');
              updates.push({ id: value as number, notes: String(data.notes ?? '') });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

test('markLegacyPlans works with a db mock that has no .lt', async () => {
  const updates: Array<{ id: number; notes: string }> = [];
  const plans: Array<LegacyPlanRow & { provider_id: number }> = [
    {
      id: 10,
      provider_id: 85,
      slug: 'supergrok-legacy',
      name: 'SuperGrok',
      notes: null,
      created_at: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 11,
      provider_id: 85,
      slug: 'supergrok-after',
      name: 'SuperGrok',
      notes: null,
      created_at: '2026-10-13T00:00:00.000Z',
    },
    {
      id: 12,
      provider_id: 37,
      slug: 'supergrok-on-grok',
      name: 'Super Grok Pro',
      notes: null,
      created_at: '2026-08-01T00:00:00.000Z',
    },
  ];

  // Override mock in() to filter by real provider_id on the row.
  const db: LegacyDb = {
    from(table: string) {
      assert.equal(table, 'plans');
      return {
        select(columns: string) {
          assert.ok(columns.includes('created_at'));
          const chain = {
            in(column: string, values: unknown[]) {
              assert.equal(column, 'provider_id');
              // Calling .lt on this chain must not exist (the bug we are fixing).
              assert.equal(
                typeof (chain as { lt?: unknown }).lt,
                'undefined',
                'db mock must not expose .lt',
              );
              const idSet = new Set(values as number[]);
              return Promise.resolve({
                data: plans.filter((p) => idSet.has(p.provider_id)),
                error: null,
              });
            },
          };
          return chain;
        },
        update(data: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              assert.equal(column, 'id');
              updates.push({ id: value as number, notes: String(data.notes ?? '') });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const providers = new Map<string, LegacyProviderRow>([
    ['xai', { id: 85, slug: 'xai', name: 'xAI' }],
    ['grok', { id: 37, slug: 'grok', name: 'Grok / X.AI' }],
    // no cursor / anysphere — must warn and skip, not create
  ]);

  const logs: string[] = [];
  await markLegacyPlans(db, providers, {
    apply: true,
    now: new Date('2026-10-13T02:00:00.000Z'),
    log: (line) => logs.push(line),
  });

  assert.ok(logs.some((l) => l.includes('Cursor') && l.includes('no provider')), 'Cursor warn-and-skip');
  assert.ok(logs.some((l) => l.includes('supergrok-legacy')));
  assert.ok(logs.some((l) => l.includes('supergrok-on-grok')), 'grok vendor counted as xAI');
  assert.ok(!logs.some((l) => l.includes('supergrok-after')), 'post-launch row not closed');

  assert.equal(updates.length, 2);
  assert.deepEqual(
    updates.map((u) => u.id).sort((a, b) => a - b),
    [10, 12],
  );
  for (const u of updates) assert.ok(u.notes.includes(LEGACY_CLOSED_MARKER));
});

test('markLegacyPlans dry-run never updates', async () => {
  const updates: Array<{ id: number; notes: string }> = [];
  const db = makeDbMock(
    [
      {
        id: 1,
        slug: 'old-sg',
        name: 'SuperGrok',
        notes: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ],
    updates,
  );
  // makeDbMock's in() does not filter by provider; attach provider via map only.
  const providers = new Map<string, LegacyProviderRow>([
    ['xai', { id: 85, slug: 'xai', name: 'xAI' }],
  ]);
  await markLegacyPlans(db, providers, { apply: false, log: () => {} });
  assert.equal(updates.length, 0);
});
