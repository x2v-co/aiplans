import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { isQuotaEvidenceAuthorized, QUOTA_EVIDENCE_COOKIE } from '@/lib/quota/evidence-auth';
import { evidenceLink, groupQuotaEvidence, loadQuotaEvidence } from '@/lib/quota/evidence';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Quota evidence — internal review',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function QuotaEvidencePage({ params }: { params: Promise<{ locale: string }> }) {
  const [h, c] = await Promise.all([headers(), cookies()]);
  if (!isQuotaEvidenceAuthorized(h.get('authorization'), c.get(QUOTA_EVIDENCE_COOKIE)?.value)) notFound();
  const { locale } = await params;
  const zh = locale === 'zh';
  const groups = groupQuotaEvidence(await loadQuotaEvidence());
  const confidenceNames: Record<string, string> = zh ? { high: '高', medium: '中', low: '低' } : { high: 'high', medium: 'medium', low: 'low' };
  const statusNames: Record<string, string> = zh ? { pending: '待审核', accepted: '已接受', rejected: '已拒绝' } : { pending: 'pending', accepted: 'accepted', rejected: 'rejected' };

  return (
    <main className="container mx-auto max-w-6xl space-y-8 px-4 py-12">
      <h1 className="text-3xl font-bold">{zh ? '额度证据（内部审核）' : 'Quota evidence (internal review)'}</h1>
      <p className="text-zinc-500">{zh ? '社区证据仅供审核。接受证据不会更新额度估算。' : 'Community evidence for review. Accepting evidence does not update quota estimates.'}</p>
      {groups.size === 0 && <p>{zh ? '暂无证据，或尚未应用手动迁移。' : 'No evidence yet, or the manual migrations have not been applied.'}</p>}
      {[...groups].map(([plan, rows]) => (
        <section key={plan ?? ''} className="space-y-4">
          <h2 className="text-xl font-semibold">{plan ?? (zh ? '尚未分配套餐' : 'Unassigned plan')}</h2>
          {rows.map((row) => {
            const url = evidenceLink(row.url);
            const screenshot = evidenceLink(row.screenshotUrl);
            return (
              <article key={row.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">#{row.id} · {row.sourceName ?? (zh ? '未知来源' : 'Unknown source')}{row.authorHandle ? ` (${row.authorHandle})` : ''}</span>
                  <Badge variant={row.confidence === 'medium' ? 'secondary' : 'outline'}>{zh ? '置信度：' : 'Confidence: '}{confidenceNames[row.confidence] ?? row.confidence}</Badge>
                  <Badge variant={row.reviewStatus === 'rejected' ? 'destructive' : 'outline'}>{statusNames[row.reviewStatus ?? 'pending'] ?? row.reviewStatus}</Badge>
                </div>
                <p className="text-sm text-zinc-500">
                  {zh ? '观测时间：' : 'Observed: '}{row.observedAt ? <time dateTime={row.observedAt.toISOString()}>{row.observedAt.toISOString()}</time> : '—'}
                  {' · '}{zh ? '采集日期：' : 'Captured: '}{row.capturedAt}
                </p>
                <div className="flex gap-4 text-sm underline">
                  {url && <a href={url} target="_blank" rel="noopener noreferrer">{zh ? '来源链接' : 'Source'}</a>}
                  {screenshot && <a href={screenshot} target="_blank" rel="noopener noreferrer">{zh ? '截图' : 'Screenshot'}</a>}
                </div>
                {row.rawValue && <p className="whitespace-pre-wrap break-words text-sm">{row.rawValue}</p>}
                {row.notes && <details><summary className="cursor-pointer text-sm">{zh ? '备注与计算假设' : 'Notes and calculation assumptions'}</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.notes}</p></details>}
              </article>
            );
          })}
        </section>
      ))}
    </main>
  );
}
