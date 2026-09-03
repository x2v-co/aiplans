'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/translations';
import { CONSENT_OPEN_EVENT } from '@/lib/consent';

/**
 * Site-wide footer. Mounted once in [locale]/layout.tsx so every locale route
 * shares consistent product navigation, the company link (x2v.co), and the
 * sister-product links (aeeis.com, toolkit.fun). External links use
 * rel="noopener noreferrer"; they are editorial/company links (not paid or
 * affiliate), so no nofollow/sponsored.
 */
export default function Footer({ locale }: { locale: string }) {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-white/60 dark:bg-black/60 mt-16">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href={`/${locale}`} className="flex items-center gap-2 mb-3">
              <span className="text-2xl">💰</span>
              <span className="text-lg font-bold">aiplans.dev</span>
            </Link>
            <p className="text-sm text-zinc-500 max-w-xs">{t('tagline')}</p>
          </div>

          {/* Compare */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('compare')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/compare/plans`} className="text-zinc-500 hover:text-blue-600">
                  {t('comparePlans')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/compare/models`} className="text-zinc-500 hover:text-blue-600">
                  {t('compareModels')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/api-pricing`} className="text-zinc-500 hover:text-blue-600">
                  {t('apiPricing')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/coupons`} className="text-zinc-500 hover:text-blue-600">
                  {t('coupons')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Research */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('research')}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href={`/${locale}/guides`} className="text-zinc-500 hover:text-blue-600">
                  {t('pricingGuides')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/reports/api-price-index`} className="text-zinc-500 hover:text-blue-600">
                  {t('priceIndex')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company and policies */}
          <div>
            <h3 className="text-sm font-semibold mb-3">{t('company')}</h3>
            <ul className="space-y-2 text-sm">
              {[
                ['about', t('about')],
                ['methodology', t('methodologyLink')],
                ['contact', t('contact')],
                ['disclosure', t('disclosure')],
                ['privacy', t('privacy')],
                ['terms', t('terms')],
              ].map(([path, label]) => (
                <li key={path}>
                  <Link href={`/${locale}/${path}`} className="text-zinc-500 hover:text-blue-600">{label}</Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="text-left text-zinc-500 hover:text-blue-600"
                  onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
                >
                  {t('cookieSettings')}
                </button>
              </li>
            </ul>
          </div>

          {/* More from x2v */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold mb-3">{t('moreFromX2v')}</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://x2v.co"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <span className="font-medium group-hover:text-blue-600">x2v</span>
                  <span className="block text-zinc-500">{t('x2vBlurb')}</span>
                </a>
              </li>
              <li>
                <a
                  href="https://aeeis.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <span className="font-medium group-hover:text-blue-600">AEEIS AI Chat</span>
                  <span className="block text-zinc-500">{t('aeeisBlurb')}</span>
                </a>
              </li>
              <li>
                <a
                  href="https://toolkit.fun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <span className="font-medium group-hover:text-blue-600">ToolkitFun</span>
                  <span className="block text-zinc-500">{t('toolkitBlurb')}</span>
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/x2v-co/aiplans"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-blue-600"
                >
                  {t('github')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-zinc-500">
          <p>{t('copyright', { year })}</p>
          <p>{t('methodology')}</p>
        </div>
      </div>
    </footer>
  );
}
