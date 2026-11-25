import Link from 'next/link';

/** An existing exact identity without a matching comparison remains accessible.
 * This does not claim subscription inclusion or redirect to another product.
 */
export default function ComparisonUnavailable({ slug, locale }: { slug: string; locale: string }) {
  const isZh = locale === 'zh';
  return <main className="mx-auto max-w-4xl px-4 py-12" data-comparison-fallback={slug}>
    <h1 className="text-2xl font-bold">{slug} — {isZh ? '订阅套餐对比' : 'Subscription comparison'}</h1>
    <p className="mt-4">{isZh
      ? '暂无可核对的同型号订阅对比数据。未记录数据不代表免费，也不证明任何套餐包含此型号。'
      : 'No matching subscription comparison is recorded for this identity. Missing data does not mean free access or prove that any plan includes this model.'}</p>
    <Link className="mt-4 inline-block underline" href={`/${isZh ? 'zh' : 'en'}/models/${encodeURIComponent(slug)}`}>
      {isZh ? '查看同型号资料' : 'View this model identity'}
    </Link>
  </main>;
}
