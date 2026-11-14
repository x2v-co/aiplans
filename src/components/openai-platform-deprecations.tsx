import {
  OPENAI_DEPRECATIONS_SOURCE, OPENAI_PLATFORM_DEPRECATIONS_VERIFIED, openAiPlatformDeprecationsCopy,
} from '@/lib/openai-platform-deprecations';

export function OpenAiPlatformDeprecations({ locale }: { locale: string }) {
  const c = openAiPlatformDeprecationsCopy(locale);
  return <section className="mb-8 max-w-4xl space-y-2 rounded-lg border p-4" aria-label={c.heading} data-deprecation-source="openai-official">
    <h2 className="text-lg font-semibold">{c.heading}</h2>
    <p className="text-xs">{c.verifiedAt}: <time dateTime={OPENAI_PLATFORM_DEPRECATIONS_VERIFIED}>{OPENAI_PLATFORM_DEPRECATIONS_VERIFIED}</time></p>
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {c.items.map(item => <li key={item.key} data-date={item.date}>{item.text}</li>)}
    </ul>
    <p className="text-xs text-zinc-500">{c.note}</p>
    <a href={OPENAI_DEPRECATIONS_SOURCE} rel="noopener" target="_blank" className="text-xs underline">{c.source}</a>
  </section>;
}
