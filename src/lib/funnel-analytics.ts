/**
 * Visit → compare → outbound click → return visit.
 *
 * Pure helpers plus a tiny browser store. Nothing here identifies a person:
 * no account id, no client id we mint, no email, no IP, no full URL.
 * Campaign values are allowlisted tokens. The return-visit note is a day and
 * a session count kept in the browser and deleted when analytics is rejected.
 */

import type { FunnelEventKey } from '@/config/analytics-events';

export const FUNNEL_SESSION_KEY = 'aiplans-funnel-session-v1';
export const FUNNEL_VISIT_KEY = 'aiplans-funnel-visit-v1';
export const ANALYTICS_NOT_SET = '(not set)';
export const ANALYTICS_DIRECT = '(direct)';

const TOKEN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;
const SLUG = /^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/;
const HOST = /^[a-z0-9.-]{1,253}$/;
/** A new tab inside this window continues the session instead of counting a return. */
export const FUNNEL_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CHANNEL_TYPES = new Set(['official', 'cloud', 'aggregator', 'reseller']);
const SEARCH_HOSTS = [
  'google.',
  'bing.com',
  'baidu.com',
  'duckduckgo.com',
  'yahoo.',
  'yandex.',
  'sogou.com',
  'so.com',
  'ecosia.org',
  'naver.com',
];

const MEDIUM_CHANNEL: Record<string, string> = {
  community: 'community',
  outreach: 'outreach',
  social: 'social',
  email: 'email',
  rss: 'rss',
  cpc: 'paid',
  ppc: 'paid',
  paid: 'paid',
  ads: 'paid',
};

export type FunnelEventParams = Record<string, string>;

export type FunnelEventDraft = {
  key: FunnelEventKey;
  params: FunnelEventParams;
};

export type FunnelSessionState = {
  landingPage: string;
  pageGroup: string;
  trafficChannel: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  referrerHost: string;
  compared: string[];
};

export type FunnelVisitState = {
  firstDay: string;
  lastDay: string;
  sessions: number;
  outbound: boolean;
  /** Epoch ms of the last consented page view. Never sent. */
  lastActiveAt: number;
  /** Attribution for the open session so a second tab does not look like a return. Never sent. */
  active: FunnelSessionState | null;
};

export type FunnelTickInput = {
  pathname: string;
  search: string;
  referrer: string;
  origin: string;
  today: string;
  now: number;
  session: FunnelSessionState | null;
  visit: FunnelVisitState | null;
};

export type FunnelTickResult = {
  session: FunnelSessionState;
  visit: FunnelVisitState;
  events: FunnelEventDraft[];
};

export function analyticsDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function scrubToken(value: string | null | undefined, pattern: RegExp, max: number): string | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw || raw.includes('@') || raw.includes('://')) return null;
  const normalized = raw
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/[._-]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, max);
  return pattern.test(normalized) ? normalized : null;
}

/** Campaign token. Dots are folded away so UTM values stay hyphen-slugs. */
export function sanitizeAnalyticsToken(value: string | null | undefined): string | null {
  if (!value) return null;
  return scrubToken(value.trim().toLowerCase().replace(/\./g, '-'), TOKEN, 64);
}

/** Model and provider slugs. Dots stay, because catalog slugs use them. */
export function sanitizeAnalyticsSlug(value: string | null | undefined): string | null {
  return scrubToken(value, SLUG, 80);
}

export function sanitizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const host = value.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!HOST.test(host) || host.includes('..') || !host.includes('.')) return null;
  return host;
}

export function sanitizeChannelType(value: string | null | undefined): string {
  const token = sanitizeAnalyticsToken(value);
  if (!token) return ANALYTICS_NOT_SET;
  if (token === 'producer') return 'official';
  return CHANNEL_TYPES.has(token) ? token : ANALYTICS_NOT_SET;
}

export function pageGroup(pathname: string): string {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  const rest = path.replace(/^\/(?:en|zh)(?=\/|$)/, '') || '/';
  if (rest === '/') return 'home';
  if (rest === '/api-pricing') return 'api-pricing';
  if (rest.startsWith('/models/')) return 'model';
  if (rest.startsWith('/providers/')) return 'provider';
  if (rest === '/compare/models' || rest.startsWith('/compare/models/')) return 'compare-models';
  if (/^\/compare\/plans\/[^/]+/.test(rest)) return 'compare-plan';
  if (rest === '/compare/plans' || rest.startsWith('/compare/plans/')) return 'compare-plans';
  if (rest.startsWith('/compare/')) return 'compare-other';
  if (/^\/guides\/[^/]+/.test(rest)) return 'guide';
  if (rest.startsWith('/coding-agents')) return 'coding-agents';
  return 'other';
}

export function compareContext(pathname: string): { compare_type: string; model_slug: string } | null {
  const group = pageGroup(pathname);
  if (group !== 'compare-models' && group !== 'compare-plans' && group !== 'compare-plan' && group !== 'compare-other') {
    return null;
  }
  const compareType = group === 'compare-models'
    ? 'models'
    : group === 'compare-other'
      ? 'other'
      : 'plans';
  const model = pathname.match(/^\/(?:en|zh)\/compare\/plans\/([^/?#]+)\/?$/);
  return {
    compare_type: compareType,
    model_slug: model ? sanitizeAnalyticsSlug(decodeURIComponent(model[1])) ?? ANALYTICS_NOT_SET : ANALYTICS_NOT_SET,
  };
}

export function readUtm(search: string): {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
} {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const pick = (key: string) => sanitizeAnalyticsToken(params.get(key)) ?? ANALYTICS_NOT_SET;
  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content: pick('utm_content'),
  };
}

export function referrerHost(referrer: string, origin: string): string | null {
  try {
    const url = new URL(referrer);
    const site = new URL(origin);
    if (url.origin === site.origin) return null;
    return sanitizeHost(url.hostname);
  } catch {
    return null;
  }
}

export function trafficChannel(utmMedium: string, utmSource: string, host: string | null): string {
  if (utmMedium !== ANALYTICS_NOT_SET && MEDIUM_CHANNEL[utmMedium]) return MEDIUM_CHANNEL[utmMedium];
  if (utmSource !== ANALYTICS_NOT_SET || utmMedium !== ANALYTICS_NOT_SET) return 'campaign';
  if (!host) return 'direct';
  if (SEARCH_HOSTS.some((needle) => host.includes(needle))) return 'organic';
  return 'referral';
}

export function landingPage(pathname: string): string {
  const path = pathname.split('?')[0] || '/';
  return path.slice(0, 120) || '/';
}

function daysBetween(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export function gapBucket(days: number): string {
  if (days <= 0) return 'same_day';
  if (days === 1) return '1d';
  if (days <= 7) return '2-7d';
  if (days <= 30) return '8-30d';
  return '31d+';
}

export function priorVisitsBucket(priorSessions: number): string {
  if (priorSessions <= 1) return '1';
  if (priorSessions <= 4) return '2-4';
  return '5+';
}

function attributionParams(session: FunnelSessionState): FunnelEventParams {
  return {
    landing_page: session.landingPage,
    page_group: session.pageGroup,
    traffic_channel: session.trafficChannel,
    utm_source: session.utmSource,
    utm_medium: session.utmMedium,
    utm_campaign: session.utmCampaign,
    utm_content: session.utmContent,
    referrer_host: session.referrerHost,
  };
}

function freshSession(input: FunnelTickInput): FunnelSessionState {
  const utm = readUtm(input.search);
  const host = referrerHost(input.referrer, input.origin);
  return {
    landingPage: landingPage(input.pathname),
    pageGroup: pageGroup(input.pathname),
    trafficChannel: trafficChannel(utm.utm_medium, utm.utm_source, host),
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
    utmContent: utm.utm_content,
    referrerHost: host ?? ANALYTICS_DIRECT,
    compared: [],
  };
}

function blankVisit(input: FunnelTickInput, session: FunnelSessionState, outbound: boolean): FunnelVisitState {
  return {
    firstDay: input.today,
    lastDay: input.today,
    sessions: 1,
    outbound,
    lastActiveAt: input.now,
    active: session,
  };
}

export function tickFunnel(input: FunnelTickInput): FunnelTickResult {
  const events: FunnelEventDraft[] = [];
  const group = pageGroup(input.pathname);
  const page = landingPage(input.pathname);
  const resume = input.visit?.active
    && input.now - input.visit.lastActiveAt < FUNNEL_SESSION_TIMEOUT_MS
    ? input.visit.active
    : null;

  let session = input.session ?? resume;
  let visit = input.visit;

  if (!session) {
    session = freshSession(input);
    const priorOutbound = visit?.outbound === true;
    const firstSession = !visit || visit.sessions < 1;
    if (firstSession) {
      visit = {
        ...blankVisit(input, session, priorOutbound),
        firstDay: visit?.firstDay || input.today,
      };
    } else {
      const priorSessions = visit?.sessions ?? 1;
      events.push({
        key: 'returnVisit',
        params: {
          ...attributionParams(session),
          page_group: group,
          gap_bucket: gapBucket(daysBetween(visit?.lastDay || input.today, input.today)),
          prior_visits_bucket: priorVisitsBucket(priorSessions),
          prior_outbound: priorOutbound ? 'yes' : 'no',
        },
      });
      visit = {
        firstDay: visit?.firstDay || input.today,
        lastDay: input.today,
        sessions: Math.min(priorSessions + 1, 50),
        outbound: priorOutbound,
        lastActiveAt: input.now,
        active: session,
      };
    }

    events.unshift({
      key: 'landing',
      params: {
        ...attributionParams(session),
        page_group: group,
      },
    });
  }

  const compare = compareContext(input.pathname);
  if (compare && !session.compared.includes(page)) {
    session = { ...session, compared: [...session.compared, page].slice(-30) };
    events.push({
      key: 'compare',
      params: {
        ...attributionParams(session),
        page_group: group,
        compare_type: compare.compare_type,
        compare_action: 'view',
        model_slug: compare.model_slug,
      },
    });
  }

  const nextVisit: FunnelVisitState = visit
    ? { ...visit, lastActiveAt: input.now, active: session }
    : blankVisit(input, session, false);

  return { session, visit: nextVisit, events };
}

export function outboundChannelDataset(input: {
  channelSlug?: string | null;
  channelType?: string | null;
  modelSlug?: string | null;
}): Record<string, string> {
  const attrs: Record<string, string> = {};
  const slug = sanitizeAnalyticsSlug(input.channelSlug);
  const model = sanitizeAnalyticsSlug(input.modelSlug);
  const type = sanitizeChannelType(input.channelType);
  if (slug) attrs['data-channel-slug'] = slug;
  if (type !== ANALYTICS_NOT_SET) attrs['data-channel-type'] = type;
  if (model) attrs['data-model-slug'] = model;
  return attrs;
}

export function readOutboundChannel(dataset: {
  channelSlug?: string;
  channelType?: string;
  modelSlug?: string;
}): { channel_slug: string; channel_type: string; model_slug: string } {
  return {
    channel_slug: sanitizeAnalyticsSlug(dataset.channelSlug) ?? ANALYTICS_NOT_SET,
    channel_type: sanitizeChannelType(dataset.channelType),
    model_slug: sanitizeAnalyticsSlug(dataset.modelSlug) ?? ANALYTICS_NOT_SET,
  };
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

export function readFunnelSession(): FunnelSessionState | null {
  if (!canUseStorage()) return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(FUNNEL_SESSION_KEY) || 'null') as FunnelSessionState | null;
    if (!parsed || typeof parsed.landingPage !== 'string' || !Array.isArray(parsed.compared)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeFunnelSession(session: FunnelSessionState) {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private mode or a full store: skip persistence, still send the event.
  }
}

export function readFunnelVisit(): FunnelVisitState | null {
  if (!canUseStorage()) return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FUNNEL_VISIT_KEY) || 'null') as FunnelVisitState | null;
    if (!parsed || typeof parsed.firstDay !== 'string' || typeof parsed.sessions !== 'number') return null;
    return {
      firstDay: parsed.firstDay,
      lastDay: typeof parsed.lastDay === 'string' ? parsed.lastDay : parsed.firstDay,
      sessions: parsed.sessions,
      outbound: parsed.outbound === true,
      lastActiveAt: typeof parsed.lastActiveAt === 'number' ? parsed.lastActiveAt : 0,
      active: parsed.active && typeof parsed.active.landingPage === 'string' ? parsed.active : null,
    };
  } catch {
    return null;
  }
}

export function writeFunnelVisit(visit: FunnelVisitState) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(FUNNEL_VISIT_KEY, JSON.stringify(visit));
  } catch {
    // Same as the session store: measurement continues without the return note.
  }
}

export function readFunnelAttribution(): FunnelEventParams {
  const session = readFunnelSession();
  if (!session) {
    return {
      landing_page: ANALYTICS_NOT_SET,
      traffic_channel: ANALYTICS_NOT_SET,
      utm_source: ANALYTICS_NOT_SET,
      utm_medium: ANALYTICS_NOT_SET,
      utm_campaign: ANALYTICS_NOT_SET,
      utm_content: ANALYTICS_NOT_SET,
      referrer_host: ANALYTICS_NOT_SET,
    };
  }
  return {
    landing_page: session.landingPage,
    traffic_channel: session.trafficChannel,
    utm_source: session.utmSource,
    utm_medium: session.utmMedium,
    utm_campaign: session.utmCampaign,
    utm_content: session.utmContent,
    referrer_host: session.referrerHost,
  };
}

/** Remember that this browser followed an outbound link. No identifier is stored. */
export function markFunnelOutbound() {
  const today = analyticsDay();
  const current = readFunnelVisit();
  writeFunnelVisit({
    firstDay: current?.firstDay || today,
    lastDay: current?.lastDay || today,
    sessions: current?.sessions ?? 0,
    outbound: true,
    lastActiveAt: current?.lastActiveAt ?? Date.now(),
    active: current?.active ?? null,
  });
}

export function clearFunnelBrowserState() {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(FUNNEL_SESSION_KEY);
    window.localStorage.removeItem(FUNNEL_VISIT_KEY);
  } catch {
    // Nothing to clear.
  }
}
