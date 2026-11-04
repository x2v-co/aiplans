import { X_ULTRA_QUOTA_DATE, X_ULTRA_QUOTA_SOURCE, xUltraQuotaCopy } from '@/lib/x-ultra-quota';

export function XUltraQuota({ locale }: { locale: string }) {
  const c = xUltraQuotaCopy(locale);
  return <section className="mb-8 max-w-4xl space-y-2 rounded-lg border p-4" aria-label={c.heading} data-quota-source="x2v-first-party">
    <h2 className="text-lg font-semibold">{c.heading}</h2>
    <p className="text-xs">{c.verifiedAt}: <time dateTime={X_ULTRA_QUOTA_DATE}>{X_ULTRA_QUOTA_DATE}</time></p>
    <p className="font-medium">{c.headline}</p>
    {c.notes.map(note => <p key={note} className="text-xs text-zinc-500">{note}</p>)}
    <a href={X_ULTRA_QUOTA_SOURCE} rel="noopener" target="_blank" className="text-xs underline">{c.source}</a>
  </section>;
}
