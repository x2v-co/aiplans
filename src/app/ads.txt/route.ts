const ADSENSE_PUBLISHER_ID = process.env.GOOGLE_ADSENSE_PUBLISHER_ID?.trim();
const PUBLISHER_ID_PATTERN = /^pub-\d{16}$/;

export function GET() {
  if (!ADSENSE_PUBLISHER_ID || !PUBLISHER_ID_PATTERN.test(ADSENSE_PUBLISHER_ID)) {
    return new Response('ads.txt is not configured\n', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(`google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
