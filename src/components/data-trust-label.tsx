import type { TrustAssessment } from '@/lib/data-trust';
import { featureLooksEstimated } from '@/lib/data-trust';
import { stripDisplayUrls } from '@/lib/plan-card-display';

function externalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/** Four provenance facts. Expired and estimated states stay visually separate from a verified price. */
export function DataTrustLabel({ fact, locale }: { fact: TrustAssessment; locale: string }) {
  const isZh = locale === 'zh';
  const { flags } = fact;
  const tone = flags.expired
    ? 'border-red-500 bg-red-50 text-red-950 dark:border-red-600 dark:bg-red-950 dark:text-red-50'
    : flags.estimated
      ? 'border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-50'
      : flags.stale || flags.unverified
        ? 'border-amber-300 bg-amber-50/80 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-50'
        : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';
  return (
    <aside
      data-trust-label="true"
      data-trust-estimated={flags.estimated ? 'true' : 'false'}
      data-trust-expired={flags.expired ? 'true' : 'false'}
      data-trust-stale={flags.stale ? 'true' : 'false'}
      data-trust-unverified={flags.unverified ? 'true' : 'false'}
      className={`mt-2 max-w-xl rounded-md border px-2 py-1.5 text-[11px] leading-4 ${tone}`}
    >
      <p>
        <span className="font-semibold">{isZh ? '来源' : 'Source'}: </span>
        {fact.sourceUrl ? (
          <a
            href={fact.sourceUrl}
            className="underline"
            {...(externalUrl(fact.sourceUrl) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {fact.sourceLabel}
          </a>
        ) : fact.sourceLabel}
      </p>
      <p>
        <span className="font-semibold">{isZh ? '适用条件' : 'Conditions'}: </span>
        {fact.conditions.map(stripDisplayUrls).filter(Boolean).join(isZh ? '；' : '; ')}
      </p>
      {fact.verifiedOn && <p>
        <span className="font-semibold">{isZh ? '最近核验' : 'Last verified'}: </span>
        <time dateTime={fact.verifiedOn}>{fact.verifiedOn}</time>
      </p>}
      <p className="mt-1 flex flex-wrap gap-1">
        {flags.estimated && (
          <strong className="rounded bg-amber-300 px-1.5 py-0.5 text-amber-950">{isZh ? '估算' : 'Estimate'}</strong>
        )}
        {flags.expired && (
          <strong className="rounded bg-red-600 px-1.5 py-0.5 text-white">{isZh ? '已过期' : 'Expired'}</strong>
        )}
        {flags.unverified && (
          <strong className="rounded bg-amber-300 px-1.5 py-0.5 text-amber-950">{isZh ? '待核验' : 'Needs verification'}</strong>
        )}
        {flags.stale && (
          <strong className="rounded bg-amber-300 px-1.5 py-0.5 text-amber-950">{isZh ? '核验已超过 30 天' : 'Verification older than 30 days'}</strong>
        )}
        {!flags.estimated && !flags.expired && !flags.unverified && !flags.stale && (
          <strong className="text-emerald-800 dark:text-emerald-200">{isZh ? '已核验' : 'Verified'}</strong>
        )}
      </p>
    </aside>
  );
}

/** An estimated sentence does not get a confirmation check. */
export function EntitlementLine({ text, locale }: { text: string; locale: string }) {
  if (!featureLooksEstimated(text)) return <span>{text}</span>;
  return (
    <span>
      <strong className="mr-1 rounded bg-amber-300 px-1.5 py-0.5 text-[10px] text-amber-950">
        {locale === 'zh' ? '估算' : 'Estimate'}
      </strong>
      {text}
    </span>
  );
}
