import type { AiCatalogItem } from './ai-vertical-catalog';

/** Official 百炼 pricing, model info, System One API and release log; verified 2026-11-26. */
export const VERIFIED = '2026-11-26';
export const BAILIAN_PRICING = 'https://help.aliyun.com/zh/model-studio/model-pricing';
export const BAILIAN_DECISION_INFO = 'https://help.aliyun.com/zh/model-studio/decision-model-stable';
export const BAILIAN_DECISION_API = 'https://help.aliyun.com/zh/model-studio/decision-model-api';
export const BAILIAN_RELEASES = 'https://help.aliyun.com/zh/model-studio/newly-released-models';
export const BAILIAN_DECISION_GA = {
  slug: 'qwen-decision-model', apiId: 'decision-model', name: '百炼 decision-model',
  aliases: ['qwen-decision-model', 'decision-model'],
  status: 'available', context: 268_288, releasedAt: '2026-11-25',
  beijingInput: 0.3, singaporeInput: 0.306, inputModalities: ['text', 'image'],
} as const;
export const BAILIAN_DECISION_PREVIEW = {
  slug: 'qwen-decision-model-preview', apiId: 'decision-model-preview', name: '百炼 decision-model-preview',
  aliases: ['qwen-decision-model-preview', 'decision-model-preview'],
  status: 'preview', context: 65_536, releasedAt: '2026-09-24',
  beijingInput: 0, singaporeInput: 0, inputModalities: ['text'],
} as const;
export const BAILIAN_DECISION_SPECS = [BAILIAN_DECISION_GA, BAILIAN_DECISION_PREVIEW] as const;
export type BailianDecisionSpec = (typeof BAILIAN_DECISION_SPECS)[number];
export const BAILIAN_DECISION_REGIONS = [
  { key: 'cn-beijing', name: '华北2（北京）', headline: true },
  { key: 'ap-southeast-1', name: '新加坡', headline: false },
] as const;

export const BAILIAN_INPUT_ONLY_NOTE = '计费规则：按输入 token 计费。The official table publishes no output unit price; output 0 is the catalog input-only convention, not an official output list price.';
export const BAILIAN_GA_QUOTA_NOTE = '北京免费额度 100 万 Token。免费额度有效期：自开通百炼、模型发布或申请通过之日起 90 天内（以较晚者为准）。新加坡无免费额度。';
export const BAILIAN_PREVIEW_PRICE_NOTE = '华北2（北京）/ 新加坡：限时免费 (limited-time free). The official pricing page publishes no end date; this is not permanent free pricing.';

export function bailianDecisionNotes(spec: BailianDecisionSpec): string {
  return [
    `阿里云百炼 official API id ${spec.apiId}; released ${spec.releasedAt}.`,
    BAILIAN_INPUT_ONLY_NOTE,
    spec.status === 'preview' ? BAILIAN_PREVIEW_PRICE_NOTE
      : `华北2（北京）¥0.3 / million input tokens; 新加坡 ¥0.306 / million input tokens (CNY). ${BAILIAN_GA_QUOTA_NOTE}`,
    'POST /compatible-mode/v1/systemone does not generate text; latency and cost are independent of output length. usage documents input_tokens only. Up to 16 questions per request.',
    `Context / maximum input: ${spec.context.toLocaleString('en-US')} tokens; overlong state is rejected. Maximum output is — (stored as 0 tokens).`,
    spec.status === 'preview'
      ? 'Preview release log documents text or business state. Image support is unverified; the preview model-info URL is a soft 404 and is not used as a source. The fine-tune/base id decision-model-preview-2026-09-24 is a separate identity and is not cataloged here.'
      : 'GA accepts text and images; model info labels the result Text (structured decision results). Function Calling, structured-output mode, web search, prefix continuation, context caching, batch inference and fine-tuning are not supported. Both regions: RPM 5,000; TPM 5,000,000.',
  ].join(' ');
}

export const DECISION_MODELS_2026_11_26: AiCatalogItem[] = BAILIAN_DECISION_SPECS.map(spec => ({
  kind: 'decision-model', slug: spec.slug, name: spec.name,
  provider: '阿里云百炼', providerSlug: 'qwen', modelCategory: 'decision',
  status: spec.status, releasedAt: spec.releasedAt,
  pricing: spec.status === 'preview' ? BAILIAN_PREVIEW_PRICE_NOTE
    : '¥0.3/M input（华北2（北京））; 新加坡 ¥0.306/M input. 北京免费额度 100 万 Token（90 天，以较晚者为准）；新加坡无免费额度。Input-only billing; no output list price.',
  unit: 'CNY/1M input tokens', pricingUnit: 'per_1m_tokens', billingUnit: 'per_token',
  inputPricePer1M: spec.beijingInput, outputPricePer1M: 0,
  pricePer1MTasks: null, pricePerUnit: null, priceStatus: 'priced', currency: 'CNY',
  contextWindow: spec.context, contextWindowLabel: `${spec.context} tokens`,
  access: ['api'], inputModalities: [...spec.inputModalities], outputModalities: ['text'],
  capabilities: [], bestFor: 'Decision questions over shared input or business state; no text generation.',
  pricingProviderSlug: 'qwen', pricingChannel: 'Official · 华北2（北京）', pricingConfidence: 'verified',
  lastVerified: VERIFIED, verifiedAt: VERIFIED, notes: bailianDecisionNotes(spec),
  url: spec.status === 'preview' ? BAILIAN_DECISION_API : BAILIAN_DECISION_INFO,
  sourceUrls: [
    { label: '百炼决策模型价格', url: BAILIAN_PRICING, publisher: 'Alibaba Cloud' },
    ...(spec.status === 'preview' ? [] : [{ label: 'decision-model 模型信息', url: BAILIAN_DECISION_INFO, publisher: 'Alibaba Cloud' }]),
    { label: '决策模型 System One API', url: BAILIAN_DECISION_API, publisher: 'Alibaba Cloud' },
    { label: '百炼模型发布记录', url: BAILIAN_RELEASES, publisher: 'Alibaba Cloud' },
  ],
  deferredDbSeed: true, deferredDbSeedScript: 'seed:catalog-2026-11-26-bailian-decision:apply',
}));
