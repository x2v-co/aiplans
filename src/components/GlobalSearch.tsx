'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, CreditCard, Building2, CornerDownLeft, Search } from 'lucide-react';
import { rankSearch } from '@/lib/search-match';
import { useTranslations } from '@/lib/translations';
import { trackAnalyticsEvent } from '@/lib/analytics';

type SearchIndex = {
  models: Array<{ slug: string; name: string; providerName: string | null; providerSlug: string | null }>;
  plans: Array<{ id: number; name: string; providerName: string; providerSlug: string }>;
  providers: Array<{ slug: string; name: string }>;
};

type ResultKind = 'model' | 'plan' | 'provider';

type Result = {
  kind: ResultKind;
  href: string;
  title: string;
  subtitle?: string;
  score: number;
};

// One fetch per tab lifetime: the palette opens on every page, and the index
// is small (a few hundred lightweight rows). A new deployment invalidates it
// via the /_next/data hashing path; the 30s response covers normal navigation.
let cachedIndex: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

function fetchIndex(): Promise<SearchIndex> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  if (!inflight) {
    inflight = fetch('/api/search-index')
      .then((response) => {
        if (!response.ok) throw new Error(`search-index ${response.status}`);
        return response.json() as Promise<SearchIndex>;
      })
      .then((data) => {
        cachedIndex = data;
        return data;
      })
      .catch((error) => {
        inflight = null;
        throw error;
      });
  }
  return inflight;
}

const LIMITS: Record<ResultKind, number> = { model: 6, plan: 5, provider: 5 };

export default function GlobalSearch({
  locale,
  open,
  onOpenChange,
}: {
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('search');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchIndex | null>(cachedIndex);
  const [loadError, setLoadError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previouslyOpen, setPreviouslyOpen] = useState(open);

  // Reset the palette each time it opens. Adjusting state during render is
  // the React-sanctioned way to react to a prop transition; an effect would
  // flash the previous query on the first opened frame.
  if (open !== previouslyOpen) {
    setPreviouslyOpen(open);
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setLoadError(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!cachedIndex) {
      fetchIndex()
        .then(setIndex)
        .catch(() => setLoadError(true));
    }
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Cmd/Ctrl-K toggles the palette from any page.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!index || q.length === 0) return [];

    const rankedModels = rankSearch(q, index.models, (m) => [m.name, m.slug, m.providerName])
      .slice(0, LIMITS.model)
      .map<Result>(({ item, score }) => ({
        kind: 'model',
        href: `/${locale}/models/${item.slug}`,
        title: item.name,
        subtitle: item.providerName ?? undefined,
        score,
      }));

    const rankedPlans = rankSearch(q, index.plans, (p) => [p.name, p.providerName, p.providerSlug])
      .slice(0, LIMITS.plan)
      .map<Result>(({ item, score }) => ({
        kind: 'plan',
        href: `/${locale}/plans/${item.providerSlug}`,
        title: item.name,
        subtitle: item.providerName,
        score,
      }));

    const rankedProviders = rankSearch(q, index.providers, (p) => [p.name, p.slug])
      .slice(0, LIMITS.provider)
      .map<Result>(({ item, score }) => ({
        kind: 'provider',
        href: `/${locale}/plans/${item.slug}`,
        title: item.name,
        score,
      }));

    return [...rankedModels, ...rankedPlans, ...rankedProviders];
  }, [index, query, locale]);

  useEffect(() => {
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const go = useCallback(
    (result: Result | undefined) => {
      if (!result) return;
      trackAnalyticsEvent('global_search', {
        query_length: Math.min(query.trim().length, 100),
        result_kind: result.kind,
        result_count: results.length,
        locale,
      });
      onOpenChange(false);
      router.push(result.href);
    },
    [query, results.length, locale, onOpenChange, router],
  );

  if (!open) return null;

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onOpenChange(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((value) => (results.length ? (value + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((value) => (results.length ? (value - 1 + results.length) % results.length : 0));
    } else if (event.key === 'Enter' && !composingRef.current) {
      event.preventDefault();
      go(results[activeIndex] ?? results[0]);
    }
  };

  const groups: Array<{ kind: ResultKind; label: string; icon: typeof Cpu }> = [
    { kind: 'model', label: t('models'), icon: Cpu },
    { kind: 'plan', label: t('plans'), icon: CreditCard },
    { kind: 'provider', label: t('providers'), icon: Building2 },
  ];

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('placeholder')}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Search className="h-5 w-5 shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            aria-controls="global-search-results"
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-zinc-400"
          />
        </div>

        <div id="global-search-results" ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {loadError && <div className="px-3 py-6 text-center text-sm text-zinc-500">{t('error')}</div>}
          {!loadError && !index && <div className="px-3 py-6 text-center text-sm text-zinc-500">{t('loading')}</div>}

          {index && query.trim() && results.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">{t('noResults', { query: query.trim() })}</div>
          )}

          {index && !query.trim() && (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">{t('hint')}</div>
          )}

          {groups.map((group) => {
            const groupResults = results.filter((result) => result.kind === group.kind);
            if (groupResults.length === 0) return null;
            const Icon = group.icon;
            return (
              <div key={group.kind} className="mb-1">
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  <Icon className="h-3.5 w-3.5" />
                  {group.label}
                </div>
                {groupResults.map((result) => {
                  flatIndex += 1;
                  const itemIndex = flatIndex;
                  const active = itemIndex === activeIndex;
                  return (
                    <button
                      key={`${result.kind}-${result.href}-${result.title}`}
                      data-index={itemIndex}
                      type="button"
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      onClick={() => go(result)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left ${
                        active ? 'bg-blue-50 dark:bg-zinc-800' : ''
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{result.title}</span>
                        {result.subtitle && (
                          <span className="block truncate text-xs text-zinc-500">{result.subtitle}</span>
                        )}
                      </span>
                      {active && <CornerDownLeft className="h-4 w-4 shrink-0 text-zinc-400" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="hidden items-center gap-4 border-t border-zinc-200 px-4 py-2 text-xs text-zinc-400 sm:flex dark:border-zinc-800">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-sans dark:border-zinc-700">↑↓</kbd>
            {t('navigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-sans dark:border-zinc-700">↵</kbd>
            {t('open')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-300 px-1.5 py-0.5 font-sans dark:border-zinc-700">esc</kbd>
            {t('close')}
          </span>
        </div>
      </div>
    </div>
  );
}
