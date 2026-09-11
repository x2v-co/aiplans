import Link from 'next/link';
import { variantOf } from '@/lib/grouped-products';

const LABELS: Record<string, { en: string; zh: string }> = {
  mini: { en: 'Mini', zh: '轻量' },
  nano: { en: 'Nano', zh: 'Nano' },
  batch: { en: 'Batch', zh: '批量' },
};

/**
 * Variant tags for a model slug (gpt-5-mini, gpt-4o-batch, gpt-5-mini-batch).
 * Links the batch/mini/nano variant back to its parent model. Server-rendered.
 */
export default function VariantBadges({ slug, locale }: { slug: string; locale: string }) {
  const v = variantOf(slug);
  if (!v) return null;
  const isZh = locale === 'zh';

  return (
    <span className="flex items-center gap-1.5 align-middle">
      {v.tags.map(tag => (
        <span
          key={tag}
          title={tag === 'batch'
            ? (isZh ? '异步批量接口，约为标准价 5 折' : 'Async batch endpoint (~50% off standard price)')
            : undefined}
          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {(LABELS[tag] ?? { en: tag, zh: tag })[isZh ? 'zh' : 'en']}
        </span>
      ))}
      {v.parent !== slug && (
        <Link
          href={`/${locale}/models/${v.parent}`}
          className="text-xs font-normal text-blue-600 hover:underline"
        >
          {isZh ? `标准型号：${v.parent}` : `Standard: ${v.parent}`}
        </Link>
      )}
    </span>
  );
}
