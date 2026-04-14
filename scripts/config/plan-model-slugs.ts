export const PROVIDER_PLAN_MODEL_SLUGS: Record<string, Record<string, string[]>> = {
  openai: {
    'chatgpt-free': ['gpt-4o-mini'],
    'chatgpt-plus': ['gpt-4o', 'gpt-4o-mini'],
    'chatgpt-team': ['gpt-4o', 'gpt-4o-mini', 'o4', 'o4-mini-high', 'gpt-4-turbo', 'gpt-5.2-high'],
    'chatgpt-enterprise': ['gpt-4o', 'gpt-4o-mini', 'o4', 'o4-mini-high', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-5.2-high', 'gpt-5.2'],
    'chatgpt-pro': ['o4', 'o4-mini-high', 'gpt-4o', 'gpt-4o-mini', 'gpt-5.2-high', 'gpt-5.2', 'o3', 'o3-pro'],
  },
  anthropic: {
    'claude-free': ['claude-3-haiku-4-5'],
    'claude-pro': ['claude-3-7-sonnet', 'claude-sonnet-4.6', 'claude-opus-4.6', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
    'claude-team': ['claude-3-7-sonnet', 'claude-sonnet-4.6', 'claude-opus-4.6'],
    'claude-enterprise': ['claude-3-7-sonnet', 'claude-sonnet-4.6', 'claude-opus-4.6'],
  },
  google: {
    'gemini-free': ['gemini-1.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash'],
    'gemini-advanced': ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.5-pro', 'gemini-3-pro', 'gemini-3.1-pro', 'gemini-3.1-pro-preview-custom-tools'],
    'google-one-ai-premium': ['gemini-3-pro', 'gemini-3-flash'],
  },
  mistral: {
    'mistral-free': ['mistral-small', 'mistral-7b'],
    'mistral-pro': ['mistral-large', 'mistral-small', 'mistral-7b'],
    'mistral-team': ['mistral-large', 'mistral-small', 'mistral-7b'],
  },
  minimax: {
    'minimax-free': ['minimax-m2.5'],
    'minimax-lite': ['minimax-m2.1'],
    'minimax-pro': ['minimax-m2.5'],
    'minimax-team': ['minimax-m2.5'],
  },
  'minimax-global': {
    'minimax-global-free': ['minimax-m2.5'],
    'minimax-global-lite': ['minimax-m2.1'],
    'minimax-global-pro': ['minimax-m2.5'],
    'minimax-global-team': ['minimax-m2.5'],
  },
  zhipu: {
    'glm-coding-team': ['glm-4-flash', 'glm-5', 'glm-5.1'],
    'glm-coding-lite': ['glm-4', 'glm-4-flash', 'glm-5', 'glm-5.1'],
    'glm-coding-pro': ['glm-4', 'glm-4-flash', 'glm-4-air', 'glm-4.5-air', 'glm-4.6', 'glm-5', 'glm-5.1'],
    'glm-coding-max': ['glm-4', 'glm-4-flash', 'glm-4-air', 'glm-4.5-air', 'glm-4.6', 'glm-4.7-flash', 'glm-5', 'glm-5.1'],
  },
  'zhipu-global': {
    'glm-global-free': ['glm-4-flash', 'glm-4-flashx'],
    'glm-global-pro': ['glm-4', 'glm-4-plus', 'glm-5', 'glm-5.1'],
    'glm-global-team': ['glm-4', 'glm-4-plus', 'glm-4-long', 'glm-5', 'glm-5.1'],
    'z-ai-free': ['glm-4.7'],
    'z-ai-lite': ['glm-5', 'glm-5.1'],
    'z-ai-pro': ['glm-4.7', 'glm-5.1'],
    'z-ai-max': ['glm-5', 'glm-5.1', 'glm-4.7'],
  },
  moonshot: {
    'kimi-free': ['moonshot-v1-8k', 'kimi-k2.5-thinking'],
    'kimi-basic': ['kimi-k2.5-instant'],
    'kimi-pro': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2.5-thinking'],
    'kimi-team': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2.5-thinking'],
    'kimi-enterprise': ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2.5-thinking'],
    'kimi-coding-pro': ['moonshot-v1-8k', 'moonshot-v1-32k'],
  },
  baidu: {
    'ernie-free': ['ernie-speed-128k', 'ernie-bot-4-turbo'],
    'ernie-pro': ['ernie-speed-128k', 'ernie-lite-8k', 'ernie-turbo-8k'],
    'ernie-team': ['ernie-speed-128k', 'ernie-lite-8k', 'ernie-turbo-8k'],
    'ernie-monthly': ['ernie-bot-4-turbo'],
    'ernie-annual': ['ernie-bot-4-turbo'],
  },
  volcengine: {
    'seed-free-trial': ['doubao-seed-2.0-lite', 'doubao-seed-2.0', 'seed-2.0'],
    'seed-lite': ['doubao-seed-2.0-code', 'doubao-seed-2.0', 'glm-4.7-flash', 'deepseek-v3.2', 'kimi-k2.5', 'seed-2.0'],
    'seed-pro': ['doubao-seed-2.0-code', 'doubao-seed-2.0', 'glm-4.7-flash', 'deepseek-v3.2', 'kimi-k2.5', 'seed-2.0'],
    'seed-enterprise': ['doubao-seed-2.0-code', 'doubao-seed-2.0', 'glm-4.7-flash', 'deepseek-v3.2', 'kimi-k2.5', 'seed-2.0'],
  },
  qwen: {
    'qwen-free-trial': ['qwen3.5-397b'],
    'qwen-lite': ['qwen-plus', 'qwen-max'],
    'qwen-pro': ['qwen3.5-plus-2026-02-15', 'qwen-max', 'qwen-plus', 'kimi-k2.5', 'minimax-m2.5', 'glm-5'],
    'qwen-pay-as-you-go': ['qwen-max'],
    'qwen-token-pack': ['qwen-max'],
    'qwen-enterprise': ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
};

export const PLAN_MODEL_SLUGS: Record<string, string[]> = Object.values(PROVIDER_PLAN_MODEL_SLUGS)
  .reduce<Record<string, string[]>>((acc, providerPlans) => {
    for (const [planSlug, modelSlugs] of Object.entries(providerPlans)) {
      acc[planSlug] = modelSlugs;
    }
    return acc;
  }, {});
