/**
 * The compare-models FAQ. Used twice so the visible answers and the
 * FAQPage JSON-LD never drift apart:
 *  - rendered visibly in compare-models-view.tsx
 *  - serialized as FAQPage JSON-LD by page.tsx
 *
 * These are evergreen explanatory answers (how cross-currency comparison
 * works, what "best value" means) rather than per-model facts, so they do
 * not need a runtime payload.
 */
export type FaqItem = { question: string; answer: string };

export const FAQS: Record<'en' | 'zh', FaqItem[]> = {
  en: [
    {
      question: 'Which AI model is the best value for API usage?',
      answer:
        'It depends on your task. For high-volume, latency-tolerant workloads, open models like DeepSeek and Qwen on aggregator channels are often the cheapest per 1M tokens; frontier models like Claude Opus and the GPT series cost more but lead on Agent Arena performance. Use this page to compare the cheapest available channel price of each model side by side — prices are normalised to USD for comparison but displayed in each channel’s own currency.',
    },
    {
      question: 'How are API token prices compared across channels and currencies?',
      answer:
        'Every channel price is converted to USD using cached exchange rates before taking the minimum, so a ¥3/1M CNY channel is correctly ranked against a $0.78/1M USD channel. The cheapest input price determines the recommended channel; output and cached-input prices are shown alongside. The "vs Official" row shows how much cheaper (or dearer) that channel is versus the model producer’s own API.',
    },
    {
      question: 'How many models can I compare at once?',
      answer:
        'You can compare between two and four models side by side. Pick them from the search box, or share the URL — the ?models= slug list preselects the same comparison for whoever opens it.',
    },
  ],
  zh: [
    {
      question: '哪款 AI 模型的 API 性价比最高？',
      answer:
        '取决于你的任务。对高并发、对延迟不敏感的场景，DeepSeek、通义千问等开源模型在聚合渠道上每百万 token 通常最便宜；Claude Opus、GPT 系列等前沿模型价格更高但在 Agent Arena 性能上领先。在本页横向对比各模型的最便宜渠道价格——比较时统一折算为美元，但展示时保留各渠道的原始货币。',
    },
    {
      question: '不同渠道、不同货币的 API token 价格是怎么对比的？',
      answer:
        '每个渠道价格在取最小值前都会按缓存汇率换算成美元，因此 ¥3/1M 的人民币渠道会被正确地与 $0.78/1M 的美元渠道排序。以最便宜的输入价作为推荐渠道，并同时展示输出价和缓存输入价。“对比官方”一行显示该渠道相对模型厂商官方 API 便宜（或更贵）的百分比。',
    },
    {
      question: '一次最多能对比几个模型？',
      answer:
        '可以同时对比 2 到 4 个模型。在搜索框中选择即可；也可以直接分享 URL——?models= 的 slug 列表会为打开链接的人预先选中同一组对比。',
    },
  ],
};
