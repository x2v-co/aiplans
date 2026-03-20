'use client';

import { TranslationsProvider } from '@/lib/translations';

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
    <TranslationsProvider messages={messages}>
      {children}
    </TranslationsProvider>
  );
}