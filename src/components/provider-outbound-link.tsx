import Link from 'next/link';
import { AFFILIATE_LINK_REL, affiliateDisclosureText, resolveOutboundLink } from '@/lib/affiliate-links';

export function ProviderOutboundLink({ url, providerSlug, locale, label }: {
  url?: string | null;
  providerSlug: string;
  locale: string;
  label: string;
}) {
  // Check the data before resolving: affiliate providers can resolve an absent URL.
  if (!url) return null;
  const outbound = resolveOutboundLink(url, providerSlug);
  if (!outbound) return null;
  return (
    <div>
      <a href={outbound.href} target="_blank" rel={outbound.affiliate ? AFFILIATE_LINK_REL : 'noopener noreferrer'} className="font-medium text-blue-600 hover:underline">
        {label} ↗
      </a>
      {outbound.affiliate && (
        <p className="mt-1 max-w-sm text-xs text-zinc-500">
          {affiliateDisclosureText(locale)}{' '}
          <Link href={`/${locale}/disclosure`} className="underline">{locale === 'zh' ? '披露说明' : 'Disclosure'}</Link>
        </p>
      )}
    </div>
  );
}
