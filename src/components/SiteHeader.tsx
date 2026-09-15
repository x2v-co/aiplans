'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Calculator, ChevronDown, Github, Menu, Search, X } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GlobalSearch from '@/components/GlobalSearch';
import { useTranslations } from '@/lib/translations';

type NavItem = {
  href: string;
  label: string;
  active: boolean | null | undefined;
  icon?: typeof Calculator;
};

function navLinkClass(active: boolean | null | undefined) {
  return `inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-blue-600 ${active ? 'text-blue-600' : 'text-zinc-700 dark:text-zinc-200'}`;
}

function NavDropdown({
  label,
  active,
  items,
}: {
  label: string;
  active: boolean;
  items: NavItem[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={navLinkClass(active)}
          aria-label={label}
          title={label}
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className={item.active ? 'text-blue-600' : ''}>
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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

  const isModelsActive =
    pathname?.startsWith(`/${locale}/compare/models`) ||
    pathname?.startsWith(`/${locale}/api-pricing`) ||
    pathname?.startsWith(`/${locale}/models/`) ||
    pathname?.startsWith(`/${locale}/video-models`) ||
    pathname?.startsWith(`/${locale}/music-models`) ||
    pathname?.startsWith(`/${locale}/world-models`);
  const isPlansActive =
    pathname?.startsWith(`/${locale}/compare/plans`) ||
    pathname?.startsWith(`/${locale}/plans`) ||
    pathname?.startsWith(`/${locale}/creative-plans`) ||
    pathname?.startsWith(`/${locale}/coupons`);

  const modelLinks: NavItem[] = [
    { href: `/${locale}/compare/models`, label: t('compareModels'), active: pathname?.startsWith(`/${locale}/compare/models`) },
    { href: `/${locale}/api-pricing`, label: t('apiPricing'), active: pathname?.startsWith(`/${locale}/api-pricing`) || pathname?.startsWith(`/${locale}/models/`) },
    { href: `/${locale}/video-models`, label: t('videoModels'), active: pathname?.startsWith(`/${locale}/video-models`) },
    { href: `/${locale}/music-models`, label: t('musicModels'), active: pathname?.startsWith(`/${locale}/music-models`) },
    { href: `/${locale}/world-models`, label: t('worldModels'), active: pathname?.startsWith(`/${locale}/world-models`) },
  ];

  const planLinks: NavItem[] = [
    { href: `/${locale}/compare/plans`, label: t('comparePlans'), active: pathname?.startsWith(`/${locale}/compare/plans`) },
    { href: `/${locale}/plans`, label: t('plans'), active: pathname?.startsWith(`/${locale}/plans`) },
    { href: `/${locale}/creative-plans`, label: t('creativePlans'), active: pathname?.startsWith(`/${locale}/creative-plans`) },
    { href: `/${locale}/coupons`, label: t('coupons'), active: pathname?.startsWith(`/${locale}/coupons`) },
  ];

  const topLinks: NavItem[] = [
    { href: `/${locale}`, label: t('home'), active: pathname === `/${locale}` },
    { href: `/${locale}/agents`, label: t('agents'), active: pathname?.startsWith(`/${locale}/agents`) },
    { href: `/${locale}/calculator`, label: t('calculator'), active: pathname?.startsWith(`/${locale}/calculator`), icon: Calculator },
  ];

  const mobileGroups = [
    { label: locale === 'zh' ? '模型' : 'Models', items: modelLinks },
    { label: locale === 'zh' ? '套餐' : 'Plans', items: planLinks },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-sm dark:bg-black/90">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href={`/${locale}`} className="flex items-center gap-2" aria-label="aiplans.dev home">
          <span className="text-2xl" aria-hidden="true">💰</span>
          <span className="text-xl font-bold">aiplans.dev</span>
        </Link>

        <nav className="hidden items-center gap-5 xl:flex" aria-label={locale === 'zh' ? '主导航' : 'Primary navigation'}>
          {topLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={navLinkClass(item.active)}
            >
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </Link>
          ))}
          <NavDropdown label={locale === 'zh' ? '模型' : 'Models'} active={Boolean(isModelsActive)} items={modelLinks} />
          <NavDropdown label={locale === 'zh' ? '套餐' : 'Plans'} active={Boolean(isPlansActive)} items={planLinks} />
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
          <div className="container mx-auto flex flex-col gap-5">
            {topLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={navLinkClass(item.active)}
                onClick={() => setOpen(false)}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </Link>
            ))}
            {mobileGroups.map((group) => (
              <div key={group.label} className="border-t pt-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{group.label}</div>
                <div className="grid gap-3 pl-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={item.active ? 'page' : undefined}
                      className={navLinkClass(item.active)}
                      onClick={() => setOpen(false)}
                    >
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={openSearch}
              className="inline-flex items-center gap-2 border-t pt-4 text-left text-sm font-medium text-blue-600"
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
