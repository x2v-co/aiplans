/**
 * Provider metadata configuration from SCRAPER_TABLE.md
 * Contains all provider information for dynamic scrapers
 */

import type {
  ScrapedProvider,
  PricingType,
  ChannelType,
  ProviderRegion,
} from './provider-validator';

/**
 * Provider configuration with all metadata
 */
export interface ProviderConfig extends ScrapedProvider {
  pricingType: PricingType;
  apiUrl?: string;
  planUrl?: string;
  invite_link?: string;
  apiKeyEnv?: string; // Environment variable for API key
}

/**
 * All providers from SCRAPER_TABLE.md
 */
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  // === Official (Global) ===
  openai: {
    name: 'OpenAI',
    slug: 'openai',
    pricingType: 'Both',
    pricingUrl: 'https://openai.com/api/pricing/',
    planUrl: 'https://openai.com/chatgpt/pricing/',
    apiDocsUrl: 'https://platform.openai.com/docs',
    website: 'https://openai.com',
    type: 'official',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: 'API + ChatGPT Plus',
  },
  anthropic: {
    name: 'Anthropic',
    slug: 'anthropic',
    pricingType: 'Both',
    pricingUrl: 'https://claude.com/pricing#api',
    planUrl: 'https://claude.com/pricing',
    apiDocsUrl: 'https://docs.anthropic.com',
    website: 'https://anthropic.com',
    type: 'official',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: 'API + Claude Pro',
  },
  google: {
    name: 'Google Gemini',
    slug: 'google-gemini',
    pricingType: 'Both',
    pricingUrl: 'https://ai.google.dev/pricing',
    planUrl: 'https://gemini.google/subscriptions/',
    apiDocsUrl: 'https://ai.google.dev/docs',
    website: 'https://gemini.google.com',
    type: 'official',
    region: 'global',
    accessFromChina: true,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: 'API + Gemini Advanced',
  },
  grok: {
    name: 'Grok / X.AI',
    slug: 'grok',
    pricingType: 'API',
    pricingUrl: 'https://docs.x.ai/developers/models?cluster=us-east-1#models-and-pricing',
    apiDocsUrl: 'https://docs.x.ai',
    apiUrl: 'https://api.x.ai/v1/models',
    website: 'https://x.ai',
    type: 'official',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 2,
    notes: '',
  },
  mistral: {
    name: 'Mistral AI',
    slug: 'mistral',
    pricingType: 'Both',
    pricingUrl: 'https://mistral.ai/pricing#api',
    planUrl: 'https://mistral.ai/pricing',
    apiDocsUrl: 'https://docs.mistral.ai',
    website: 'https://mistral.ai',
    type: 'official',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 2,
    notes: '',
  },

  // === Official (China) ===
  deepseek: {
    name: 'DeepSeek',
    slug: 'deepseek',
    pricingType: 'API',
    pricingUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
    apiDocsUrl: 'https://api-docs.deepseek.com',
    apiUrl: 'https://api.deepseek.com/v1/models',
    website: 'https://deepseek.com',
    type: 'official',
    region: 'global',
    accessFromChina: true,
    paymentMethods: ['Alipay', 'WeChat Pay'],
    priority: 1,
    notes: '国内友好',
  },
  moonshotChina: {
    name: '月之暗面 (Moonshot/Kimi)',
    slug: 'moonshot-china',
    pricingType: 'API',
    pricingUrl: 'https://platform.moonshot.cn/docs/pricing/chat',
    apiDocsUrl: 'https://platform.moonshot.cn/docs/api/chat',
    website: 'https://platform.moonshot.cn',
    type: 'official',
    region: 'china',
    accessFromChina: true,
    paymentMethods: ['Alipay', 'WeChat Pay'],
    priority: 1,
    notes: '',
  },
  moonshotGlobal: {
    name: '月之暗面 国际 (Moonshot/Kimi Global)',
    slug: 'moonshot-global',
    pricingType: 'API',
    pricingUrl: 'https://platform.moonshot.ai/docs/pricing/chat',
    apiDocsUrl: 'https://platform.moonshot.ai/docs/overview',
    website: 'https://platform.moonshot.ai',
    type: 'official',
    region: 'global',
    accessFromChina: true,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: '',
  },
  minimaxChina: {
    name: 'Minimax',
    slug: 'minimax-china',
    pricingType: 'Both',
    pricingUrl: 'https://platform.minimaxi.com/docs/guides/pricing-paygo',
    planUrl: 'https://platform.minimaxi.com/docs/guides/pricing-coding-plan',
    apiDocsUrl: 'https://platform.minimaxi.com/docs/api-reference/api-overview',
    website: 'https://platform.minimaxi.com',
    type: 'official',
    region: 'china',
    accessFromChina: true,
    paymentMethods: ['Alipay'],
    inviteLink: 'https://platform.minimaxi.com/subscribe/coding-plan?code=GOCSHm96x2&source=link',
    priority: 1,
    notes: '',
  },
  minimaxGlobal: {
    name: 'Minimax Global',
    slug: 'minimax-global',
    pricingType: 'Both',
    pricingUrl: 'https://platform.minimax.io/docs/guides/pricing-paygo',
    planUrl: 'https://platform.minimax.io/docs/guides/pricing-coding-plan',
    apiDocsUrl: 'https://platform.minimax.io/docs/guides/models-intro',
    website: 'https://platform.minimax.io',
    type: 'official',
    region: 'global',
    accessFromChina: true,
    paymentMethods: ['Credit Card', 'Alipay'],
    priority: 1,
    notes: '',
  },
  zhipuChina: {
    name: '智谱 AI (ChatGLM)',
    slug: 'zhipu-china',
    pricingType: 'Both',
    pricingUrl: 'https://bigmodel.cn/pricing',
    planUrl: 'https://bigmodel.cn/glm-coding',
    apiDocsUrl: 'https://docs.bigmodel.cn/cn/guide/start/model-overview',
    website: 'https://bigmodel.cn',
    type: 'official',
    region: 'china',
    accessFromChina: true,
    paymentMethods: ['Alipay', 'WeChat Pay'],
    inviteLink: 'https://www.bigmodel.cn/glm-coding?ic=U2SFC0L765',
    priority: 1,
    notes: '',
  },
  zhipuGlobal: {
    name: '智谱 AI Global / Z.AI (ChatGLM)',
    slug: 'zhipu-global',
    pricingType: 'Both',
    pricingUrl: 'https://docs.z.ai/guides/overview/pricing',
    planUrl: 'https://z.ai/subscribe',
    apiDocsUrl: 'https://docs.z.ai/guides/overview/quick-start',
    website: 'https://z.ai',
    type: 'official',
    region: 'global',
    accessFromChina: true,
    paymentMethods: ['Credit Card', 'PayPal'],
    inviteLink: 'https://z.ai/subscribe?ic=HFGTURQAPY',
    priority: 1,
    notes: '',
  },
  stepfun: {
    name: '阶跃星辰 (StepFun)',
    slug: 'stepfun',
    pricingType: 'API',
    pricingUrl: 'https://platform.stepfun.com/docs/zh/pricing/details',
    apiDocsUrl: 'https://platform.stepfun.com/docs/zh/overview/concept',
    website: 'https://platform.stepfun.com',
    type: 'official',
    region: 'china',
    accessFromChina: true,
    paymentMethods: [],
    priority: 2,
    notes: '',
  },
  qwen: {
    name: '阿里 (Qwen)',
    slug: 'qwen',
    pricingType: 'Both',
    pricingUrl: 'https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=2987148',
    planUrl: 'https://bailian.console.aliyun.com/cn-beijing/?tab=doc#/doc/?type=model&url=3005961',
    apiDocsUrl: 'https://help.aliyun.com/zh/model-studio/what-is-model-studio',
    website: 'https://www.aliyun.com',
    type: 'official',
    region: 'both',
    accessFromChina: true,
    paymentMethods: ['Alipay'],
    inviteLink: 'https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12401178..10263..',
    priority: 1,
    notes: '有免费额度',
  },
  seed: {
    name: '字节跳动 (Seed)',
    slug: 'seed',
    pricingType: 'Both',
    pricingUrl: 'https://www.volcengine.com/docs/82379/1544106',
    planUrl: 'https://www.volcengine.com/docs/82379/1925114',
    apiDocsUrl: 'https://www.volcengine.com/docs/82379/1099455',
    website: 'https://www.volcengine.com',
    type: 'official',
    region: 'both',
    accessFromChina: true,
    paymentMethods: ['Alipay', 'WeChat Pay'],
    inviteLink: 'https://volcengine.com/L/_uDpCXoFKP0/',
    priority: 1,
    notes: '',
  },
  hunyuan: {
    name: '腾讯 (Hunyuan)',
    slug: 'hunyuan',
    pricingType: 'API',
    pricingUrl: 'https://cloud.tencent.com/document/product/1729/97731',
    apiDocsUrl: '',
    website: 'https://hunyuan.tencent.com',
    type: 'official',
    region: 'china',
    accessFromChina: true,
    paymentMethods: [],
    priority: 2,
    notes: '',
  },
  baidu: {
    name: '百度 (ERNIE)',
    slug: 'baidu',
    pricingType: 'Both',
    pricingUrl: 'https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya',
    planUrl: 'https://console.bce.baidu.com/qianfan/resource/subscribe',
    apiDocsUrl: '',
    website: 'https://cloud.baidu.com',
    type: 'official',
    region: 'china',
    accessFromChina: true,
    paymentMethods: [],
    priority: 1,
    notes: '',
  },

  // === Cloud Providers ===
  awsBedrock: {
    name: 'AWS Bedrock',
    slug: 'aws-bedrock',
    pricingType: 'API',
    pricingUrl: 'https://aws.amazon.com/bedrock/pricing/',
    apiDocsUrl: '',
    website: 'https://aws.amazon.com/bedrock',
    type: 'cloud',
    region: 'global',
    accessFromChina: true,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: '按需计费',
  },
  vertexAi: {
    name: 'Google Vertex AI',
    slug: 'vertex-ai',
    pricingType: 'API',
    pricingUrl: 'https://cloud.google.com/vertex-ai/pricing',
    apiDocsUrl: '',
    website: 'https://cloud.google.com/vertex-ai',
    type: 'cloud',
    region: 'global',
    accessFromChina: true,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: '',
  },
  azureOpenai: {
    name: 'Azure OpenAI',
    slug: 'azure-openai',
    pricingType: 'API',
    pricingUrl: 'https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/',
    apiDocsUrl: '',
    website: 'https://azure.microsoft.com/services/cognitive-services/openai',
    type: 'cloud',
    region: 'global',
    accessFromChina: true,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: '',
  },

  // === Aggregators ===
  openrouter: {
    name: 'OpenRouter',
    slug: 'openrouter',
    pricingType: 'API',
    pricingUrl: 'https://openrouter.ai/models',
    apiDocsUrl: 'https://openrouter.ai/api/v1/models',
    apiUrl: 'https://openrouter.ai/api/v1/models',
    website: 'https://openrouter.ai',
    type: 'aggregator',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: '✅ 已完成',
  },
  togetherAi: {
    name: 'Together AI',
    slug: 'together-ai',
    pricingType: 'API',
    pricingUrl: 'https://www.together.ai/pricing',
    apiDocsUrl: '',
    apiUrl: 'https://api.together.xyz/v1/models',
    website: 'https://together.ai',
    type: 'aggregator',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 1,
    notes: '',
  },
  fireworks: {
    name: 'Fireworks AI',
    slug: 'fireworks',
    pricingType: 'API',
    pricingUrl: 'https://fireworks.ai/pricing',
    apiDocsUrl: '',
    website: 'https://fireworks.ai',
    type: 'aggregator',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 2,
    notes: '',
  },
  replicate: {
    name: 'Replicate',
    slug: 'replicate',
    pricingType: 'API',
    pricingUrl: 'https://replicate.com/pricing',
    apiDocsUrl: '',
    website: 'https://replicate.com',
    type: 'aggregator',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 2,
    notes: '',
  },
  anyscale: {
    name: 'Anyscale',
    slug: 'anyscale',
    pricingType: 'API',
    pricingUrl: 'https://www.anyscale.com/pricing',
    apiDocsUrl: '',
    website: 'https://anyscale.com',
    type: 'aggregator',
    region: 'global',
    accessFromChina: false,
    paymentMethods: ['Credit Card'],
    priority: 2,
    notes: '',
  },
  siliconflow: {
    name: '硅基流动',
    slug: 'siliconflow',
    pricingType: 'API',
    pricingUrl: 'https://siliconflow.cn/pricing',
    apiDocsUrl: '',
    apiUrl: 'https://api.siliconflow.cn/v1/models',
    website: 'https://siliconflow.cn',
    type: 'aggregator',
    region: 'china',
    accessFromChina: true,
    paymentMethods: ['Alipay', 'WeChat Pay'],
    priority: 1,
    notes: '国内最大',
  },

  // === Reseller ===
  dmxapi: {
    name: 'DMXAPI（大模型API）',
    slug: 'dmxapi',
    pricingType: 'API',
    pricingUrl: 'https://www.dmxapi.cn/rmb',
    apiDocsUrl: '',
    website: 'https://www.dmxapi.cn',
    type: 'reseller',
    region: 'china',
    accessFromChina: true,
    paymentMethods: ['Alipay', 'WeChat Pay'],
    priority: 3,
    notes: '',
  },
};

/**
 * Get provider config by slug
 */
export function getProviderConfig(slug: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[slug];
}

/**
 * Get providers by priority
 */
export function getProvidersByPriority(priority: 1 | 2 | 3): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p => p.priority === priority);
}

/**
 * Get providers by type
 */
export function getProvidersByType(type: ChannelType): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p => p.type === type);
}

/**
 * Get providers by pricing type
 */
export function getProvidersByPricingType(pricingType: PricingType): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p => p.pricingType === pricingType);
}

/**
 * Get providers with API pricing
 */
export function getProvidersWithAPI(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p =>
    p.pricingType === 'API' || p.pricingType === 'Both'
  );
}

/**
 * Get providers with Plan pricing
 */
export function getProvidersWithPlans(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p =>
    p.pricingType === 'Plan' || p.pricingType === 'Both'
  );
}

/**
 * Get providers accessible from China
 */
export function getChinaAccessibleProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter(p => p.accessFromChina);
}

/**
 * Get all provider slugs
 */
export function getAllProviderSlugs(): string[] {
  return Object.keys(PROVIDER_CONFIGS);
}
