/** Native fixture driver only. The actual-schema adapter does not use this as
 * production authorization. No alternate host, port, name or query overrides. */
export function requireO3TestUrl(value: string | undefined): string {
  if (!value) throw new Error('O3_TEST_DATABASE_URL is required; this driver never skips');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid dedicated o3 test URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '55439'
    || url.search || url.hash || !/^\/dedupe54_test_o3(?:_[a-z0-9_]+)?$/.test(url.pathname)) {
    throw new Error('Only 127.0.0.1:55439/dedupe54_test_o3[_suffix] is allowed');
  }
  return value;
}
