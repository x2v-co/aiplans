/**
 * OpenAI platform (non-model) deprecations shown on /providers/openai.
 * Code-only, no DB. Source: the official deprecations page, read 2026-11-14
 * (the page returns 403 to curl; text was read through r.jina.ai on the same URL).
 * Dates are the official shutdown/effective dates; notice dates are when OpenAI
 * announced them, not when aiplans saw them.
 */
export const OPENAI_DEPRECATIONS_SOURCE = 'https://developers.openai.com/api/docs/deprecations';
export const OPENAI_FINE_TUNING_SOURCE = `${OPENAI_DEPRECATIONS_SOURCE}#update-to-openais-self-serve-fine-tuning`;
export const OPENAI_PLATFORM_DEPRECATIONS_VERIFIED = '2026-11-14';

export interface OpenAiPlatformDeprecation {
  key: string;
  date: string;
  noticeDate: string;
  status: 'deprecated' | 'read-only' | 'restricted';
  feature: { en: string; zh: string };
  replacement: { en: string; zh: string };
  source: string;
}

export const OPENAI_PLATFORM_DEPRECATIONS: readonly OpenAiPlatformDeprecation[] = [
  {
    key: 'prompts', date: '2026-11-30', noticeDate: '2026-06-03', status: 'deprecated',
    feature: { en: '/v1/prompts and reusable prompt objects', zh: '/v1/prompts 与 reusable prompt objects' },
    replacement: { en: 'Move prompt content into your application code.', zh: '把 prompt 内容移入应用代码。' },
    source: OPENAI_DEPRECATIONS_SOURCE,
  },
  {
    key: 'evals', date: '2026-11-30', noticeDate: '2026-06-03', status: 'read-only',
    feature: { en: 'Evals dashboard, API, and graders for eval workflows', zh: 'Evals dashboard、API 及 eval workflow graders' },
    replacement: { en: 'Migrate to Promptfoo. Fine-tuning graders follow the fine-tuning timeline.', zh: '迁往 Promptfoo；fine-tuning graders 按 fine-tuning 时间表。' },
    source: OPENAI_DEPRECATIONS_SOURCE,
  },
  {
    key: 'agent-builder', date: '2026-11-30', noticeDate: '2026-06-03', status: 'deprecated',
    feature: { en: 'Agent Builder', zh: 'Agent Builder' },
    replacement: { en: 'Agents SDK or ChatGPT Workspace Agents. ChatKit remains available.', zh: '改用 Agents SDK 或 ChatGPT Workspace Agents；ChatKit 仍可用。' },
    source: OPENAI_DEPRECATIONS_SOURCE,
  },
  {
    key: 'fine-tuning', date: '2027-01-06', noticeDate: '2026-05-07', status: 'restricted',
    feature: { en: 'Self-serve fine-tuning job creation', zh: 'Self-serve fine-tuning 新建 job' },
    replacement: {
      en: 'Active existing customers can no longer create new fine-tuning jobs. Inference on fine-tuned models stays until the base model is deprecated.',
      zh: '现有活跃客户也不能再新建 fine-tuning job；已微调模型的推理保留到其 base model 弃用。',
    },
    source: OPENAI_FINE_TUNING_SOURCE,
  },
];

const STATUS = {
  deprecated: { en: 'Deprecated', zh: '弃用' },
  'read-only': { en: 'Read-only', zh: '只读' },
  restricted: { en: 'Restricted access', zh: '限制访问' },
} as const;

export function openAiPlatformDeprecationsCopy(locale: string) {
  const zh = locale === 'zh';
  return {
    heading: zh ? 'OpenAI 平台功能弃用（非模型）' : 'OpenAI platform deprecations (not models)',
    verifiedAt: zh ? '核对日期' : 'Verified',
    items: OPENAI_PLATFORM_DEPRECATIONS.map(item => ({
      key: item.key,
      date: item.date,
      text: zh
        ? `${item.date}：${item.feature.zh}（${STATUS[item.status].zh}，公告日 ${item.noticeDate}）。${item.replacement.zh}`
        : `${item.date}: ${item.feature.en} (${STATUS[item.status].en}; notice date ${item.noticeDate}). ${item.replacement.en}`,
    })),
    note: zh
      ? '这些是 API 平台功能，不影响上表模型的按量价格。'
      : 'These are API platform features; they do not change the per-token model prices above.',
    source: zh ? 'OpenAI 官方弃用页' : 'OpenAI deprecations',
  };
}
