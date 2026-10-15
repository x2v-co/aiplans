'use client';

import { NextIntlClientProvider } from 'next-intl';
import { TranslationsProvider } from '@/lib/translations';

// Two translation hooks live in this app: the local '@/lib/translations' one
// and next-intl's useTranslations/useLocale (channel terms, Copilot notes,
// DeepSeek windows, lifecycle badges). next-intl's client hooks throw without
// NextIntlClientProvider, which 404/500'd every provider and model page.
export default function LocaleClientWrapper({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: any;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <TranslationsProvider messages={messages}>
        {children}
      </TranslationsProvider>
    </NextIntlClientProvider>
  );
}
