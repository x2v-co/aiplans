const HOST = 'aiplans.dev';
const KEY = 'b1f0d17ebd1d1720cc80f2ede4b03770';
const ORIGIN = `https://${HOST}`;

const RESEARCH_PATHS = [
  '/en/guides',
  '/zh/guides',
  '/en/guides/glm-chatglm-api-pricing',
  '/zh/guides/glm-chatglm-api-pricing',
  '/en/guides/claude-anthropic-pricing',
  '/zh/guides/claude-anthropic-pricing',
  '/en/guides/grok-pricing',
  '/zh/guides/grok-pricing',
  '/en/guides/kimi-api-pricing',
  '/zh/guides/kimi-api-pricing',
  '/en/reports/api-price-index',
  '/zh/reports/api-price-index',
  '/en/api-pricing',
  '/zh/api-pricing',
];

function normalizeUrl(value: string): string {
  const url = new URL(value, ORIGIN);
  if (url.hostname !== HOST) {
    throw new Error(`IndexNow URL must belong to ${HOST}: ${value}`);
  }
  url.hash = '';
  return url.toString();
}

async function main() {
  const requested = process.argv.slice(2);
  const urlList = [...new Set((requested.length > 0 ? requested : RESEARCH_PATHS).map(normalizeUrl))];
  if (urlList.length === 0 || urlList.length > 10_000) {
    throw new Error(`IndexNow requires between 1 and 10,000 URLs; received ${urlList.length}`);
  }

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `${ORIGIN}/${KEY}.txt`,
      urlList,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`IndexNow returned ${response.status}: ${body || response.statusText}`);
  }

  console.log(`IndexNow accepted ${urlList.length} URLs (${response.status}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
