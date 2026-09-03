'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  CONSENT_CHANGE_EVENT,
  type ConsentPreferences,
  getAnalyticsConsentSnapshot,
  subscribeToConsent,
} from '@/lib/consent';
import { classifyTrackedLink, trackAnalyticsEvent } from '@/lib/analytics';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function trackPageView(path: string) {
  if (!GA_ID || typeof window === 'undefined') return;

  window.gtag?.('event', 'page_view', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: path,
    send_to: GA_ID,
  });
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const analyticsAllowed = useSyncExternalStore(
    subscribeToConsent,
    getAnalyticsConsentSnapshot,
    () => false,
  );
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    const handleConsent = (event: Event) => {
      const preferences = (event as CustomEvent<ConsentPreferences>).detail;
      if (!preferences.analytics) {
        setScriptReady(false);
        window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      }
    };

    window.addEventListener(CONSENT_CHANGE_EVENT, handleConsent);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, handleConsent);
  }, []);

  useEffect(() => {
    if (!scriptReady || !pathname) return;
    const query = searchParams?.toString();
    trackPageView(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams, scriptReady]);

  useEffect(() => {
    if (!analyticsAllowed) return;

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const tracked = classifyTrackedLink(anchor.href, window.location.origin);
      if (!tracked) return;

      if (tracked.kind === 'outbound') {
        trackAnalyticsEvent('outbound_click', {
          link_domain: tracked.domain,
          link_text: anchor.innerText.trim().slice(0, 100),
          link_url: tracked.url,
        });
        return;
      }

      trackAnalyticsEvent('compare_start', {
        compare_type: tracked.compareType,
        target_path: tracked.targetPath,
      });
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [analyticsAllowed]);

  if (!GA_ID || !analyticsAllowed) return null;

  return (
    <>
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            window.gtag = function(){window.dataLayer.push(arguments);};
            window.gtag('js', new Date());
            window.gtag('consent', 'default', { analytics_storage: 'granted' });
            window.gtag('config', '${GA_ID}', { send_page_view: false, anonymize_ip: true });
          `,
        }}
      />
      <Script
        id="google-analytics-script"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
        onReady={() => setScriptReady(true)}
      />
    </>
  );
}
