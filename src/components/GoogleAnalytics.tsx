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
import { classifyTrackedLink, guideSlugFromPath, trackAnalyticsEvent, trackFunnelEvent } from '@/lib/analytics';
import { localeFromPath, readCouponOutbound, trackCouponClick } from '@/lib/coupon-analytics';
import {
  ANALYTICS_NOT_SET,
  analyticsDay,
  clearFunnelBrowserState,
  markFunnelOutbound,
  readFunnelSession,
  readFunnelVisit,
  readOutboundChannel,
  sanitizeHost,
  tickFunnel,
  writeFunnelSession,
  writeFunnelVisit,
} from '@/lib/funnel-analytics';

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
        clearFunnelBrowserState();
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

    const funnel = tickFunnel({
      pathname,
      search: query ? `?${query}` : '',
      referrer: document.referrer,
      origin: window.location.origin,
      today: analyticsDay(),
      now: Date.now(),
      session: readFunnelSession(),
      visit: readFunnelVisit(),
    });
    writeFunnelSession(funnel.session);
    writeFunnelVisit(funnel.visit);
    for (const event of funnel.events) {
      trackFunnelEvent(event.key, event.params);
    }
  }, [pathname, searchParams, scriptReady]);

  useEffect(() => {
    if (!analyticsAllowed) return;

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const tracked = classifyTrackedLink(anchor.href, window.location.origin, window.location.pathname);
      if (!tracked) return;
      // Attribute clicks made on a guide page to that guide (funnel step 2→3).
      const guideSlug = guideSlugFromPath(window.location.pathname) ?? undefined;
      const position = anchor.dataset.position ? Number(anchor.dataset.position) : undefined;

      if (tracked.kind === 'guide_target') {
        trackAnalyticsEvent('guide_model_click', {
          guide_slug: guideSlug,
          target_type: tracked.targetType,
          target_slug: tracked.targetSlug,
          target_path: tracked.targetPath,
          position,
        });
        return;
      }

      if (tracked.kind === 'outbound') {
        const channel = readOutboundChannel(anchor.dataset);
        const coupon = readCouponOutbound(anchor.dataset);
        const couponParams = coupon.isCoupon
          ? {
              link_source: 'coupon',
              coupon_id: coupon.coupon_id,
              placement: coupon.placement,
              provider_slug: coupon.provider_slug,
            }
          : null;
        trackAnalyticsEvent('outbound_click', {
          link_domain: tracked.domain,
          link_text: anchor.innerText.trim().slice(0, 100),
          link_url: tracked.url,
          guide_slug: guideSlug,
          channel_slug: channel.channel_slug,
          channel_type: channel.channel_type,
          model_slug: channel.model_slug,
          ...(couponParams ?? {}),
        });
        trackFunnelEvent('outboundClick', {
          link_domain: sanitizeHost(tracked.domain) ?? ANALYTICS_NOT_SET,
          channel_slug: channel.channel_slug,
          channel_type: channel.channel_type,
          model_slug: channel.model_slug,
          ...(couponParams ?? {}),
        });
        if (coupon.isCoupon) {
          trackCouponClick({
            couponId: coupon.coupon_id === ANALYTICS_NOT_SET ? null : coupon.coupon_id,
            providerSlug: coupon.provider_slug === ANALYTICS_NOT_SET ? null : coupon.provider_slug,
            channelSlug: coupon.channel_slug === ANALYTICS_NOT_SET ? null : coupon.channel_slug,
            placement: coupon.placement === ANALYTICS_NOT_SET ? null : coupon.placement,
            locale: localeFromPath(window.location.pathname),
            pathname: window.location.pathname,
          });
        }
        markFunnelOutbound();
        return;
      }

      trackAnalyticsEvent('compare_start', {
        compare_type: tracked.compareType,
        target_path: tracked.targetPath,
        guide_slug: guideSlug,
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
