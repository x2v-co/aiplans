'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CONSENT_OPEN_EVENT,
  getConsentStorageSnapshot,
  readConsent,
  subscribeToConsent,
  writeConsent,
} from '@/lib/consent';

export default function ConsentManager({ locale }: { locale: string }) {
  const isZh = locale === 'zh';
  const storedConsent = useSyncExternalStore(
    subscribeToConsent,
    getConsentStorageSnapshot,
    () => null,
  );
  const [forceOpen, setForceOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const openPreferences = () => {
      const current = readConsent();
      setAnalytics(current?.analytics ?? false);
      setAdvertising(current?.advertising ?? false);
      setCustomizing(true);
      setForceOpen(true);
    };

    window.addEventListener(CONSENT_OPEN_EVENT, openPreferences);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, openPreferences);
  }, []);

  const save = (nextAnalytics: boolean, nextAdvertising: boolean) => {
    writeConsent({ analytics: nextAnalytics, advertising: nextAdvertising });
    setAnalytics(nextAnalytics);
    setAdvertising(nextAdvertising);
    setForceOpen(false);
    setCustomizing(false);
  };

  if (storedConsent !== null && !forceOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:bg-zinc-950">
      <div
        className="container mx-auto max-w-5xl px-4 py-5"
        role="dialog"
        aria-modal="false"
        aria-labelledby="consent-title"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <h2 id="consent-title" className="text-base font-semibold">
              {isZh ? '隐私与 Cookie 设置' : 'Privacy and cookie settings'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {isZh
                ? '必要存储用于保存语言和隐私偏好。经你同意后，我们才会启用分析；广告存储目前不会加载，并为将来的广告选择预留。'
                : 'Essential storage keeps your language and privacy choices. Analytics runs only with your consent; advertising storage is not currently loaded and is reserved for a future advertising choice.'}{' '}
              <Link href={`/${locale}/privacy`} className="font-medium text-blue-600 hover:underline">
                {isZh ? '查看隐私政策' : 'Read the privacy policy'}
              </Link>
            </p>

            {customizing && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox checked disabled aria-label={isZh ? '必要存储，始终启用' : 'Essential storage, always on'} />
                  <span>
                    <span className="block text-sm font-medium">{isZh ? '必要' : 'Essential'}</span>
                    <span className="block text-xs text-zinc-500">{isZh ? '始终启用' : 'Always on'}</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <Checkbox checked={analytics} onCheckedChange={(value) => setAnalytics(value === true)} />
                  <span>
                    <span className="block text-sm font-medium">{isZh ? '分析' : 'Analytics'}</span>
                    <span className="block text-xs text-zinc-500">Google Analytics</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                  <Checkbox checked={advertising} onCheckedChange={(value) => setAdvertising(value === true)} />
                  <span>
                    <span className="block text-sm font-medium">{isZh ? '广告' : 'Advertising'}</span>
                    <span className="block text-xs text-zinc-500">{isZh ? '目前未启用' : 'Not active yet'}</span>
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="flex min-w-fit flex-wrap gap-2 md:justify-end">
            {customizing ? (
              <Button onClick={() => save(analytics, advertising)}>
                {isZh ? '保存选择' : 'Save choices'}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCustomizing(true)}>
                  {isZh ? '自定义' : 'Customize'}
                </Button>
                <Button variant="outline" onClick={() => save(false, false)}>
                  {isZh ? '仅必要' : 'Essential only'}
                </Button>
                <Button onClick={() => save(true, true)}>
                  {isZh ? '全部接受' : 'Accept all'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
