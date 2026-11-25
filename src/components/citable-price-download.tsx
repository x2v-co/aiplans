import {
  COVERAGE_WORDING,
  HISTORY_LIMIT,
  REDISTRIBUTION,
} from '@/lib/citable-price-facts';

export function CitablePriceDownload({ locale }: { locale: 'en' | 'zh' }) {
  const zh = locale === 'zh';
  return (
    <section className="border-t py-9" aria-labelledby="citable-prices">
      <div className="max-w-3xl">
        <h2 id="citable-prices" className="text-2xl font-semibold">
          {zh ? '报价下载（再分发尚未发布）' : 'Quote download (redistribution unpublished)'}
        </h2>
        <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
          {zh ? COVERAGE_WORDING.zh : COVERAGE_WORDING.en}
        </p>
        <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
          {zh
            ? '当前 JSON 与 CSV 的报价列表为空，并附有原因、快照校验值及不授予许可的说明。'
            : 'The current JSON and CSV contain an empty quote list, its reason, a snapshot id, and statements that no license is granted.'}
        </p>
        <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
          {zh ? REDISTRIBUTION.zh : REDISTRIBUTION.en}
          {' '}
          {zh ? HISTORY_LIMIT.zh : HISTORY_LIMIT.en}
        </p>
        <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
          {zh
            ? '上方数字是本次请求时本站数据库里标记为可用的 LLM 渠道行，与下载文件的行数分开计算。'
            : 'The counts above are the available LLM channel rows in this site’s database for this request. They are counted separately from the rows in the download.'}
        </p>
      </div>
      <div className="mt-6 flex flex-wrap gap-5 text-sm font-medium">
        {/* File responses, not App Router pages. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/citable-prices?format=json" className="text-blue-600 hover:underline">
          JSON
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/citable-prices?format=csv" className="text-blue-600 hover:underline">
          CSV
        </a>
        <a href={`/${locale}/methodology`} className="text-blue-600 hover:underline">
          {zh ? '数据方法' : 'Methodology'}
        </a>
      </div>
    </section>
  );
}
