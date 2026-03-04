import { createContext, useContext } from 'react';

type Messages = Record<string, any>;

const TranslationsContext = createContext<Messages>({});

export function TranslationsProvider({
  children,
  messages
}: {
  children: React.ReactNode;
  messages: Messages;
}) {
  return (
    <TranslationsContext.Provider value={messages}>
      {children}
    </TranslationsContext.Provider>
  );
}

export function useTranslations(namespace?: string) {
  const messages = useContext(TranslationsContext);

  return (key: string, params?: Record<string, any>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    const keys = fullKey.split('.');
    let value: any = messages;

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value === 'string' && params) {
      return value.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
    }

    return value || fullKey;
  };
}
