const TOKEN_LABELS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  chatglm: 'ChatGLM',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  glm: 'GLM',
  gpt: 'GPT',
  grok: 'Grok',
  kimi: 'Kimi',
  llama: 'Llama',
  llm: 'LLM',
  meta: 'Meta',
  minimax: 'MiniMax',
  mistral: 'Mistral',
  mixtral: 'Mixtral',
  openai: 'OpenAI',
  oss: 'OSS',
  qwen: 'Qwen',
  vl: 'VL',
  zai: 'Z.ai',
};

function formatToken(token: string): string {
  const lower = token.toLowerCase();
  const mapped = TOKEN_LABELS[lower];
  if (mapped) return mapped;

  const wrapped = lower.match(/^\((.+)\)$/);
  if (wrapped) return `(${formatToken(wrapped[1])})`;

  if (/^\d+(?:\.\d+)?[bt]$/.test(lower)) return lower.toUpperCase();
  if (/^[a-z]\d+[a-z]$/.test(lower)) return lower.toUpperCase();
  if (/^\d/.test(lower)) return token;

  return `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}

/** Turn scraper-style slugs into readable model labels without hiding variants. */
export function formatModelName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  const normalized = trimmed
    .replace(/_/g, '-')
    .replace(/\b(glm|gpt)-(\d+)-(\d+)(?=$|-)/gi, '$1-$2.$3')
    .replace(/\b((?:claude-)?(?:opus|sonnet|haiku))-(\d+)-(\d+)(?=$|-)/gi, '$1-$2.$3')
    .replace(/\b(k\d+)-(\d+)(?=$|-)/gi, '$1.$2');

  return normalized
    .split('-')
    .filter(Boolean)
    .map(formatToken)
    .join(' ');
}
