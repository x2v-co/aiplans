/**
 * Official supported-country lists (verified 2026-11-05) for #327's supported_regions columns.
 * Writes ONLY supported_regions / regions_source_url / regions_verified_at on providers.
 * access_from_china is intentionally left untouched: the #327 display logic derives China
 * from supported_regions, so the default-era boolean no longer drives anything.
 * Chinese vendors: CN from their China-facing site/console. Rows without evidence stay NULL (not researched), never guessed.
 */
import type { Sql } from 'postgres';

export const REGIONS_VERIFIED_AT = '2026-11-05T00:00:00.000Z';
export const REGION_FIELDS = ['supported_regions', 'regions_source_url', 'regions_verified_at'] as const;

export type RegionSpec = { table: 'providers'; slug: string; sourceUrl: string; regions: string[] };

const codes = (s: string) => s.trim().split(/\s+/);

export const SUPPORTED_REGIONS_2026_11_05: RegionSpec[] = [
  { table: 'providers', slug: 'openai', sourceUrl: 'https://developers.openai.com/api/docs/supported-countries', regions: codes(`
    AD AE AF AG AL AM AO AR AT AU AW AX AZ BA BB BD BE BF BG BH
    BI BJ BL BM BN BO BR BS BT BW BZ CA CD CF CG CH CI CL CM CO
    CR CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO
    FR GA GB GD GE GF GH GL GM GN GP GQ GR GT GW GY HN HR HT HU
    ID IE IL IN IQ IS IT JM JO JP KE KG KH KI KM KN KR KW KY KZ
    LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML
    MM MN MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR
    NZ OM PA PE PF PG PH PK PL PM PS PT PW PY QA RE RO RS RW SA
    SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SZ TD TF
    TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VN
    VU WF WS YE YT ZA ZM ZW
  `) },
  { table: 'providers', slug: 'anthropic', sourceUrl: 'https://www.anthropic.com/legal/supported-regions', regions: codes(`
    AD AE AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN
    BO BR BS BT BW BZ CA CD CF CG CH CI CL CM CO CR CV CY CZ DE
    DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH
    GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IS IT JM JO
    JP KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV
    LY MA MC MD ME MG MH MK ML MN MR MT MU MV MW MX MY MZ NA NE
    NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO
    RS RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SZ TD
    TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VN
    VU WS ZA ZM ZW
  `) },
  { table: 'providers', slug: 'google', sourceUrl: 'https://ai.google.dev/gemini-api/docs/available-regions', regions: codes(`
    AD AE AG AI AL AM AO AQ AR AS AT AU AW AZ BA BB BD BE BF BG
    BH BI BJ BL BM BN BO BQ BR BS BT BW BZ CA CC CD CF CG CH CI
    CK CL CM CO CR CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH
    ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN
    GQ GR GS GT GU GW GY HM HN HR HT HU ID IE IL IM IN IO IQ IS
    IT JE JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK
    LR LS LT LU LV LY MA MC MD ME MG MH MK ML MN MP MR MS MT MU
    MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE
    PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RW SA SB SC SD
    SE SG SH SI SK SL SM SN SO SR SS ST SV SZ TC TD TG TH TJ TK
    TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI
    VN VU WF WS XK YE ZA ZM ZW
  `) },
  // Chinese vendors (boss 11-05): the China-facing official site/console (mainland signup, RMB billing) is the CN source.
  // Global twins (moonshot-global, minimax-global, zhipu-global) stay NULL on purpose.
  { table: 'providers', slug: 'deepseek', sourceUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing', regions: ['CN'] },
  { table: 'providers', slug: 'qwen', sourceUrl: 'https://bailian.console.aliyun.com/', regions: ['CN'] },
  { table: 'providers', slug: 'moonshot-china', sourceUrl: 'https://platform.kimi.com/docs/pricing/chat', regions: ['CN'] },
  { table: 'providers', slug: 'minimax-china', sourceUrl: 'https://platform.minimax.cn/docs/pricing/overview', regions: ['CN'] },
  { table: 'providers', slug: 'zhipu-china', sourceUrl: 'https://docs.bigmodel.cn/cn/guide/start/quick-start', regions: ['CN'] },
  { table: 'providers', slug: 'stepfun', sourceUrl: 'https://platform.stepfun.com/', regions: ['CN'] },
  { table: 'providers', slug: 'seed', sourceUrl: 'https://console.volcengine.com/ark/region:cn-beijing/overview', regions: ['CN'] },
  { table: 'providers', slug: 'hunyuan', sourceUrl: 'https://console.cloud.tencent.com/hunyuan', regions: ['CN'] },
  { table: 'providers', slug: 'baidu', sourceUrl: 'https://cloud.baidu.com/doc/qianfan/index.html', regions: ['CN'] },
  { table: 'providers', slug: 'siliconflow', sourceUrl: 'https://cloud.siliconflow.cn/', regions: ['CN'] },
];

export function validateRegionSpec(spec: RegionSpec): void {
  let url: URL;
  try { url = new URL(spec.sourceUrl); } catch { throw new Error(`${spec.slug}: regions_source_url is required; refusing to write`); }
  if (url.protocol !== 'https:') throw new Error(`${spec.slug}: regions_source_url must be https; refusing to write`);
  if (!spec.regions.length) throw new Error(`${spec.slug}: empty region list; refusing to write`);
  const bad = spec.regions.filter(c => !/^[A-Z]{2}$/.test(c));
  if (bad.length) throw new Error(`${spec.slug}: invalid ISO alpha-2 codes ${bad.join(',')}`);
  if (new Set(spec.regions).size !== spec.regions.length) throw new Error(`${spec.slug}: duplicate codes`);
}

export type RegionStep = { table: string; slug: string; id: number; action: 'update' | 'unchanged'; count: number };

const sameRegions = (a: unknown, b: string[]) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
const sameTime = (a: unknown, b: string) => a != null && new Date(a as string).getTime() === new Date(b).getTime();

export async function seedSupportedRegions(tx: Sql, specs: RegionSpec[] = SUPPORTED_REGIONS_2026_11_05): Promise<RegionStep[]> {
  specs.forEach(validateRegionSpec);
  const slugs = specs.map(s => s.slug);
  const rows = await tx`SELECT * FROM providers WHERE slug IN ${tx(slugs)}`;
  const missing = slugs.filter(slug => !rows.some(r => r.slug === slug));
  if (missing.length) throw new Error(`providers not found: ${missing.join(', ')}; nothing written`);
  const steps: RegionStep[] = [];
  for (const spec of specs) {
    const row = rows.find(r => r.slug === spec.slug)!;
    const regions = [...spec.regions].sort();
    const unchanged = sameRegions(row.supported_regions, regions) && row.regions_source_url === spec.sourceUrl
      && sameTime(row.regions_verified_at, REGIONS_VERIFIED_AT);
    if (!unchanged) {
      const payload = { supported_regions: regions, regions_source_url: spec.sourceUrl, regions_verified_at: new Date(REGIONS_VERIFIED_AT) };
      await tx`UPDATE ${tx(spec.table)} SET ${tx(payload, ...REGION_FIELDS)} WHERE id = ${row.id}`;
    }
    steps.push({ table: spec.table, slug: spec.slug, id: Number(row.id), action: unchanged ? 'unchanged' : 'update', count: regions.length });
  }
  return steps;
}
