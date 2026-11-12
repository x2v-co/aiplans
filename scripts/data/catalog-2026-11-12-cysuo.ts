import type { Sql } from 'postgres';
import { seedChanges } from './gemini-4-argon';
import { retainLockedUnavailable } from '../utils/manual-unavailable';

/**
 * Manual seed that adds 词元所 (cysuo.com, Token Exchange) as a standalone
 * aggregator. Never part of deploy or seed-catalog.sh.
 * The CLI dry-run calls this with apply=true inside runRehearsable, which rolls back.
 * :apply is a separate npm script. No deletes. Does not touch baidu or baidu-global.
 *
 * Prices were read from official model detail pages on 2026-11-12 (Asia/Singapore).
 * There is no public machine-readable price API. Only listings whose input/output
 * prices appeared on those pages are seeded. Video models are omitted: detail pages
 * show a per-second-looking number but label the unit as 元/百万 Token.
 */
export const VERIFIED = '2026-11-12';
export const VERIFIED_AT = new Date(`${VERIFIED}T00:00:00Z`);
export const PROVIDER_SLUG = 'cysuo';
export const BAIDU_SLUGS = ['baidu', 'baidu-global'] as const;
export const MARKET_URL = 'https://cysuo.com/model-market';
export const SITE_URL = 'https://cysuo.com';
export const AGREEMENT_URL = 'https://cysuo.com/docs/useragreement';
export const API_GUIDE_URL = 'https://cysuo.com/docs/api-reference/guide';
export const LOGO_URL = 'https://cysuo.cdn.bcebos.com/assets/imgs/logo-cysuo.png';
export const LEGAL_NAME = '北京百度网讯科技有限公司';
export const SEED_TABLES = ['providers', 'models', 'api_channel_prices', 'api_channel_price_variants'] as const;
export type Table = typeof SEED_TABLES[number];

const evidence = (note: string, sources: readonly string[]) =>
  `${note} Verified ${VERIFIED}. Source: ${sources.join(' ; ')}`;

export const PROVIDER_NOTES = evidence(
  [
    '词元所（Token Exchange）是百度智能云运营的模型撮合交易与统一调用平台。',
    `平台服务协议签约主体为${LEGAL_NAME}（协议原文含「科技」二字；需求卡片曾写「北京百度网讯有限公司」）。`,
    '独立 aggregator，不与 baidu / baidu-global 合并。币种 CNY，region=china。',
    '海外可用性未核实：搜索栏为「搜索国内站的模型、供应商」；调用指南只公布广州 https://api.cysuo.com 与北京 https://vod.bj.baidubce.com，未见海外入口。supported_regions 保持 NULL，不把海外写成不可用。',
    '无公开机器可读价格 API。同模型多家供应商挂牌价写入 api_channel_price_variants（variant_kind=upstream_provider）；渠道行取详情页「最低可用价」对应的最低输出价（同输出再取最低输入）。',
    '价格口径：含税，为各供应商当前标价。对照原价与节省比例只写在 variant 备注，不写入 regular_*（未见限时截止日）。',
  ].join(' '),
  [SITE_URL, MARKET_URL, AGREEMENT_URL, API_GUIDE_URL],
);

export const CHANNEL_NOTE_PREFIX = '词元所挂牌价，含税，为各供应商当前标价。失败请求不计费。渠道行为最低可用挂牌；各供应商价差见 variants。海外可用性未核实。';

export type SupplierListing = {
  providerId: string;
  providerName: string;
  resourceId: string;
  kind: 'cloud' | 'official';
  region: string;
  input: number;
  output: number;
  cache: number | null;
  origInput: number;
  origOutput: number;
  origCache: number | null;
  savingPercent: number;
  formats: string[];
};

export type ModelListing = {
  slug: string;
  name: string;
  vendor: string;
  existingInProduction: boolean;
  releasedAt: string;
  contextWindow: number;
  maxOutputTokens: number;
  listedSupplierCount?: number;
  description: string;
  sourceUrl: string;
  suppliers: SupplierListing[];
};

export const LISTINGS: ModelListing[] = [
  {
    slug: 'deepseek-v4.1-flash',
    name: "DeepSeek-V4.1-Flash",
    vendor: "深度求索",
    existingInProduction: true,
    releasedAt: '2026-09-09',
    contextWindow: 1000000,
    maxOutputTokens: 393216,
    description: "DeepSeek-V4.1-Flash 是深度求索 2026.9.10 发布的原生多模态 MoE 大模型，百万 token 上下文，全新非对称架构，推理吞吐更高、KV 缓存成本大幅降低，综合 Agent、推理性能优于 V4-Pro，API 支持 OpenAI/Anthropic 双协议。",
    sourceUrl: 'https://cysuo.com/model-market/deepseek-v4.1-flash',
    suppliers: [
      {
        providerId: '1021', providerName: "博川科技",
        resourceId: '680ae816-175f-417f-85e6-3cb3fefd8c15', kind: 'cloud', region: 'guangzhou',
        input: 0.74, output: 2.96, cache: 0.0148,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 63, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1039', providerName: "金灵狐(深圳)科技有限公司",
        resourceId: '56e98242-fbd6-4dec-8c6c-0ef7727054cd', kind: 'cloud', region: 'guangzhou',
        input: 0.8, output: 3.2, cache: 0.016,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 60, formats: ["openai"],
      },
      {
        providerId: '1011', providerName: "北京心智无限科技有限公司",
        resourceId: 'f0c977a0-599f-4b0a-b4f0-2b9ab6fde737', kind: 'cloud', region: 'guangzhou',
        input: 1.2, output: 4.8, cache: 0.024,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 40, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1017', providerName: "浙江嘉信万益科技有限公司",
        resourceId: '6c928dc3-c02e-4bd5-855e-6487e64d1c24', kind: 'cloud', region: 'guangzhou',
        input: 1.3, output: 5.2, cache: 0.026,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 35, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1004', providerName: "广州烽云信息科技有限公司",
        resourceId: '4d824bd8-8e73-4bb8-a84d-b49bc5f1a741', kind: 'cloud', region: 'guangzhou',
        input: 1.5, output: 6, cache: 0.03,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 25, formats: ["openai"],
      },
    ],
  },
  {
    slug: 'deepseek-v4.1-flash-1017',
    name: "DeepSeek-V4.1-Flash-1017",
    vendor: "深度求索",
    existingInProduction: false,
    releasedAt: '2026-10-16',
    contextWindow: 1000000,
    maxOutputTokens: 1048576,
    description: "DeepSeek-V4.1-Flash-1017 是深度求索（DeepSeek）于 2026年10月17日 发布的轻量级/高性能 AI 模型版本，百万 token 上下文，全新非对称架构，推理吞吐更高、KV 缓存成本大幅降低，综合 Agent、推理性能优于 V4-Pro，API 支持 OpenAI/Anthropic 双协议。词元所将此与未带日期的 deepseek-v4.1-flash 分开挂牌，价格不同，故单独建行。",
    sourceUrl: 'https://cysuo.com/model-market/deepseek-v4.1-flash-1017',
    suppliers: [
      {
        providerId: '1037', providerName: "云间来客",
        resourceId: '780ba028-4bf2-4dd0-ae4e-9221a68a4a02', kind: 'cloud', region: 'guangzhou',
        input: 0.8, output: 3.2, cache: 0.016,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 60, formats: ["anthropic", "openai"],
      },
      {
        providerId: '1043', providerName: "北京贰零贰零科技发展有限公司",
        resourceId: 'ba01f8dc-2829-4da3-a988-1597589e229a', kind: 'cloud', region: 'guangzhou',
        input: 0.8, output: 3.2, cache: 0.016,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 60, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1039', providerName: "金灵狐(深圳)科技有限公司",
        resourceId: 'f79ef17f-41cb-4753-8e06-71f319a26bab', kind: 'cloud', region: 'guangzhou',
        input: 0.84, output: 3.36, cache: 0.0168,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 58, formats: ["openai"],
      },
      {
        providerId: '1038', providerName: "山东惟德数据科技有限公司",
        resourceId: '57739bde-2c71-49a3-8d89-033c196f7e15', kind: 'cloud', region: 'guangzhou',
        input: 0.9, output: 3.6, cache: 0.018,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 55, formats: ["anthropic", "openai"],
      },
      {
        providerId: '1036', providerName: "上海霍蜂科技有限公司",
        resourceId: '2b598c68-635d-4aa1-a32e-6510c9695eab', kind: 'cloud', region: 'guangzhou',
        input: 1, output: 4, cache: 0.02,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 50, formats: ["openai"],
      },
      {
        providerId: '1011', providerName: "北京心智无限科技有限公司",
        resourceId: 'c277017a-a3f3-4579-ac2d-908a8be99c9f', kind: 'cloud', region: 'guangzhou',
        input: 1.2, output: 4.8, cache: 0.024,
        origInput: 2, origOutput: 8, origCache: 0.04,
        savingPercent: 40, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'deepseek-v4-flash',
    name: "DeepSeek-V4-Flash",
    vendor: "深度求索",
    existingInProduction: true,
    releasedAt: '2026-07-30',
    contextWindow: 1000000,
    maxOutputTokens: 393216,
    description: "DeepSeek V4 Flash高效通用模型，侧重快速响应与成本效率，适合问答、摘要、代码及高并发场景。",
    sourceUrl: 'https://cysuo.com/model-market/deepseek-v4-flash',
    suppliers: [
      {
        providerId: '1011', providerName: "北京心智无限科技有限公司",
        resourceId: 'f0acf97b-19b8-4316-b77f-ba18b9398d86', kind: 'cloud', region: 'guangzhou',
        input: 1.5, output: 4.5, cache: 0.05,
        origInput: 3, origOutput: 9, origCache: 0.1,
        savingPercent: 50, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'deepseek-v4-flash-0731',
    name: "DeepSeek-V4-Flash-0731",
    vendor: "深度求索",
    existingInProduction: false,
    releasedAt: '2026-07-30',
    contextWindow: 1000000,
    maxOutputTokens: 393216,
    description: "DeepSeek V4 Flash（0731）高效通用模型，侧重快速响应与成本效率，适合问答、摘要、代码及高并发场景。词元所将此与未带日期的 deepseek-v4-flash 分开挂牌，价格不同，故单独建行。",
    sourceUrl: 'https://cysuo.com/model-market/deepseek-v4-flash-0731',
    suppliers: [
      {
        providerId: '1021', providerName: "博川科技",
        resourceId: '55f505d3-c181-4211-846d-ec24014711ef', kind: 'cloud', region: 'guangzhou',
        input: 1.11, output: 3.33, cache: 0.037,
        origInput: 3, origOutput: 9, origCache: 0.1,
        savingPercent: 63, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1011', providerName: "北京心智无限科技有限公司",
        resourceId: '647cda63-3e45-4231-bad3-6a1dbc5d7c25', kind: 'cloud', region: 'guangzhou',
        input: 1.5, output: 4.5, cache: 0.05,
        origInput: 3, origOutput: 9, origCache: 0.1,
        savingPercent: 50, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'deepseek-v4-pro',
    name: "DeepSeek-V4-Pro",
    vendor: "深度求索",
    existingInProduction: true,
    releasedAt: '2026-08-12',
    contextWindow: 1000000,
    maxOutputTokens: 393216,
    description: "DeepSeek V4 Pro高性能通用模型，强化复杂推理、长文本分析与代码生成，适合高质量任务。",
    sourceUrl: 'https://cysuo.com/model-market/deepseek-v4-pro',
    suppliers: [
      {
        providerId: '1011', providerName: "北京心智无限科技有限公司",
        resourceId: '15dab038-69ca-4b2a-8a3d-31fe22645d24', kind: 'cloud', region: 'guangzhou',
        input: 4.95, output: 14.85, cache: 0.165,
        origInput: 9, origOutput: 27, origCache: 0.3,
        savingPercent: 45, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1021', providerName: "博川科技",
        resourceId: '0bd32cac-def2-470a-983e-6088d53d61a5', kind: 'cloud', region: 'guangzhou',
        input: 6.21, output: 18.63, cache: 0.207,
        origInput: 9, origOutput: 27, origCache: 0.3,
        savingPercent: 31, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'deepseek-v4-pro-0813',
    name: "DeepSeek-V4-Pro-0813",
    vendor: "深度求索",
    existingInProduction: false,
    releasedAt: '2026-08-12',
    contextWindow: 1000000,
    maxOutputTokens: 393216,
    description: "DeepSeek V4 Pro（0813）高性能通用模型，强化复杂推理、长文本分析与代码生成，适合高质量任务。词元所将此与未带日期的 deepseek-v4-pro 分开挂牌，价格不同，故单独建行。",
    sourceUrl: 'https://cysuo.com/model-market/deepseek-v4-pro-0813',
    suppliers: [
      {
        providerId: '1021', providerName: "博川科技",
        resourceId: 'e57e3887-368a-423e-bff1-5af6d4ab7daf', kind: 'cloud', region: 'guangzhou',
        input: 3.33, output: 9.99, cache: 0.111,
        origInput: 9, origOutput: 27, origCache: 0.3,
        savingPercent: 63, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1011', providerName: "北京心智无限科技有限公司",
        resourceId: '7d2f59b1-2315-4bbc-b8b8-500377973f67', kind: 'cloud', region: 'guangzhou',
        input: 4.95, output: 14.85, cache: 0.165,
        origInput: 9, origOutput: 27, origCache: 0.3,
        savingPercent: 45, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'glm-5.1',
    name: "GLM-5.1",
    vendor: "智谱",
    existingInProduction: true,
    releasedAt: '2026-04-07',
    contextWindow: 200000,
    maxOutputTokens: 131072,
    description: "智谱GLM系列通用大模型，强化复杂推理与长文本处理，支持最高约200K上下文及缓存复用。",
    sourceUrl: 'https://cysuo.com/model-market/glm-5.1',
    suppliers: [
      {
        providerId: '1021', providerName: "博川科技",
        resourceId: 'a646c3cc-494d-4078-b6d3-28e0225c78a3', kind: 'cloud', region: 'guangzhou',
        input: 2.88, output: 11.52, cache: 0.288,
        origInput: 6, origOutput: 24, origCache: 0.6,
        savingPercent: 52, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1005', providerName: "智谱",
        resourceId: 'e85389b1-90d9-444e-aed1-ea0dff9dd3df', kind: 'official', region: 'guangzhou',
        input: 6, output: 24, cache: 0.6,
        origInput: 6, origOutput: 24, origCache: 0.6,
        savingPercent: 0, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'glm-5.2',
    name: "GLM-5.2",
    vendor: "智谱",
    existingInProduction: true,
    releasedAt: '2026-06-16',
    contextWindow: 1000000,
    maxOutputTokens: 131072,
    description: "GLM系列通用升级模型，兼顾中文理解、知识问答与复杂任务推理，适合对话、分析和内容生成。",
    sourceUrl: 'https://cysuo.com/model-market/glm-5.2',
    suppliers: [
      {
        providerId: '1021', providerName: "博川科技",
        resourceId: 'aeacde3f-2b31-4c30-9cc4-d45e3a899775', kind: 'cloud', region: 'guangzhou',
        input: 3.36, output: 11.76, cache: 0.84,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 58, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1006', providerName: "北京流金岁月传媒科技股份有限公司",
        resourceId: 'b6060f2b-a46e-4051-8dcd-e1dce179b279', kind: 'cloud', region: 'guangzhou',
        input: 5.6, output: 19.6, cache: 1.4,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 30, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1005', providerName: "智谱",
        resourceId: '838220b2-1f20-4d49-a3bd-8d038c5f5de1', kind: 'official', region: 'guangzhou',
        input: 8, output: 28, cache: 2,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 0, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'glm-5.3',
    name: "GLM-5.3",
    vendor: "智谱",
    existingInProduction: true,
    releasedAt: '2026-08-13',
    contextWindow: 1000000,
    maxOutputTokens: 1000000,
    listedSupplierCount: 12,
    description: "GLM系列高阶通用模型，面向复杂推理、代码与长文本任务，强调准确性、稳定性和综合生成质量。",
    sourceUrl: 'https://cysuo.com/model-market/glm-5.3',
    suppliers: [
      {
        providerId: '1039', providerName: "金灵狐(深圳)科技有限公司",
        resourceId: '07bd6081-578f-4da1-8e74-fbdfb372cf61', kind: 'cloud', region: 'guangzhou',
        input: 3.2, output: 11.2, cache: 0.8,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 60, formats: ["openai"],
      },
      {
        providerId: '1034', providerName: "苏州商软信息技术有限公司",
        resourceId: '522304b8-b5db-4f3b-9c65-1a2cfbbddf60', kind: 'cloud', region: 'guangzhou',
        input: 3.2, output: 11.2, cache: 0.8,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 60, formats: ["openai"],
      },
      {
        providerId: '1045', providerName: "上海词元万相信息科技有限公司",
        resourceId: 'ffd4389a-ef15-4c59-ac1f-2ab45a98ae16', kind: 'cloud', region: 'guangzhou',
        input: 3.36, output: 11.76, cache: 0.84,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 58, formats: ["openai"],
      },
      {
        providerId: '1033', providerName: "中国智慧核心云",
        resourceId: '7ab2d823-0640-4f93-a35c-55d28fd384c6', kind: 'cloud', region: 'guangzhou',
        input: 3.44, output: 12.04, cache: 0.86,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 57, formats: ["anthropic", "openai"],
      },
      {
        providerId: '1032', providerName: "九天智算(汕头)技术有限公司",
        resourceId: '0de00288-898f-4292-b767-5102cc6c9f85', kind: 'cloud', region: 'guangzhou',
        input: 3.6, output: 12.6, cache: 0.9,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 55, formats: ["openai", "anthropic", "native"],
      },
      {
        providerId: '1035', providerName: "杭州水泽乾天科技有限公司",
        resourceId: '2e6afd3a-7a49-4860-a270-ce11e28c9c9a', kind: 'cloud', region: 'guangzhou',
        input: 4, output: 14, cache: 1,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 50, formats: ["anthropic", "openai"],
      },
      {
        providerId: '1041', providerName: "深圳市唯元智创科技有限公司",
        resourceId: '9f6639f0-0a01-4ebf-a253-9e8387209048', kind: 'cloud', region: 'guangzhou',
        input: 4, output: 14, cache: 1,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 50, formats: ["anthropic", "openai"],
      },
      {
        providerId: '1040', providerName: "广州数源畅联科技有限公司",
        resourceId: 'b79edc40-1308-4e9b-b323-31dd166540ef', kind: 'cloud', region: 'guangzhou',
        input: 4, output: 14, cache: 1,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 50, formats: ["anthropic", "openai"],
      },
      {
        providerId: '1021', providerName: "博川科技",
        resourceId: 'b533ec41-6270-4f15-841b-06b92e147703', kind: 'cloud', region: 'guangzhou',
        input: 4.64, output: 16.24, cache: 1.16,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 42, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1042', providerName: "重庆灵境智联网络科技有限公司",
        resourceId: '6e21d4af-b998-428e-b235-88f350f2e2f1', kind: 'cloud', region: 'guangzhou',
        input: 5.2, output: 18.2, cache: 1.3,
        origInput: 8, origOutput: 28, origCache: 2,
        savingPercent: 35, formats: ["openai"],
      },
    ],
  },
  {
    slug: 'glm-5.3-flash',
    name: "GLM-5.3-Flash",
    vendor: "智谱",
    existingInProduction: true,
    releasedAt: '2026-08-25',
    contextWindow: 1000000,
    maxOutputTokens: 131072,
    description: "GLM-5.3轻量高速版本，兼顾通用问答与推理能力，低延迟、低成本，适合高并发调用。",
    sourceUrl: 'https://cysuo.com/model-market/glm-5.3-flash',
    suppliers: [
      {
        providerId: '1040', providerName: "广州数源畅联科技有限公司",
        resourceId: 'd802632c-60a6-4666-bbc5-81ef34174055', kind: 'cloud', region: 'guangzhou',
        input: 0.4, output: 1.4, cache: 0.115,
        origInput: 0.8, origOutput: 2.8, origCache: 0.23,
        savingPercent: 50, formats: ["anthropic", "openai"],
      },
      {
        providerId: '1042', providerName: "重庆灵境智联网络科技有限公司",
        resourceId: '2d003352-9b7c-422a-8e7d-8b53de75d309', kind: 'cloud', region: 'guangzhou',
        input: 0.52, output: 1.82, cache: 0.1495,
        origInput: 0.8, origOutput: 2.8, origCache: 0.23,
        savingPercent: 35, formats: ["openai"],
      },
      {
        providerId: '1008', providerName: "杭州构你想象网络科技有限公司",
        resourceId: 'b0e252d2-5af6-4751-952e-5cc4b0149341', kind: 'cloud', region: 'guangzhou',
        input: 0.6, output: 2.1, cache: 0.1725,
        origInput: 0.8, origOutput: 2.8, origCache: 0.23,
        savingPercent: 25, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1005', providerName: "智谱",
        resourceId: '5a828b69-f1af-41fd-98f3-6f590450e6db', kind: 'official', region: 'guangzhou',
        input: 0.8, output: 2.8, cache: 0.23,
        origInput: 0.8, origOutput: 2.8, origCache: 0.23,
        savingPercent: 0, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'kimi-k3',
    name: "Kimi K3",
    vendor: "月之暗面",
    existingInProduction: true,
    releasedAt: '2026-07-15',
    contextWindow: 1000000,
    maxOutputTokens: 131072,
    description: "Kimi K3 是月之暗面旗舰多模态大模型，百万 Token 超长上下文，原生图文视频理解，自带深度推理能力，适配长文档、代码、复杂智能体场景。",
    sourceUrl: 'https://cysuo.com/model-market/kimi-k3',
    suppliers: [
      {
        providerId: '1041', providerName: "深圳市唯元智创科技有限公司",
        resourceId: '7f88e527-c5f9-4f6e-9277-33d070bf71ae', kind: 'cloud', region: 'guangzhou',
        input: 12, output: 60, cache: 1.2,
        origInput: 20, origOutput: 100, origCache: 2,
        savingPercent: 40, formats: ["anthropic", "openai"],
      },
      {
        providerId: '1042', providerName: "重庆灵境智联网络科技有限公司",
        resourceId: '8aa78a38-7c88-4c5a-96d6-1688c2d9a286', kind: 'cloud', region: 'guangzhou',
        input: 13, output: 65, cache: 1.3,
        origInput: 20, origOutput: 100, origCache: 2,
        savingPercent: 35, formats: ["openai"],
      },
      {
        providerId: '1004', providerName: "广州烽云信息科技有限公司",
        resourceId: 'a821d466-4de8-49b0-aa34-e0e06128164e', kind: 'cloud', region: 'guangzhou',
        input: 15, output: 75, cache: 1.5,
        origInput: 20, origOutput: 100, origCache: 2,
        savingPercent: 25, formats: ["openai", "anthropic"],
      },
      {
        providerId: '1002', providerName: "cloudsway，pte.ltd",
        resourceId: 'f2f11931-9cda-47be-99e8-9f96e5d4251d', kind: 'cloud', region: 'guangzhou',
        input: 15, output: 75, cache: 1.5,
        origInput: 20, origOutput: 100, origCache: 2,
        savingPercent: 25, formats: ["openai", "anthropic"],
      },
    ],
  },
  {
    slug: 'ernie-5.1',
    name: "ERNIE-5.1",
    vendor: "百度智能云",
    existingInProduction: true,
    releasedAt: '2026-05-08',
    contextWindow: 128000,
    maxOutputTokens: 65536,
    description: "ERNIE 5.1是文心系列最新模型，基础能力全面升级，在智能体、知识、推理、深度搜索等方面均有显著提升。",
    sourceUrl: 'https://cysuo.com/model-market/ernie-5.1',
    suppliers: [
      {
        providerId: '1013', providerName: "千帆maas平台",
        resourceId: '7f6a1fd3-dcef-48a3-af54-ae713f339b08', kind: 'official', region: 'guangzhou',
        input: 4, output: 18, cache: null,
        origInput: 4, origOutput: 18, origCache: null,
        savingPercent: 0, formats: ["openai", "anthropic"],
      },
    ],
  },
];

export const variantKey = (providerId: string) => `supplier-${providerId}`;

export function headlineSupplier(suppliers: readonly SupplierListing[]): SupplierListing {
  return [...suppliers].sort((a, b) => a.output - b.output || a.input - b.input)[0]!;
}

export function supplierNote(listing: ModelListing, supplier: SupplierListing): string {
  const origCache = supplier.origCache == null ? 'n/a' : String(supplier.origCache);
  const cache = supplier.cache == null ? 'n/a' : String(supplier.cache);
  const formats = supplier.formats.length ? supplier.formats.join('/') : '未标注';
  return evidence(
    [
      `${supplier.providerName}（词元所 providerId ${supplier.providerId}，${supplier.kind}，${supplier.region}）挂牌 ${listing.slug}。`,
      `当前价 input/output/cache = ${supplier.input}/${supplier.output}/${cache} CNY / 百万 Token。`,
      `页面对照原价 ${supplier.origInput}/${supplier.origOutput}/${origCache}，标注节省 ${supplier.savingPercent}%。`,
      `支持协议：${formats}。价格口径：含税，为各供应商当前标价。`,
    ].join(' '),
    [listing.sourceUrl],
  );
}

export function channelNote(listing: ModelListing, headline: SupplierListing): string {
  const extra = listing.listedSupplierCount && listing.listedSupplierCount > listing.suppliers.length
    ? ` 详情页摘要 vendorCount=${listing.listedSupplierCount}，但本次能从页面读到完整输入/输出价的供应商为 ${listing.suppliers.length} 家，其余未入库。`
    : '';
  return evidence(
    `${CHANNEL_NOTE_PREFIX} 标杆挂牌为 ${headline.providerName}（${variantKey(headline.providerId)}）。${extra}`.trim(),
    [listing.sourceUrl, AGREEMENT_URL],
  );
}

/** Production-shaped dry-run: cysuo is absent; the 9 catalog slugs already exist; the 3 dated cysuo-only slugs do not. */
export const PRODUCTION_SHAPED_DRY_RUN = {
  providers: { insert: 1, update: 0 },
  models: { insert: 3, update: 9 },
  api_channel_prices: { insert: 12, update: 0 },
  api_channel_price_variants: { insert: 42, update: 0 },
} as const;

export const EXISTING_PRODUCTION_SLUGS = LISTINGS.filter(row => row.existingInProduction).map(row => row.slug);
export const NEW_PRODUCTION_SLUGS = LISTINGS.filter(row => !row.existingInProduction).map(row => row.slug);

export function catalog20261112CysuoSeedOptions(args: string[]) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg)) || (args.includes('--apply') && args.includes('--dry-run'))) {
    throw new Error('Usage: seed-catalog-2026-11-12-cysuo.ts [--dry-run | --apply]');
  }
  return { apply: args.includes('--apply') };
}

type Row = Record<string, unknown> & { id: number };
export interface Step {
  table: Table;
  target: string;
  action: 'insert' | 'update' | 'skip';
  changes: ReturnType<typeof seedChanges>;
  reason?: string;
}

export function seedStepCounts(steps: Step[]) {
  return Object.fromEntries(SEED_TABLES.map(table => {
    const own = steps.filter(step => step.table === table);
    return [table, {
      insert: own.filter(step => step.action === 'insert').length,
      update: own.filter(step => step.action === 'update').length,
    }];
  })) as Record<Table, { insert: number; update: number }>;
}

const isFresh = (row: Row | null) =>
  !!row?.last_verified && new Date(String(row.last_verified)).getTime() > VERIFIED_AT.getTime();

export async function seedCatalog20261112Cysuo(tx: Sql, apply = false): Promise<Step[]> {
  const fail = (why: string): never => { throw new Error(`${why}; nothing written.`); };
  const one = (rows: Row[], target: string): Row | null => {
    if (rows.length > 1) fail(`Ambiguous ${target} (${rows.length} rows)`);
    return rows[0] ?? null;
  };

  const blocked = await tx<Row[]>`SELECT * FROM providers WHERE slug IN ${tx([...BAIDU_SLUGS])}`;
  // Presence is expected; this seed must never update those rows.
  void blocked;

  const existingProvider = one(
    await tx<Row[]>`SELECT * FROM providers WHERE slug = ${PROVIDER_SLUG}`,
    `providers/${PROVIDER_SLUG}`,
  );
  if (existingProvider && String(existingProvider.type) !== 'aggregator') {
    fail(`providers/${PROVIDER_SLUG} has type ${String(existingProvider.type)}`);
  }

  const steps: Step[] = [];
  const pending: { table: Table; existing: Row | null; values: Record<string, unknown>; id: number }[] = [];
  let previewId = -1;
  const save = (table: Table, row: Row | null, desired: Record<string, unknown>, target: string): Row => {
    if ((table === 'api_channel_prices' || table === 'api_channel_price_variants') && isFresh(row)) {
      return row!;
    }
    const changes = seedChanges(row, desired);
    if (!Object.keys(changes).length) return row ?? { ...desired, id: row?.id ?? previewId } as Row;
    const id = row?.id ?? previewId--;
    steps.push({ table, target, action: row ? 'update' : 'insert', changes });
    pending.push({ table, existing: row, values: desired, id });
    return { ...row, ...desired, id };
  };

  const cysuo = save('providers', existingProvider, {
    slug: PROVIDER_SLUG,
    name: '词元所',
    type: 'aggregator',
    region: 'china',
    currency: 'CNY',
    website: SITE_URL,
    pricing_url: MARKET_URL,
    api_docs_url: API_GUIDE_URL,
    logo_url: LOGO_URL,
    access_from_china: true,
    supported_regions: null,
    regions_source_url: null,
    regions_verified_at: null,
    priority: 2,
    notes: PROVIDER_NOTES,
  }, PROVIDER_SLUG);

  const slugs = LISTINGS.map(row => row.slug);
  const models = slugs.length
    ? await tx<Row[]>`SELECT * FROM models WHERE slug IN ${tx(slugs)}`
    : [];

  for (const listing of LISTINGS) {
    if (!listing.suppliers.length) fail(`${listing.slug} has no verified supplier prices`);
    const ids = new Set(listing.suppliers.map(row => row.providerId));
    if (ids.size !== listing.suppliers.length) fail(`${listing.slug} has duplicate supplier ids`);
    const existing = one(models.filter(row => row.slug === listing.slug), `models/${listing.slug}`);
    const ownerIds = [...new Set([
      ...((existing?.provider_ids as number[] | undefined) ?? []),
      cysuo.id,
    ])];
    const model = existing
      ? save('models', existing, { provider_ids: ownerIds }, listing.slug)
      : save('models', null, {
        slug: listing.slug,
        name: listing.name,
        type: 'llm',
        model_category: 'text',
        provider_ids: ownerIds,
        context_window: listing.contextWindow,
        max_output_tokens: listing.maxOutputTokens,
        open_source: null,
        released_at: new Date(`${listing.releasedAt}T00:00:00Z`),
        input_type: ['text'],
        output_type: ['text'],
        input_modalities: ['text'],
        output_modalities: ['text'],
        pricing_unit: 'per_1m_tokens',
        offical_link: listing.sourceUrl,
        description: `${listing.description} 词元所页面标注上下文 ${listing.contextWindow === 1_000_000 ? '1000K/1M' : listing.contextWindow === 128_000 ? '128K' : '200K'}，最大输出 ${listing.maxOutputTokens} tokens。海外可用性未核实。`,
      }, listing.slug);

    const headline = headlineSupplier(listing.suppliers);
    const channels = (model.id > 0 && cysuo.id > 0)
      ? await tx<Row[]>`SELECT * FROM api_channel_prices WHERE model_id = ${model.id} AND provider_id = ${cysuo.id}`
      : [];
    const channel = one(channels, `api_channel_prices/cysuo/${listing.slug}`);
    save('api_channel_prices', channel, retainLockedUnavailable({
      model_id: model.id,
      provider_id: cysuo.id,
      input_price_per_1m: headline.input,
      output_price_per_1m: headline.output,
      cached_input_price_per_1m: headline.cache,
      currency: 'CNY',
      price_unit: 'per_1m_tokens',
      is_available: true,
      last_verified: VERIFIED_AT,
      notes: channelNote(listing, headline),
    }, channel), `cysuo/${listing.slug}`);

    const variants = (model.id > 0 && cysuo.id > 0)
      ? await tx<Row[]>`SELECT * FROM api_channel_price_variants WHERE model_id = ${model.id} AND provider_id = ${cysuo.id}`
      : [];
    const owned = new Set(listing.suppliers.map(row => variantKey(row.providerId)));
    for (const row of variants.filter(variant => variant.is_headline === true && !owned.has(String(variant.variant_key)))) {
      save('api_channel_price_variants', row, { is_headline: false, headline_rank: null, headline_reason: null }, String(row.variant_key));
    }
    for (const [index, supplier] of listing.suppliers.entries()) {
      const key = variantKey(supplier.providerId);
      const current = one(variants.filter(row => row.variant_key === key), `api_channel_price_variants/${listing.slug}/${key}`);
      const isHeadline = supplier.providerId === headline.providerId;
      save('api_channel_price_variants', current, retainLockedUnavailable({
        model_id: model.id,
        provider_id: cysuo.id,
        variant_key: key,
        variant_name: supplier.providerName,
        variant_kind: 'upstream_provider',
        source_group_key: supplier.providerId,
        source_group_name: supplier.providerName,
        source_url: listing.sourceUrl,
        input_price_per_1m: supplier.input,
        output_price_per_1m: supplier.output,
        cached_input_price_per_1m: supplier.cache,
        currency: 'CNY',
        price_unit: 'per_1m_tokens',
        is_available: true,
        is_public: true,
        is_self_service: true,
        is_partner_only: false,
        is_headline: isHeadline,
        headline_rank: isHeadline ? 0 : index + 1,
        headline_reason: isHeadline
          ? '词元所详情页「最低可用价」对应的最低输出价挂牌（同输出再取最低输入价）'
          : null,
        constraints_json: {
          cysuo_model_id: listing.slug,
          cysuo_provider_id: supplier.providerId,
          cysuo_resource_id: supplier.resourceId,
          region: supplier.region,
          kind: supplier.kind,
          supported_formats: supplier.formats,
        },
        notes: supplierNote(listing, supplier),
        last_verified: VERIFIED_AT,
      }, current), `cysuo/${listing.slug}/${key}`);
    }
  }

  if (apply) {
    const ids = new Map<number, number>();
    const resolveId = (id: unknown) => typeof id === 'number' && id < 0 ? ids.get(id)! : id;
    for (const op of pending) {
      const payload = { ...op.values };
      if ('model_id' in payload) payload.model_id = resolveId(payload.model_id);
      if ('provider_id' in payload) payload.provider_id = resolveId(payload.provider_id);
      if ('provider_ids' in payload && Array.isArray(payload.provider_ids)) {
        payload.provider_ids = payload.provider_ids.map(resolveId);
      }
      if (op.existing) {
        await tx`UPDATE ${tx(op.table)} SET ${tx(payload, ...Object.keys(payload))} WHERE id = ${op.existing.id}`;
      } else {
        const [inserted] = await tx<Row[]>`INSERT INTO ${tx(op.table)} ${tx(payload, ...Object.keys(payload))} RETURNING id`;
        ids.set(op.id, inserted.id);
      }
    }
  }
  return steps;
}
