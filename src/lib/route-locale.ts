export function isSupportedLocale(value: string): value is 'en' | 'zh' {
  return value === 'en' || value === 'zh';
}

/** Reserved route segments, not arbitrary prefixes (api-foo/go2 are pages). */
export function isInfrastructurePath(pathname: string): boolean {
  return /^\/(?:api|v1|go|_next)(?:\/|$)/.test(pathname);
}
