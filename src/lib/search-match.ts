/**
 * Client-safe fuzzy matcher shared by the header search palette, the
 * /compare/plans index filter and /api-pricing.
 *
 * A plain substring test made searching "chatgpt" return nothing: rows are
 * named "GPT-4o" / "OpenAI o3" and the provider is "OpenAI", so brand
 * aliases and punctuation-/space-insensitive comparison live here. Chinese
 * brand names (智谱, 月之暗面, 通义千问 …) resolve to the same expansions.
 */

// Query tokens are AND-ed; a token matches a field when ANY of its
// expansions appears there. The token itself is always tried first so that
// direct hits outrank alias hits.
const ALIASES: Record<string, readonly string[]> = {
  chatgpt: ['openai', 'gpt'],
  openai: ['chatgpt'],
  gpt: ['chatgpt', 'openai'],
  claude: ['anthropic'],
  anthropic: ['claude'],
  gemini: ['google'],
  google: ['gemini'],
  bard: ['gemini', 'google'],
  kimi: ['moonshot'],
  moonshot: ['kimi'],
  glm: ['zhipu', 'chatglm'],
  chatglm: ['glm', 'zhipu'],
  zhipu: ['glm', 'chatglm'],
  qwen: ['alibaba', 'tongyi'],
  alibaba: ['qwen', 'tongyi'],
  tongyi: ['qwen', 'alibaba'],
  hunyuan: ['tencent'],
  tencent: ['hunyuan'],
  ernie: ['baidu', 'wenxin'],
  baidu: ['ernie', 'wenxin'],
  doubao: ['volcengine', 'bytedance'],
  volcengine: ['doubao', 'bytedance'],
  bytedance: ['doubao', 'volcengine'],
  grok: ['xai'],
  xai: ['grok'],
  llama: ['meta'],
  meta: ['llama'],
  mixtral: ['mistral'],
  spark: ['iflytek'],
  iflytek: ['spark'],
  step: ['stepfun'],
  stepfun: ['step'],
  copilot: ['github'],
  // Chinese brand names
  智谱: ['glm', 'zhipu', 'chatglm'],
  月之暗面: ['kimi', 'moonshot'],
  通义千问: ['qwen'],
  通义: ['qwen'],
  千问: ['qwen'],
  阿里巴巴: ['qwen', 'alibaba'],
  阿里: ['qwen', 'alibaba'],
  腾讯: ['hunyuan', 'tencent'],
  混元: ['hunyuan'],
  百度: ['ernie', 'baidu'],
  文心一言: ['ernie'],
  文心: ['ernie'],
  字节跳动: ['doubao'],
  字节: ['doubao'],
  火山引擎: ['volcengine'],
  火山: ['volcengine', 'doubao'],
  豆包: ['doubao'],
  深度求索: ['deepseek'],
  讯飞: ['spark', 'iflytek'],
  星火: ['spark'],
  阶跃星辰: ['step', 'stepfun'],
  阶跃: ['step', 'stepfun'],
};

const TOKEN_RE = /[\p{Script=Han}]+|[a-z0-9]+(?:\.[a-z0-9]+)*/gu;

function tokenize(value: string): string[] {
  return value.toLowerCase().match(TOKEN_RE) ?? [];
}

// Lowercased text with every non-letter/non-digit (incl. spaces, hyphens,
// underscores) removed, so "gpt-4o" / "gpt_4o" / "gpt4o" all compare equal.
function compact(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function expansionsFor(token: string): string[] {
  return [token, ...(ALIASES[token] ?? [])];
}

// Best score of one (already expanded) token against one field.
// 100 exact · 85 prefix · 70 word-boundary · 45 loose substring · 0 no match
function scoreTokenInField(token: string, rawField: string, aliasHit: boolean): number {
  const field = rawField.toLowerCase();
  const needle = compact(token);
  if (!needle) return 0;

  const haystack = compact(field);
  let score = 0;
  if (haystack === needle) score = 100;
  else if (haystack.startsWith(needle)) score = 85;
  else if (/^\p{Script=Han}/u.test(token)) {
    // Han runs carry no word boundaries; substring is a strong signal.
    if (haystack.includes(needle)) score = 75;
  } else if (new RegExp(`(^|[^a-z0-9])${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(field)) {
    score = 70;
  } else if (haystack.includes(needle)) {
    score = 45;
  }

  if (score && aliasHit) score -= 20;
  return score;
}

function scoreToken(token: string, fields: string[]): number {
  let best = 0;
  for (const expansion of expansionsFor(token)) {
    const aliasHit = expansion !== token;
    for (const field of fields) {
      if (!field) continue;
      best = Math.max(best, scoreTokenInField(expansion, field, aliasHit));
    }
  }
  return best;
}

/**
 * Higher = better match, -1 = no match. Every query token must be found in
 * at least one of the item's searchable fields (tokens may hit different
 * fields, so "openai glm"-style cross-field queries still work).
 */
export function scoreSearch(query: string, fields: ReadonlyArray<string | null | undefined>): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return -1;

  const haystacks = fields.filter((value): value is string => Boolean(value));
  if (haystacks.length === 0) return -1;

  let total = 0;
  for (const token of tokens) {
    const best = scoreToken(token, haystacks);
    if (best === 0) return -1;
    total += best;
  }
  return total;
}

export function matchesSearch(query: string, fields: ReadonlyArray<string | null | undefined>): boolean {
  return scoreSearch(query, fields) >= 0;
}

export type RankedItem<T> = { item: T; score: number };

/** Rank pre-filtered candidates; callers slice the page size they want. */
export function rankSearch<T>(
  query: string,
  items: ReadonlyArray<T>,
  getFields: (item: T) => ReadonlyArray<string | null | undefined>,
): Array<RankedItem<T>> {
  return items
    .map((item) => ({ item, score: scoreSearch(query, getFields(item)) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);
}
