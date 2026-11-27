import type { AiCatalogItem } from './ai-vertical-catalog';

export const VERIFIED = '2026-11-27';
export const PRICING_PAGE = 'https://help.aliyun.com/zh/model-studio/model-pricing.md';
export const NEWLY_RELEASED_PAGE = 'https://help.aliyun.com/zh/model-studio/newly-released-models.md';
export const TICKET_URL = 'https://smartservice.console.aliyun.com/service/create-ticket';
export const INVITE_NOTE = 'Fun-Music 目前处于定向邀测阶段。如需申请使用，请联系商务经理，或提交工单。';
export const BILLING_RULE = '按输出音频的秒数计费，输入不计费。';
export const QUOTA_VALIDITY = '有效期：自开通百炼/模型发布/申请通过之日起90天内（以较晚者为准）';
export const CHANNEL_SLUG = 'qwen';
export const REGION = 'cn-beijing';
export const PRICING_UNIT = 'per_second';
export const PRICE_KIND = 'audio_second';
export const PRICE_UNIT = 'second';
export const FUN_MUSIC_MODELS = [
  { id: 'fun-music-preview', name: '百聆音乐生成preview版大模型（Fun音乐大模型）', listedOn: '2026-06-01', price: 0.005, freeSeconds: 0 },
  { id: 'fun-music-v1', name: '百聆音乐生成大模型（Fun音乐大模型）', listedOn: '2026-05-06', price: 0.002, freeSeconds: 1000 },
] as const;

export const FUN_MUSIC_CATALOG: AiCatalogItem[] = FUN_MUSIC_MODELS.map(model => ({
  slug: model.id, name: model.name, kind: 'music-model', modelCategory: 'music',
  provider: '百炼 Model Studio', providerSlug: CHANNEL_SLUG,
  pricingChannel: '百炼 Model Studio', pricingProviderSlug: CHANNEL_SLUG,
  pricingReference: 'planless-usage',
  status: 'waitlist', access: ['cloud-api', 'waitlist'],
  accessNote: `${INVITE_NOTE} ${TICKET_URL}`,
  pricing: `华北2（北京）: ${model.price} 元 / 秒输出音频；输入不计费；免费额度：${model.freeSeconds ? '1,000 秒' : '无'}`,
  unit: PRICE_UNIT, pricingUnit: PRICING_UNIT, billingUnit: PRICING_UNIT,
  pricePerUnit: model.price, currency: 'CNY', priceStatus: 'priced', pricingConfidence: 'verified',
  usageRates: [{ priceKind: PRICE_KIND, unit: PRICE_UNIT, price: model.price }],
  inputModalities: ['text'], outputModalities: ['audio', 'music'],
  capabilities: ['music generation', 'vocals', 'lyrics'],
  bestFor: '输入开放性歌曲创作要求或歌词，生成整首男声或女声演唱的中文或英文歌曲。',
  notes: [
    `官方 API ID：${model.id}。${INVITE_NOTE} 工单：${TICKET_URL}`,
    `华北2（北京）限定刊例价。${BILLING_RULE} 免费额度：${model.freeSeconds ? `1,000 秒；${QUOTA_VALIDITY}` : '无'}。`,
    `官方上新页收录日期：${model.listedOn}（仅收录日期）；${model.id === 'fun-music-preview' ? '本次版本为预览快照版。' : ''}官方上新标签为语音合成，定价归属音乐生成。`,
  ].join('\n'),
  url: PRICING_PAGE,
  sourceUrls: [
    { label: '百炼音乐生成价格', url: PRICING_PAGE, publisher: '阿里云' },
    { label: '百炼最新模型', url: NEWLY_RELEASED_PAGE, publisher: '阿里云' },
  ],
  lastVerified: VERIFIED, verifiedAt: VERIFIED,
  deferredDbSeed: true, deferredDbSeedScript: 'seed:catalog-2026-11-27-fun-music:apply',
}));
