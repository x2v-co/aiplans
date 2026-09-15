import { AI_VERTICAL_CATALOG, RIGOROUS_MODEL_KINDS, type AiCatalogItem } from '../src/lib/ai-vertical-catalog';

interface Finding {
  level: 'critical' | 'warning';
  row: string;
  message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const findings: Finding[] = [];

function rowId(item: AiCatalogItem): string {
  return `${item.kind}:${item.slug ?? item.provider + '/' + item.name}`;
}

function critical(item: AiCatalogItem, message: string) {
  findings.push({ level: 'critical', row: rowId(item), message });
}

function warning(item: AiCatalogItem, message: string) {
  findings.push({ level: 'warning', row: rowId(item), message });
}

function requireNonEmpty(item: AiCatalogItem, field: keyof AiCatalogItem) {
  const value = item[field];
  if (typeof value === 'string' && value.trim().length > 0) return;
  if (Array.isArray(value) && value.length > 0) return;
  critical(item, `missing ${String(field)}`);
}

const seenSlugs = new Map<string, string>();

for (const item of AI_VERTICAL_CATALOG) {
  if (item.slug) {
    const previous = seenSlugs.get(item.slug);
    if (previous) {
      critical(item, `duplicate slug also used by ${previous}`);
    }
    seenSlugs.set(item.slug, rowId(item));
  }

  if (!RIGOROUS_MODEL_KINDS.includes(item.kind)) continue;

  requireNonEmpty(item, 'slug');
  requireNonEmpty(item, 'modelCategory');
  requireNonEmpty(item, 'inputModalities');
  requireNonEmpty(item, 'outputModalities');
  requireNonEmpty(item, 'access');
  requireNonEmpty(item, 'pricingUnit');
  requireNonEmpty(item, 'pricingConfidence');
  requireNonEmpty(item, 'sourceUrls');
  requireNonEmpty(item, 'lastVerified');

  if (item.kind === 'video-model' && item.modelCategory !== 'video') {
    critical(item, `video-model must have modelCategory=video, got ${item.modelCategory}`);
  }
  if (item.kind === 'music-model' && item.modelCategory !== 'music') {
    critical(item, `music-model must have modelCategory=music, got ${item.modelCategory}`);
  }
  if (item.kind === 'world-model' && item.modelCategory !== 'world') {
    critical(item, `world-model must have modelCategory=world, got ${item.modelCategory}`);
  }

  if (item.lastVerified && !ISO_DATE.test(item.lastVerified)) {
    critical(item, `lastVerified must be YYYY-MM-DD, got ${item.lastVerified}`);
  }

  if (item.sourceUrls) {
    if (item.sourceUrls.length < 1) {
      critical(item, 'sourceUrls must include at least one official source');
    }
    for (const source of item.sourceUrls) {
      if (!source.publisher?.trim()) critical(item, `source ${source.url} missing publisher`);
      if (!source.label?.trim()) critical(item, `source ${source.url} missing label`);
      if (!/^https:\/\//.test(source.url)) critical(item, `source URL must be https: ${source.url}`);
    }
  }

  if (item.pricingConfidence === 'verified') {
    warning(item, 'pricingConfidence=verified should only be used after numeric prices are in usage_prices or plan rows');
  }

  if (item.status === 'research' && item.pricingConfidence !== 'not-commercial' && item.pricingConfidence !== 'unknown') {
    warning(item, `research item should usually be not-commercial/unknown, got ${item.pricingConfidence}`);
  }
}

const criticalCount = findings.filter((finding) => finding.level === 'critical').length;
const warningCount = findings.filter((finding) => finding.level === 'warning').length;

if (findings.length === 0) {
  console.log(`vertical-catalog audit passed: ${AI_VERTICAL_CATALOG.length} rows, ${RIGOROUS_MODEL_KINDS.join(', ')} strict`);
  process.exit(0);
}

for (const finding of findings) {
  const prefix = finding.level === 'critical' ? 'CRITICAL' : 'WARNING';
  console.log(`${prefix} ${finding.row}: ${finding.message}`);
}

console.log(`vertical-catalog audit finished: ${criticalCount} critical, ${warningCount} warnings`);
process.exit(criticalCount > 0 ? 1 : 0);
