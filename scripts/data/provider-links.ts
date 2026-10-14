export const PROVIDER_LINK_FIELDS = ['website', 'apiDocsUrl', 'pricingUrl', 'consoleUrl'] as const;
export type ProviderLinkField = typeof PROVIDER_LINK_FIELDS[number];
export type ProviderLinks = Partial<Record<ProviderLinkField, string>>;

// Official vendor URLs only. Regional slugs follow scripts/utils/provider-config.ts;
// xAI's SpaceXSI rebrand keeps the existing xai slug. Unknown providers are omitted.
const google: ProviderLinks = {
  website: 'https://ai.google.dev/', apiDocsUrl: 'https://ai.google.dev/gemini-api/docs',
  pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing', consoleUrl: 'https://aistudio.google.com/',
};
const xai: ProviderLinks = {
  website: 'https://x.ai/', apiDocsUrl: 'https://docs.x.ai/',
  pricingUrl: 'https://docs.x.ai/developers/models', consoleUrl: 'https://console.x.ai/',
};
const moonshotChina: ProviderLinks = {
  website: 'https://platform.moonshot.cn/', apiDocsUrl: 'https://platform.moonshot.cn/docs',
  pricingUrl: 'https://platform.moonshot.cn/docs/pricing/chat', consoleUrl: 'https://platform.moonshot.cn/console',
};
const moonshotGlobal: ProviderLinks = {
  website: 'https://platform.moonshot.ai/', apiDocsUrl: 'https://platform.moonshot.ai/docs',
  pricingUrl: 'https://platform.moonshot.ai/docs/pricing/chat', consoleUrl: 'https://platform.moonshot.ai/console',
};
const zhipuChina: ProviderLinks = {
  website: 'https://bigmodel.cn/', apiDocsUrl: 'https://docs.bigmodel.cn/',
  pricingUrl: 'https://bigmodel.cn/pricing', consoleUrl: 'https://open.bigmodel.cn/',
};
const minimaxGlobal: ProviderLinks = {
  website: 'https://www.minimax.io/', apiDocsUrl: 'https://platform.minimax.io/docs',
  pricingUrl: 'https://platform.minimax.io/docs/guides/pricing-paygo', consoleUrl: 'https://platform.minimax.io/',
};
const alibaba: ProviderLinks = {
  website: 'https://www.aliyun.com/', apiDocsUrl: 'https://help.aliyun.com/zh/model-studio/what-is-model-studio',
  pricingUrl: 'https://help.aliyun.com/zh/model-studio/model-pricing', consoleUrl: 'https://bailian.console.aliyun.com/',
};

export const PROVIDER_LINK_SEEDS: Record<string, ProviderLinks> = {
  elevenlabs: {
    website: 'https://elevenlabs.io/', apiDocsUrl: 'https://elevenlabs.io/docs',
    pricingUrl: 'https://elevenlabs.io/pricing/api', consoleUrl: 'https://elevenlabs.io/app',
  },
  openai: {
    website: 'https://openai.com/', apiDocsUrl: 'https://platform.openai.com/docs',
    pricingUrl: 'https://platform.openai.com/docs/pricing', consoleUrl: 'https://platform.openai.com/',
  },
  anthropic: {
    website: 'https://www.anthropic.com/', apiDocsUrl: 'https://platform.claude.com/docs',
    pricingUrl: 'https://platform.claude.com/docs/en/about-claude/pricing', consoleUrl: 'https://platform.claude.com/',
  },
  google, 'google-gemini': google,
  xai, grok: xai,
  deepseek: {
    website: 'https://www.deepseek.com/', apiDocsUrl: 'https://api-docs.deepseek.com/',
    pricingUrl: 'https://api-docs.deepseek.com/quick_start/pricing', consoleUrl: 'https://platform.deepseek.com/',
  },
  mistral: {
    website: 'https://mistral.ai/', apiDocsUrl: 'https://docs.mistral.ai/',
    pricingUrl: 'https://docs.mistral.ai/inference/pricing', consoleUrl: 'https://console.mistral.ai/',
  },
  moonshot: moonshotChina, 'moonshot-china': moonshotChina, 'moonshot-global': moonshotGlobal,
  zhipu: zhipuChina, 'zhipu-china': zhipuChina,
  'zhipu-global': {
    website: 'https://z.ai/', apiDocsUrl: 'https://docs.z.ai/',
    pricingUrl: 'https://docs.z.ai/guides/overview/pricing', consoleUrl: 'https://z.ai/manage-apikey/apikey-list',
  },
  minimax: minimaxGlobal, 'minimax-global': minimaxGlobal,
  'minimax-china': {
    website: 'https://www.minimaxi.com/', apiDocsUrl: 'https://platform.minimaxi.com/docs',
    pricingUrl: 'https://platform.minimaxi.com/docs/guides/pricing-paygo', consoleUrl: 'https://platform.minimaxi.com/',
  },
  alibaba, qwen: alibaba,
};

/** NULL alone is fillable; empty strings and every existing URL are preserved. */
export function missingProviderLinks(current: Record<ProviderLinkField, string | null>, seed: ProviderLinks): ProviderLinks {
  return Object.fromEntries(PROVIDER_LINK_FIELDS
    .filter(field => current[field] === null && seed[field] !== undefined)
    .map(field => [field, seed[field]]));
}
