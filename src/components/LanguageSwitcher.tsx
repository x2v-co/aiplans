"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown, Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SUPPORTED_LOCALES = [
  { code: 'en', shortLabel: 'EN', label: 'English', nativeLabel: 'English' },
  { code: 'zh', shortLabel: '中文', label: 'Chinese', nativeLabel: '中文' },
] as const;

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['code'];

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale: SupportedLocale = pathname.startsWith('/zh') ? 'zh' : 'en';
  const currentLanguage = SUPPORTED_LOCALES.find((language) => language.code === currentLocale) ?? SUPPORTED_LOCALES[0];

  const switchLocale = (newLocale: SupportedLocale) => {
    if (newLocale === currentLocale) return;

    const newPathname = pathname.match(/^\/(en|zh)(\/|$)/)
      ? pathname.replace(/^\/(en|zh)/, `/${newLocale}`)
      : `/${newLocale}${pathname}`;

    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    router.push(newPathname);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label={currentLocale === 'zh' ? '选择语言' : 'Choose language'}
          title={currentLocale === 'zh' ? '选择语言' : 'Choose language'}
        >
          <Languages className="h-4 w-4" aria-hidden="true" />
          <span>{currentLanguage.shortLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-36">
        {SUPPORTED_LOCALES.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => switchLocale(language.code)}
            className="flex cursor-pointer items-center justify-between gap-3"
          >
            <span className="flex flex-col">
              <span className="font-medium">{language.nativeLabel}</span>
              <span className="text-xs text-muted-foreground">{language.label}</span>
            </span>
            {language.code === currentLocale && <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
