'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Github, Menu, X } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/lib/translations';

export default function SiteHeader({ locale }: { locale: string }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  const links = [
    { href: `/${locale}`, label: t('home'), active: pathname === `/${locale}` },
    { href: `/${locale}/compare/plans`, label: t('comparePlans'), active: pathname?.startsWith(`/${locale}/compare/plans`) },
    { href: `/${locale}/compare/models`, label: t('compareModels'), active: pathname?.startsWith(`/${locale}/compare/models`) },
    { href: `/${locale}/api-pricing`, label: t('apiPricing'), active: pathname?.startsWith(`/${locale}/api-pricing`) || pathname?.startsWith(`/${locale}/models/`) },
    { href: `/${locale}/coupons`, label: t('coupons'), active: pathname?.startsWith(`/${locale}/coupons`) },
  ];

  const navLinks = links.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={`text-sm font-medium transition-colors hover:text-blue-600 ${item.active ? 'text-blue-600' : ''}`}
      onClick={() => setOpen(false)}
    >
      {item.label}
    </Link>
  ));

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-sm dark:bg-black/90">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href={`/${locale}`} className="flex items-center gap-2" aria-label="aiplans.dev home">
          <span className="text-2xl" aria-hidden="true">💰</span>
          <span className="text-xl font-bold">aiplans.dev</span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex" aria-label={locale === 'zh' ? '主导航' : 'Primary navigation'}>
          {navLinks}
          <a
            href="https://github.com/x2v-co/aiplans"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 transition-colors hover:text-blue-600 dark:text-zinc-300"
            aria-label="GitHub"
            title="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
          <LanguageSwitcher />
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-white md:hidden dark:bg-zinc-950"
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? (locale === 'zh' ? '关闭菜单' : 'Close menu') : (locale === 'zh' ? '打开菜单' : 'Open menu')}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-navigation"
          className="border-t bg-white px-4 py-4 shadow-sm md:hidden dark:bg-black"
          aria-label={locale === 'zh' ? '移动端主导航' : 'Mobile navigation'}
        >
          <div className="container mx-auto flex flex-col gap-4">
            {navLinks}
            <div className="flex items-center justify-between border-t pt-4">
              <a
                href="https://github.com/x2v-co/aiplans"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium"
              >
                <Github className="h-5 w-5" /> GitHub
              </a>
              <LanguageSwitcher />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
