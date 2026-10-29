/** Moonshot/Kimi token pricing from the official Kimi pricing tables. */
import { normalizeModelName } from '../utils/validator';
import { parseNextFlight } from '../utils/artificial-analysis';
import { PlaywrightScraper, type PriceData, type ScraperResult } from './lib/playwright-scraper';
import { runScraperCli } from './lib/cli-exit';

const PRICING_PAGE = 'https://platform.kimi.com/docs/pricing/chat';


/**
 * The model cell can carry badges/tooltips next to the id, e.g. during the
 * Kimi K3 launch promo: `kimi-k3<Badge>Promo</Badge>` plus "Promotion valid
 * until October 11, 2026". Keep only model ids; anything that is not a plain
 * id is dropped (and the identity guard rejects it downstream).
 *
 * One cell can also list several ids with no separator
 * (`kimi-k2-thinkingkimi-k2-instruct-0905…`). The old `^(kimi|moonshot)[a-z0-9.-]*`
 * match consumed that whole string as a single slug. The compare sitemap then
 * published it, and the page returned 200. Split on each new family prefix.
 */
export function parseKimiModelIds(raw: string): string[] {
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const ids: string[] = [];
  for (const token of text.split(/[^a-z0-9.-]+/)) {
    if (!token) continue;
    for (const part of token.split(/(?<=[a-z0-9])(?=(?:kimi|moonshot)(?:-|\d))/)) {
      const id = part.replace(/(?:-?(?:promo|promotion|new|hot|limited))+$/i, '');
      if (/^(?:kimi|moonshot)[a-z0-9.-]*[a-z0-9]$/.test(id)) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

export function parseKimiModelCell(raw: string): string | null {
  return parseKimiModelIds(raw)[0] ?? null;
}

export interface KimiPricingTable {
  headers: string[];
  rows: string[][];
  contextText: string;
}

/** Fail the full-catalog scrape on any incomplete table/row: a partial result
 * would otherwise retire valid Moonshot channels in index-dynamic. */
export function parseKimiPricingTables(tables: KimiPricingTable[]): PriceData[] {
  const prices: PriceData[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    const headers = table.headers.map(value => value.trim());
    const modelIndex = headers.findIndex(value => /^(名称|模型)$/.test(value));
    const inputIndex = headers.indexOf('输入');
    const outputIndex = headers.indexOf('输出');
    const cacheIndex = headers.indexOf('缓存命中');
    if ([modelIndex, inputIndex, outputIndex, cacheIndex].some(index => index < 0)) {
      throw new Error('Unrecognized Kimi pricing table headers');
    }
    const contextMatch = table.contextText.match(/([\d,]+)\s*tokens?\s*上下文窗口/i);
    const contextWindow = contextMatch ? Number(contextMatch[1].replace(/,/g, '')) : 0;
    if (!contextWindow || !table.rows.length) throw new Error('Incomplete Kimi pricing table');
    for (const cells of table.rows) {
      const modelIds = parseKimiModelIds(cells[modelIndex] ?? '');
      if (modelIds.length !== 1) throw new Error('Invalid Kimi pricing model cell');
      const modelName = normalizeModelName(modelIds[0]).toLowerCase();
      const readPrice = (index: number): number => {
        // Require CNY and per-million units; never reinterpret cache-write TTLs
        // or a changed currency/unit as a token price.
        const match = cells[index]?.trim().match(/^[¥￥]\s*(\d+(?:\.\d+)?)\s*\/\s*MTok$/i);
        if (!match) throw new Error(`Invalid Kimi price for ${modelName}: ${headers[index]}`);
        return Number(match[1]);
      };
      const input = readPrice(inputIndex);
      const output = readPrice(outputIndex);
      const cached = readPrice(cacheIndex);
      if (output < input || cached > input || seen.has(modelName)) {
        throw new Error(`Inconsistent Kimi pricing row: ${modelName}`);
      }
      prices.push({ modelName, inputPricePer1M: input, outputPricePer1M: output,
        cachedInputPricePer1M: cached, contextWindow, isAvailable: true, currency: 'CNY' });
      seen.add(modelName);
    }
  }
  if (!prices.length) throw new Error('No Moonshot token pricing rows found');
  return prices;
}

/**
 * Index just past the bracket/brace/paren that closes the one at `start`.
 * Skips JS string and template literals; refuses `${…}` interpolation so a
 * computed cell can never be read as a literal price.
 */
function closeOf(source: string, start: number): number {
  const pairs: Record<string, string> = { '[': ']', '{': '}', '(': ')' };
  const stack: string[] = [];
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '`' || char === '"' || char === "'") {
      for (index += 1; index < source.length && source[index] !== char; index += 1) {
        if (source[index] === '\\') index += 1;
        else if (char === '`' && source[index] === '$' && source[index + 1] === '{') {
          throw new Error('Unsupported template interpolation in Kimi pricing table');
        }
      }
      continue;
    }
    if (pairs[char]) stack.push(pairs[char]);
    else if (char === ']' || char === '}' || char === ')') {
      if (stack.pop() !== char) throw new Error('Unbalanced Kimi pricing table source');
      if (stack.length === 0) return index + 1;
    }
  }
  throw new Error('Unterminated Kimi pricing table source');
}

/** Split the inside of `[a,b,…]` at top-level commas. */
function topLevelItems(list: string): string[] {
  const items: string[] = [];
  let index = 1;
  while (index < list.length - 1) {
    const char = list[index];
    if (char === ',' || /\s/.test(char)) { index += 1; continue; }
    let end = index;
    while (end < list.length - 1 && list[end] !== ',') {
      end = '[{(`"\''.includes(list[end]) ? (/[`"']/.test(list[end]) ? closeString(list, end) : closeOf(list, end)) : end + 1;
    }
    items.push(list.slice(index, end));
    index = end + 1;
  }
  return items;
}

function closeString(source: string, start: number): number {
  const quote = source[start];
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') index += 1;
    else if (source[index] === quote) return index + 1;
  }
  throw new Error('Unterminated string in Kimi pricing table source');
}

const literal = (text: string): string => text.slice(1, -1).replace(/\\(.)/g, '$1');

/** Text content of a compiled MDX cell: a bare literal, or every `children:` literal. */
function cellText(cell: string): string {
  if (cell.startsWith('`')) return literal(cell);
  return [...cell.matchAll(/children:(`(?:[^`\\]|\\.)*`)/g)].map(match => literal(match[1])).join('');
}

/**
 * Read the pricing tables straight from the server-rendered HTML. Mintlify
 * ships the page as compiled MDX inside the Next.js flight payload; the
 * DocTable props carry `columns:[{title:…}]` and `rows:[[…]]` with the same
 * strings the browser later renders. This needs no browser, so a slow
 * client-side hydration (the 2026-10-21→29 production timeouts on
 * `table tbody tr`) cannot fail the scrape.
 */
function tablesInModule(source: string): KimiPricingTable[] | null {
  const tables: KimiPricingTable[] = [];
  const marker = '_jsx(DocTable,{';
  let previousEnd = 0;
  for (let start = source.indexOf(marker); start !== -1; start = source.indexOf(marker, start + 1)) {
    const propsStart = start + marker.length - 1;
    const propsEnd = closeOf(source, propsStart);
    const props = source.slice(propsStart, propsEnd);
    const columnsAt = props.indexOf('columns:[');
    const rowsAt = props.indexOf('rows:[');
    // Mintlify also ships a props-stripped copy of the page (DocTable=()=>null).
    if (columnsAt < 0 || rowsAt < 0) return null;
    const columns = props.slice(columnsAt + 8, closeOf(props, columnsAt + 8));
    const rows = props.slice(rowsAt + 5, closeOf(props, rowsAt + 5));
    const headers = topLevelItems(columns).map(column => {
      const plain = column.match(/^\{title:(`(?:[^`\\]|\\.)*`)/);
      if (plain) return literal(plain[1]);
      const titleEnd = column.search(/,width:|\}$/);
      return cellText(column.slice(0, titleEnd < 0 ? undefined : titleEnd));
    });
    // Section copy between the last heading and this table (e.g. "K3 系列模型均支持
    // 1,048,576 tokens 上下文窗口。"); never reach back past the previous table.
    const before = source.slice(previousEnd, start);
    const headingAt = Math.max(before.lastIndexOf('_jsx(Heading,{level:`2`'), before.lastIndexOf('_jsx(Heading,{level:`3`'));
    const section = headingAt >= 0 ? before.slice(headingAt) : before;
    const contextText = [...section.matchAll(/`((?:[^`\\]|\\.)*)`/g)].map(match => match[1]).join(' ');
    tables.push({
      contextText,
      headers,
      rows: topLevelItems(rows).map(row => topLevelItems(row).map(cellText)),
    });
    previousEnd = propsEnd;
  }
  return tables.length ? tables : null;
}

/**
 * The flight payload can carry several compiled copies of the page; use the
 * ones whose every DocTable has columns and rows, and require them to agree.
 */
export function extractKimiTablesFromMdx(source: string): KimiPricingTable[] {
  const starts = [...source.matchAll(/const DocTable=/g)].map(match => match.index);
  const modules = starts.length
    ? starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length))
    : [source];
  const complete = modules.map(tablesInModule).filter((tables): tables is KimiPricingTable[] => tables !== null);
  if (!complete.length) throw new Error('No complete Kimi DocTable set (columns/rows) in pricing HTML');
  const first = JSON.stringify(complete[0]);
  if (complete.some(tables => JSON.stringify(tables) !== first)) {
    throw new Error('Kimi pricing HTML carries conflicting DocTable copies');
  }
  return complete[0];
}

export function parseKimiPricingHtml(html: string): PriceData[] {
  let flight: string;
  try {
    flight = parseNextFlight(html);
  } catch {
    throw new Error('No Next.js flight payload in Kimi pricing HTML');
  }
  const tables = extractKimiTablesFromMdx(flight);
  if (!tables.length) throw new Error('No DocTable found in Kimi pricing HTML');
  return parseKimiPricingTables(tables);
}

/**
 * Per-request timeout for both the static HTML fetch and the rendered fallback.
 * The production host's route to platform.kimi.com is slow and lossy (10-29:
 * 163KB of 301KB in 30s), so the old 30s budget failed both paths. Override with
 * MOONSHOT_FETCH_TIMEOUT_MS.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 90_000;
export const STATIC_FETCH_ATTEMPTS = 3;
const STATIC_RETRY_BASE_DELAY_MS = 2_000;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function resolveFetchTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MOONSHOT_FETCH_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_FETCH_TIMEOUT_MS;
  const value = Math.round(Number(raw));
  // Node timers overflow above this limit and otherwise fire after just 1ms.
  if (!Number.isFinite(value) || value < 1 || value > 2 ** 31 - 1) {
    console.warn(`⚠️ Moonshot: ignoring invalid MOONSHOT_FETCH_TIMEOUT_MS=${JSON.stringify(raw)}`);
    return DEFAULT_FETCH_TIMEOUT_MS;
  }
  return value;
}

/** Network-level failures worth retrying; a parse error or HTTP 4xx is not. */
class RetryableFetchError extends Error {}

export interface StaticFetchOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  attempts?: number;
  baseDelayMs?: number;
}

async function fetchKimiPricingPage(fetchImpl: typeof fetch, timeoutMs: number): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(PRICING_PAGE, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new RetryableFetchError(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
  if (!response.ok) {
    // Release the connection before retrying or switching to Playwright.
    await response.body?.cancel().catch(() => undefined);
    const message = `Kimi pricing page returned HTTP ${response.status}`;
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      throw new RetryableFetchError(message);
    }
    throw new Error(message);
  }
  try {
    // The body download is what stalls on the slow route; it shares the abort signal.
    return await response.text();
  } catch (error) {
    throw new RetryableFetchError(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
}

/**
 * Static HTML read with exponential backoff (2s, 4s, …) on network errors,
 * timeouts, 429 and 5xx. Parsing is deterministic, so a parse failure is not retried.
 */
export async function fetchKimiPricingHtml(options: StaticFetchOptions = {}): Promise<PriceData[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const timeoutMs = options.timeoutMs ?? resolveFetchTimeoutMs();
  const requestedAttempts = options.attempts ?? STATIC_FETCH_ATTEMPTS;
  const attempts = Number.isFinite(requestedAttempts)
    ? Math.min(STATIC_FETCH_ATTEMPTS, Math.max(1, Math.floor(requestedAttempts)))
    : STATIC_FETCH_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? STATIC_RETRY_BASE_DELAY_MS;
  const failures: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let html: string;
    try {
      html = await fetchKimiPricingPage(fetchImpl, timeoutMs);
    } catch (error) {
      if (!(error instanceof RetryableFetchError)) throw error;
      failures.push(`attempt ${attempt}: ${error.message}`);
      if (attempt === attempts) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`⚠️ Moonshot: static HTML fetch failed (${error.message}); retry ${attempt + 1}/${attempts} in ${delay}ms`);
      await sleep(delay);
      continue;
    }
    return parseKimiPricingHtml(html);
  }
  throw new Error(`Kimi pricing page fetch failed after ${attempts} attempts (timeout ${timeoutMs}ms each): ${failures.join('; ')}`);
}

export class MoonshotScraper extends PlaywrightScraper {
  constructor(timeoutMs = resolveFetchTimeoutMs()) {
    super({ timeout: timeoutMs });
  }

  getSourceName(): string { return 'Moonshot'; }
  getSourceUrl(): string { return PRICING_PAGE; }

  async scrape(): Promise<ScraperResult> {
    // Mintlify's Markdown now contains empty tables. Read the rendered tables,
    // including the leaf header row beneath the grouped cache/token headings.
    try {
      await this.navigate(PRICING_PAGE, 'table tbody tr');
      await this.page!.waitForFunction(() => {
        const tables = [...document.querySelectorAll('table')];
        return tables.length > 0 && tables.every(table => table.querySelector('tbody tr'));
      });
    } catch (error) {
      // Say what the page looked like when the wait gave up (keeps the original
      // message first so the runner's transient-retry regex still matches).
      const state = await this.page!.evaluate(() => ({
        url: location.href,
        title: document.title,
        tables: document.querySelectorAll('table').length,
        rows: document.querySelectorAll('table tbody tr').length,
      })).catch(() => null);
      const detail = state ? ` [url=${state.url} title=${JSON.stringify(state.title)} tables=${state.tables} rows=${state.rows}]` : '';
      throw new Error(`${error instanceof Error ? error.message.split('\n')[0] : String(error)}${detail}`);
    }
    const tables = await this.page!.evaluate(() => {
      let heading: Element | null = null;
      const result: KimiPricingTable[] = [];
      for (const element of document.querySelectorAll('h2, h3, table')) {
        if (element.closest('table') !== element && element.closest('table')) continue;
        if (/^H[23]$/.test(element.tagName)) heading = element;
        if (element.tagName !== 'TABLE') continue;
        const headerRows = element.querySelectorAll('thead tr');
        const header = headerRows[headerRows.length - 1];
        const range = document.createRange();
        if (heading) range.setStartAfter(heading);
        range.setEndBefore(element);
        const contextText = heading ? range.toString() : '';
        result.push({ contextText,
          headers: header ? [...header.querySelectorAll('th, td')].map(cell => cell.textContent ?? '') : [],
          rows: [...element.querySelectorAll('tbody tr')].map(row =>
            [...row.querySelectorAll('th, td')].map(cell => cell.textContent ?? '')),
        });
      }
      return result;
    });
    return { source: this.getSourceName(), success: true, prices: parseKimiPricingTables(tables) };
  }
}

/**
 * Static HTML first (up to three requests, no browser); the rendered page is only a
 * fallback. Both must produce a complete table set or the run fails, so a
 * full-catalog scrape never retires Moonshot channels on a partial read.
 */
export async function scrapeMoonshotDynamic(): Promise<ScraperResult> {
  let htmlError: string;
  try {
    const prices = await fetchKimiPricingHtml();
    console.log(`Moonshot: ${prices.length} prices from server-rendered HTML`);
    return {
      source: 'Moonshot', success: true, prices,
      metadata: { isRealTime: true, confidence: 'high', sourceUrl: PRICING_PAGE, lastVerified: new Date() },
    };
  } catch (error) {
    htmlError = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Moonshot: static HTML read failed (${htmlError}); falling back to the rendered page`);
  }
  const result = await new MoonshotScraper().run();
  if (!result.success) result.errors = [...(result.errors ?? []), `static HTML: ${htmlError}`];
  return result;
}

if (require.main === module) {
  void runScraperCli(scrapeMoonshotDynamic, result => console.log(JSON.stringify(result, null, 2)));
}
