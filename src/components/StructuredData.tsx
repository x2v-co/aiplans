'use client';

import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface StructuredDataProps {
  type: 'breadcrumb' | 'faq' | 'organization' | 'website';
  data?: BreadcrumbItem[] | FAQItem[];
  locale?: string;
}

// FAQ data for different pages
type FAQData = Record<string, Record<string, FAQItem[]>>;

export const faqData: FAQData = {
  'api-pricing': {
    en: [
      {
        question: 'What is the cheapest GPT-4 API provider?',
        answer: 'The cheapest GPT-4 API provider varies by region. Generally, Chinese providers like SiliconFlow (硅基流动) and Volcano Engine (火山引擎) offer competitive pricing, often 30-50% lower than official OpenAI pricing.'
      },
      {
        question: 'How to compare AI API prices across different providers?',
        answer: 'You can use aiplans.dev to compare AI API prices across providers. We track prices from official APIs, cloud providers (AWS, Azure, Google Cloud), and aggregators (OpenRouter, SiliconFlow) in real-time.'
      },
      {
        question: 'Which AI API is best for China access?',
        answer: 'For China access, we recommend domestic providers like 智谱AI (Zhipu), 通义千问 (Qwen), Kimi, or混元 (Hunyuan). Some international providers like OpenRouter also work in China via proxy.'
      }
    ],
    zh: [
      {
        question: '哪个 GPT-4 API 提供商最便宜？',
        answer: '最便宜的 GPT-4 API 提供商因地区而异。一般来说，国内提供商如硅基流动和火山引擎提供有竞争力的价格，通常比官方 OpenAI 价格低 30-50%。'
      },
      {
        question: '如何比较不同提供商的 AI API 价格？',
        answer: '您可以使用 aiplans.dev 比较不同提供商的 AI API 价格。我们实时追踪官方 API、云提供商（AWS、Azure、Google Cloud）和聚合平台（OpenRouter、硅基流动）的价格。'
      },
      {
        question: '哪个 AI API 最适合国内访问？',
        answer: '对于国内访问，我们推荐国内提供商如智谱AI、通义千问、Kimi 或混元。一些国际提供商如 OpenRouter 也可通过代理在中国使用。'
      }
    ]
  },
  'compare/plans': {
    en: [
      {
        question: 'What is the best AI subscription plan?',
        answer: 'The best AI subscription plan depends on your usage. For heavy users, ChatGPT Pro ($200/month) or Claude Pro offer unlimited access. For light users, free tiers or Plus plans ($20/month) are sufficient.'
      },
      {
        question: 'Is Claude Pro better than ChatGPT Plus?',
        answer: 'Claude Pro and ChatGPT Plus excel in different areas. Claude often performs better at coding and long-form writing, while ChatGPT is better at general conversation and plugin ecosystem. Try both to see which fits your needs.'
      },
      {
        question: 'How much does AI API cost per month?',
        answer: 'AI API costs vary widely. At standard rates, GPT-4o costs ~$15/million input tokens. A typical user spending 100K tokens/month would pay around $1.5/month for API usage.'
      }
    ],
    zh: [
      {
        question: '最好的 AI 订阅套餐是什么？',
        answer: '最好的 AI 订阅套餐取决于您的使用量。对于重度用户，ChatGPT Pro（200美元/月）或 Claude Pro 提供无限访问。对于轻度用户，免费版本或 Plus 套餐（20美元/月）就足够了。'
      },
      {
        question: 'Claude Pro 比 ChatGPT Plus 更好吗？',
        answer: 'Claude Pro 和 ChatGPT Plus 在不同方面表现出色。Claude 通常在编程和长篇写作方面表现更好，而 ChatGPT 在一般对话和插件生态系统方面更好。建议两者都尝试一下，看看哪个更适合您。'
      },
      {
        question: 'AI API 每月多少钱？',
        answer: 'AI API 费用差异很大。在标准费率下，GPT-4o 的输入费用约为 15 美元/百万 tokens。典型用户每月使用 100K tokens 只需支付约 1.5 美元/月的 API 费用。'
      }
    ]
  },
  coupons: {
    en: [
      {
        question: 'How to get AI service discount codes?',
        answer: 'You can find verified AI service discount codes on aiplans.dev/coupons. Community members submit codes, and users vote on their validity. Look for verified codes with high votes.'
      },
      {
        question: 'Are AI coupon codes reliable?',
        answer: 'Not all coupon codes work. We verify codes through community reports. Look for codes marked as "verified" with recent confirmation dates.'
      }
    ],
    zh: [
      {
        question: '如何获取 AI 服务折扣码？',
        answer: '您可以在 aiplans.dev/coupons 找到经过验证的 AI 服务折扣码。社区成员提交代码，用户投票确认其有效性。寻找经过验证且高票数的代码。'
      },
      {
        question: 'AI 折扣码可靠吗？',
        answer: '并非所有折扣码都能使用。我们通过社区报告验证代码。寻找标记为"已验证"且有最近确认日期的代码。'
      }
    ]
  }
};

// Generate breadcrumb based on current path
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', url: 'https://aiplans.dev' }
  ];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const name = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    breadcrumbs.push({
      name,
      url: `https://aiplans.dev${currentPath}`
    });
  }

  return breadcrumbs;
}

export function StructuredData({ type, data, locale = 'en' }: StructuredDataProps) {
  const pathname = usePathname();

  const getStructuredData = () => {
    const isZh = locale === 'zh';

    switch (type) {
      case 'breadcrumb':
        const breadcrumbs = data as BreadcrumbItem[] || generateBreadcrumbs(pathname);
        return {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": breadcrumbs.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": item.url
          }))
        };

      case 'faq':
        const faqKey = pathname.split('/')[2] || 'default';
        const faqs = (faqData[faqKey]?.[isZh ? 'zh' : 'en'] || faqData['api-pricing'][isZh ? 'zh' : 'en']) as FAQItem[];
        return {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs?.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.answer
            }
          }))
        };

      case 'organization':
        return {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "aiplans.dev",
          "url": "https://aiplans.dev",
          "logo": "https://aiplans.dev/logo.png",
          "description": isZh
            ? "全网最专业的 AI 价格对比平台"
            : "The most comprehensive AI pricing comparison platform",
          "sameAs": [
            "https://github.com/x2v-co/aiplans"
          ]
        };

      case 'website':
        return {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": isZh ? "aiplans.dev - 全网AI价格对比" : "aiplans.dev - AI Pricing Comparison",
          "description": isZh
            ? "对比 GPT-4、Claude、DeepSeek、通义千问等 AI 模型价格"
            : "Compare AI model pricing across providers",
          "url": "https://aiplans.dev",
          "potentialAction": {
            "@type": "SearchAction",
            "target": {
              "@type": "EntryPoint",
              "urlTemplate": "https://aiplans.dev/{search_term_string}"
            },
            "query-input": "required name=search_term_string"
          },
          "inLanguage": isZh ? "zh-CN" : "en-US"
        };

      default:
        return null;
    }
  };

  const structuredData = getStructuredData();

  if (!structuredData) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData)
      }}
    />
  );
}

// Hook to get breadcrumb data for current page
export function useBreadcrumbs(pathname: string): BreadcrumbItem[] {
  return generateBreadcrumbs(pathname);
}
