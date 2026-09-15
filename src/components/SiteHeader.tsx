'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Calculator, Github, Menu, MoreHorizontal, Search, X } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GlobalSearch from '@/components/GlobalSearch';
import { useTranslations } from '@/lib/translations';

export default function SiteHeader({ locale }: { locale: string }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tSearch = useTranslations('search');
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = () => {
    setOpen(false);
    setSearchOpen(true);
  };

  const links: Array<{
    href: string;
    label: string;
    active: boolean | null | undefined;
    icon?: typeof Calculator;
    overflow?: boolean;
  }> = [
    { href: `/${locale}`, label: t('home'), active: pathname === `/${locale}` },
    { href: `/${locale}/compare/plans`, label: t('comparePlans'), active: pathname?.startsWith(`/${locale}/compare/plans`) },
    { href: `/${locale}/compare/models`, label: t('compareModels'), active: pathname?.startsWith(`/${locale}/compare/models`) },
    { href: `/${locale}/agents`, label: t('agents'), active: pathname?.startsWith(`/${locale}/agents`) },
    { href: `/${locale}/video-models`, label: t('videoModels'), active: pathname?.startsWith(`/${locale}/video-models`) },
    { href: `/${locale}/creative-plans`, label: t('creativePlans'), active: pathname?.startsWith(`/${locale}/creative-plans`), overflow: true },
    { href: `/${locale}/music-models`, label: t('musicModels'), active: pathname?.startsWith(`/${locale}/music-models`), overflow: true },
    { href: `/${locale}/world-models`, label: t('worldModels'), active: pathname?.startsWith(`/${locale}/world-models`), overflow: true },
    { href: `/${locale}/api-pricing`, label: t('apiPricing'), active: pathname?.startsWith(`/${locale}/api-pricing`) || pathname?.startsWith(`/${locale}/models/`) },
    { href: `/${locale}/calculator`, label: t('calculator'), active: pathname?.startsWith(`/${locale}/calculator`), icon: Calculator },
    { href: `/${locale}/coupons`, label: t('coupons'), active: pathname?.startsWith(`/${locale}/coupons`), overflow: true },
  ];

  const primaryLinks = links.filter((item) => !item.overflow);
  const overflowLinks = links.filter((item) => item.overflow);

  const navLinks = links.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-blue-600 ${item.active ? 'text-blue-600' : ''}`}
      onClick={() => setOpen(false)}
    >
      {item.icon && <item.icon className="h-4 w-4" />}
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

        <nav className="hidden items-center gap-4 xl:flex" aria-label={locale === 'zh' ? '主导航' : 'Primary navigation'}>
          {primaryLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-blue-600 ${item.active ? 'text-blue-600' : ''}`}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-blue-600 ${overflowLinks.some((item) => item.active) ? 'text-blue-600' : ''}`}
                aria-label={locale === 'zh' ? '更多导航' : 'More navigation'}
                title={locale === 'zh' ? '更多' : 'More'}
              >
                <MoreHorizontal className="h-4 w-4" />
                {locale === 'zh' ? '更多' : 'More'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {overflowLinks.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href} className={item.active ? 'text-blue-600' : ''}>
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={openSearch}
            className="text-zinc-600 transition-colors hover:text-blue-600 dark:text-zinc-300"
            aria-label={tSearch('openSearch')}
            title={tSearch('openSearch')}
          >
            <Search className="h-5 w-5" />
          </button>
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

        <div className="flex items-center gap-2 xl:hidden">
          <button
            type="button"
            onClick={openSearch}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-white dark:bg-zinc-950"
            aria-label={tSearch('openSearch')}
            title={tSearch('openSearch')}
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-white dark:bg-zinc-950"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? (locale === 'zh' ? '关闭菜单' : 'Close menu') : (locale === 'zh' ? '打开菜单' : 'Open menu')}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-navigation"
          className="border-t bg-white px-4 py-4 shadow-sm xl:hidden dark:bg-black"
          aria-label={locale === 'zh' ? '移动端主导航' : 'Mobile navigation'}
        >
          <div className="container mx-auto flex flex-col gap-4">
            {navLinks}
            <button
              type="button"
              onClick={openSearch}
              className="inline-flex items-center gap-2 text-left text-sm font-medium text-blue-600"
            >
              <Search className="h-4 w-4" /> {tSearch('openSearch')}
            </button>
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

      <GlobalSearch locale={locale} open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
