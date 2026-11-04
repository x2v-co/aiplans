import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { NON_LLM_CATALOG } from '../../src/lib/non-llm-catalog';
import { IMAGE_MODEL_CATALOG } from '../../src/lib/image-model-catalog';
import { AI_VERTICAL_CATALOG } from '../../src/lib/ai-vertical-catalog';
import { auditVerticalModelFields, isAuditOwnedVertical } from '../data/catalog-audit-vertical';
import { CATALOG_ITEMS as CATALOG_1104_ITEMS } from '../data/catalog-2026-11-04';

// migrate-data-accuracy replays every migration on each deploy, so 023 re-creates
// models_pricing_unit_chk before 035/036 run. Its list alone must cover every seed unit
// and every unit the later migrations add, otherwise existing rows break the re-ADD.
function replayedModelsList(runner: string): Set<string> {
  const def = runner.match(/ADD CONSTRAINT models_pricing_unit_chk[\s\S]*?CHECK \(pricing_unit IN \(([^)]*)\)\)/)?.[1];
  assert.ok(def, '023 models_pricing_unit_chk found');
  return new Set([...def.matchAll(/'([^']+)'/g)].map(m => m[1]));
}
// Unit migrations registered in migrate-data-accuracy.ts; each appends its FOREACH ARRAY[...] values.
const UNIT_MIGRATIONS = ['0010_allow_per_hour_unit.sql', '0011_allow_per_image_unit.sql', '0015_allow_per_1k_characters_unit.sql'];

function allowedUnits(): Set<string> {
  const runner = readFileSync(new URL('../migrate-data-accuracy.ts', import.meta.url), 'utf8');
  const allowed = replayedModelsList(runner);
  const replayed = new Set(allowed);
  for (const file of UNIT_MIGRATIONS) {
    assert.ok(runner.includes(`../drizzle/${file}`), `${file} is registered in migrate-data-accuracy.ts`);
    const sql = readFileSync(new URL(`../../drizzle/${file}`, import.meta.url), 'utf8');
    const list = sql.match(/FOREACH v IN ARRAY ARRAY\[([^\]]+)\]/)?.[1];
    assert.ok(list, `${file} has a FOREACH unit list`);
    for (const m of list.matchAll(/'([^']+)'/g)) {
      assert.ok(replayed.has(m[1]), `${m[1]} (from ${file}) must also be in 023's replayed models_pricing_unit_chk`);
      allowed.add(m[1]);
    }
  }
  return allowed;
}

test('every models.pricing_unit used by image, non-llm, catalog-audit and 2026-11-04 seeds is allowed by migrations', () => {
  const allowed = allowedUnits();
  const used = new Map<string, string>();
  for (const item of [...NON_LLM_CATALOG, ...IMAGE_MODEL_CATALOG]) if (item.pricingUnit) used.set(item.pricingUnit, item.slug ?? item.name);
  for (const item of AI_VERTICAL_CATALOG.filter(isAuditOwnedVertical)) used.set(auditVerticalModelFields(item).pricing_unit, item.slug ?? item.name);
  // Dated seeds that write item.pricingUnit straight into models.pricing_unit (#303 failed on per_1k_characters).
  for (const item of CATALOG_1104_ITEMS) if (item.pricingUnit) used.set(item.pricingUnit, item.slug ?? item.name);
  const rejected = [...used].filter(([unit]) => !allowed.has(unit)).map(([unit, eg]) => `${unit} (e.g. ${eg})`);
  assert.deepEqual(rejected, [], `seed units missing from unit migrations: ${rejected.join(', ')}`);
  assert.ok(used.has('per_image'));
  assert.ok(used.has('per_1k_characters'));
});
