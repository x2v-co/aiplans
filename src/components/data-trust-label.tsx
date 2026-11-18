import type { TrustAssessment } from '@/lib/data-trust';
import { featureLooksEstimated } from '@/lib/data-trust';
import { stripDisplayUrls } from '@/lib/plan-card-display';

function externalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/** Four provenance facts. Expired and estimated states stay visually separate from a verified price. */
export function DataTrustLabel({ fact, locale, showUnknownDate = false, record }: { fact: TrustAssessment; locale: string; showUnknownDate?: boolean; record?: string }) {
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
      data-trust-record={record}
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
        ) : <>{fact.sourceLabel}{showUnknownDate && (isZh ? '（来源未知）' : ' (source unknown)')}</>}
      </p>
      <p>
        <span className="font-semibold">{isZh ? '适用条件' : 'Conditions'}: </span>
        {fact.conditions.map(stripDisplayUrls).filter(Boolean).join(isZh ? '；' : '; ')}
      </p>
      {fact.verifiedOn && <p>
        <span className="font-semibold">{flags.estimated ? (isZh ? '估算 / 方法记录日期' : 'Estimate / method record date') : (isZh ? '最近核验' : 'Last verified')}: </span>
        <time dateTime={fact.verifiedOn}>{fact.verifiedOn}</time>
      </p>}
      {!fact.verifiedOn && showUnknownDate && <p>{isZh ? '核验时间：未知 / 未记录' : 'Verification time: unknown / not recorded'}</p>}
      {fact.verifiedOn && showUnknownDate && !flags.estimated && <p>{isZh ? '以上为历史记录日期，不代表本轮已核验当前事实。' : 'Historical record date; this review has not confirmed the current fact.'}</p>}
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
          <strong className="text-emerald-800 dark:text-emerald-200">{showUnknownDate ? (isZh ? '历史记录标为已核验' : 'Historically marked verified') : (isZh ? '已核验' : 'Verified')}</strong>
        )}
      </p>
    </aside>
  );
}

/** Sampling is a selection decision, never evidence of official verification. */
export function TrustScopeNote({ locale }: { locale: string }) {
  return <p data-trust-scope="pv-detail-sample-20261118" className="mb-5 max-w-4xl text-sm text-zinc-600 dark:text-zinc-300">
    {locale === 'zh'
      ? '本页属于选定的 10 个详情页 PV 样本（新加坡时间 2026-10-21 至 11-17），不代表全站排名或全部已获官方核验。来源、适用条件和核验时间按字段标注；缺失即待核验。估算不是确定权益。'
      : 'This page belongs to a selected ten-detail-page PV sample (Singapore, 2026-10-21 through 11-17), not a site-wide ranking or confirmation of official verification. Sources, conditions and verification times are field-specific; missing evidence needs verification. Estimates are not confirmed entitlements.'}
  </p>;
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
