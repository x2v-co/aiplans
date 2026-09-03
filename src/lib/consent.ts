export const CONSENT_STORAGE_KEY = 'aiplans-consent-v1';
export const CONSENT_CHANGE_EVENT = 'aiplans:consent-change';
export const CONSENT_OPEN_EVENT = 'aiplans:consent-open';

export type ConsentPreferences = {
  analytics: boolean;
  advertising: boolean;
  updatedAt: string;
};

export function readConsent(): ConsentPreferences | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = JSON.parse(window.localStorage.getItem(CONSENT_STORAGE_KEY) || 'null');
    if (
      value &&
      typeof value.analytics === 'boolean' &&
      typeof value.advertising === 'boolean'
    ) {
      return value as ConsentPreferences;
    }
  } catch {
    // A malformed or unavailable preference is treated as no consent.
  }

  return null;
}

export function getConsentStorageSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  const storedValue = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return storedValue && readConsent() ? storedValue : null;
}

export function getAnalyticsConsentSnapshot(): boolean {
  return readConsent()?.analytics === true;
}

export function subscribeToConsent(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_STORAGE_KEY) onStoreChange();
  };

  window.addEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', handleStorage);
  };
}

export function writeConsent(preferences: Omit<ConsentPreferences, 'updatedAt'>) {
  const value: ConsentPreferences = {
    ...preferences,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));

  if (!preferences.analytics) {
    const hostname = window.location.hostname;
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0]?.trim();
      if (!name?.startsWith('_ga')) return;
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      if (hostname.includes('.')) {
        document.cookie = `${name}=; Max-Age=0; path=/; domain=.${hostname}; SameSite=Lax`;
      }
    });
  }

  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: value }));
}
