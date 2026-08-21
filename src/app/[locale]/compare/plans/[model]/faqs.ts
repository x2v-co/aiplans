/**
 * The per-model plan comparison FAQ. Used twice:
 *  - rendered visibly in compare-plans-view.tsx
 *  - serialized as FAQPage JSON-LD by this route's layout.tsx
 *
 * Keep the visible answers and the JSON-LD in lockstep by sourcing both from
 * this single array.
 */
export type FaqItem = { question: string; answer: string };

export const FAQS: Record<'en' | 'zh', FaqItem[]> = {
  en: [
    {
      question: 'How to choose the best subscription plan?',
      answer:
        "When choosing a subscription plan, consider your usage scenarios, budget, and required features. If you're a light user, Free or Basic plans may be sufficient; if you need higher rate limits and advanced features, Pro or Enterprise plans are recommended.",
    },
    {
      question: "What's the difference between yearly and monthly billing?",
      answer:
        'Yearly plans are typically 15-20% cheaper than monthly plans, suitable for long-term users. Monthly plans are more flexible and can be cancelled or changed at any time.',
    },
    {
      question: 'How can China-based users pay?',
      answer:
        'Some providers support Alipay and WeChat Pay. You can check the supported payment methods in the plan details. Third-party channels like SiliconFlow and Volcano Engine typically support domestic payments.',
    },
  ],
  zh: [
    {
      question: '如何选择最合适的订阅计划？',
      answer:
        '选择订阅计划时，请考虑您的使用场景、预算和所需功能。如果您是轻度用户，Free或Basic计划可能足够；如果您需要更高限速和高级功能，建议选择Pro或Enterprise计划。',
    },
    {
      question: '年付和月付有什么区别？',
      answer:
        '年付计划通常比月付计划便宜15-20%，适合长期使用的用户。月付计划更灵活，可以随时取消或更换计划。',
    },
    {
      question: '国内用户如何支付？',
      answer:
        '部分提供商支持支付宝和微信支付。您可以在计划详情中查看支持的支付方式。第三方渠道如硅基流动、火山引擎等通常支持国内支付。',
    },
  ],
};
