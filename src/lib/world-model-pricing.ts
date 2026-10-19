import type { AiCatalogItem } from './ai-vertical-catalog';

export const WORLD_MODEL_LABELS = {
  en: {
    product: 'Product', priceStatus: 'Price status', price: 'Price / unit', cost: 'Cost per minute',
    resolution: 'Resolution', fps: 'FPS', realtime: 'Realtime', license: 'License', verified: 'Verified',
    sources: 'Sources', warnings: 'Needs verification', billingUnit: 'Billing unit', currency: 'Currency',
    session: 'Max session length', memory: 'Memory horizon', output: 'Output type', access: 'Access note',
    hardware: 'Self-host hardware', tiers: 'Plan tiers', credits: 'Credits', notes: 'Notes',
    'needs-verification': 'Needs verification', 'not-public': 'Not public', per_song: 'song', priced: 'Priced', subscription_included: 'Subscription included', undisclosed: 'Undisclosed', not_applicable: 'Not applicable',
    per_second: 'second', per_minute: 'minute', per_world: 'world', per_token: 'token', contract: 'Contract', open_source_self_host: 'Self-host compute',
    video_stream: 'Video stream', '3d_asset': '3D asset', panorama: 'Panorama', yes: 'Yes', no: 'No',
    research: 'Research, not products', costNote: 'Priced realtime models billed per second, sorted by cost per minute. Self-host compute is excluded.',
  },
  zh: {
    product: '产品', priceStatus: '价格状态', price: '价格 / 单位', cost: '每分钟费用',
    resolution: '分辨率', fps: '帧率', realtime: '实时', license: '许可证', verified: '核验日期',
    sources: '来源', warnings: '待核验', billingUnit: '计费单位', currency: '币种',
    session: '最长会话', memory: '记忆时长', output: '输出类型', access: '访问说明',
    hardware: '自托管硬件', tiers: '套餐档位', credits: '积分', notes: '说明',
    'needs-verification': '待核验', 'not-public': '未公开', per_song: '首', priced: '已标价', subscription_included: '订阅包含', undisclosed: '未公开', not_applicable: '不适用',
    per_second: '秒', per_minute: '分钟', per_world: '世界', per_token: 'token', contract: '合同', open_source_self_host: '自托管算力',
    video_stream: '视频流', '3d_asset': '3D 资产', panorama: '全景', yes: '是', no: '否',
    research: '研究，非产品', costNote: '仅列出按秒计费且已标价的实时模型，按每分钟费用升序排列，不包含自托管算力。',
  },
};

export function worldModelLabels(locale: string) {
  return WORLD_MODEL_LABELS[locale === 'zh' ? 'zh' : 'en'];
}

export function formatWorldMoney(value: number | null | undefined, currency: string | undefined, locale: string): string {
  if (value == null || !Number.isFinite(value) || !currency) return '—';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(value);
}

export function worldModelPrice(item: AiCatalogItem, locale: string): string {
  if (item.priceStatus !== 'priced' || !item.billingUnit) return '—';
  const price = formatWorldMoney(item.pricePerUnit, item.currency, locale);
  return price === '—' ? price : `${price} / ${worldModelLabels(locale)[item.billingUnit]}`;
}

export function worldModelMinuteCost(item: AiCatalogItem, locale: string): string {
  return item.priceStatus === 'priced' ? formatWorldMoney(item.costPerMinute, item.currency, locale) : '—';
}

export function worldModelsByCostPerMinute(items: AiCatalogItem[]): AiCatalogItem[] {
  return items.filter((item) =>
    item.kind === 'world-model' && item.realtime === true && item.billingUnit === 'per_second' &&
    item.priceStatus === 'priced' && item.pricePerUnit != null && Number.isFinite(item.pricePerUnit) &&
    item.costPerMinute != null && Number.isFinite(item.costPerMinute)
  ).sort((a, b) => a.costPerMinute! - b.costPerMinute!);
}
