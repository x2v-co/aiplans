"use client";

import { usePathname, useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  // Extract current locale from pathname
  const currentLocale = pathname.startsWith('/zh') ? 'zh' : 'en';

  const switchLocale = (newLocale: string) => {
    // Replace locale in pathname
    const newPathname = pathname.replace(/^\/(en|zh)/, `/${newLocale}`);

    // Set cookie for persistence
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;

    router.push(newPathname);
  };

  return (
    <div className="flex items-center gap-1">
      <Languages className="w-4 h-4 text-zinc-500 mr-1" />
      <button
        onClick={() => switchLocale('en')}
        className={`w-8 h-8 flex items-center justify-center text-lg rounded transition-colors ${
          currentLocale === 'en'
            ? 'bg-blue-100 dark:bg-blue-900'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
        title="English"
      >
        🇺🇸
      </button>
      <button
        onClick={() => switchLocale('zh')}
        className={`w-8 h-8 flex items-center justify-center text-lg rounded transition-colors ${
          currentLocale === 'zh'
            ? 'bg-blue-100 dark:bg-blue-900'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
        title="中文"
      >
        🇨🇳
      </button>
    </div>
  );
}
