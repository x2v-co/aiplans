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
          {zh ? '可引用的官方公开报价' : 'Citable official public prices'}
        </h2>
        <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
          {zh ? COVERAGE_WORDING.zh : COVERAGE_WORDING.en}
        </p>
        <p className="mt-3 leading-7 text-zinc-600 dark:text-zinc-400">
          {zh
            ? '每一行带有来源链接、模型标识、渠道、币种、计价单位、输入和输出价格、缓存与促销条件、核验时间，以及整份样本的快照校验值。输入、输出、缓存或促销结束后的常规价如果没有，会标成缺失。'
            : 'Each row carries a source link, model slug, channel, currency, price unit, input and output prices, cache and promotional conditions, a verification time, and the sample’s snapshot id. A missing input, output, cache, or post-promotion regular price stays marked missing.'}
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
