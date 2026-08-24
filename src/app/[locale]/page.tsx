import { getProducts } from "@/lib/products";
import { faqPage, type Locale } from "@/lib/seo";
import HomeView, { type HotModel } from "./home-view";

/**
 * Server component — see home-view.tsx. The hot-model cards were fetched from
 * /api/products in an effect, so the homepage went out with its four internal
 * links to /compare/plans/[model] missing from the HTML.
 */

type FaqItem = { question: string; answer: string };

function homeFaqs(locale: Locale, hotCount: number): FaqItem[] {
  if (locale === "zh") {
    return [
      {
        question: "aiplans.dev 能对比哪些价格？",
        answer:
          "两类：一是同一 AI 模型在不同 API 渠道的按量计费价格（官方、云厂商、聚合渠道、分销商），二是 ChatGPT、Claude、Gemini、Kimi、GLM 等订阅套餐（免费/Pro/团队/企业）与年付折扣。所有价格按各渠道本币报价后统一折算美元对比。",
      },
      {
        question: "API 按量计费和订阅套餐有什么区别，该怎么选？",
        answer:
          "API 按 token 用量计费，适合把模型接入自有应用；订阅套餐按月/年付费，适合在官方或第三方 App 中日常使用。用量大可对比 API 各渠道单价，日常对话则看订阅套餐的档位、消息限额和包含模型。",
      },
      {
        question: "在中国大陆能使用这些渠道吗？",
        answer:
          "本站为每个渠道标注是否支持中国大陆直连，并提供“中国直连”筛选。国内厂商与部分聚合渠道可直连并支持支付宝/微信支付；国际官方渠道通常需要代理或 VPN。",
      },
      {
        question: "这些价格数据多久更新、准确吗？",
        answer:
          "API 价格每小时、套餐价格每日从官方页面与各渠道自动抓取，显著变动记入价格历史；每日只读数据审计交叉核对各渠道与模型生产方的官方价，发现过期或异常行会标记并修正。",
      },
      ...(hotCount > 0
        ? [
            {
              question: "从哪里开始对比？",
              answer:
                "可从热门模型入口查看某模型的全部订阅套餐，或进入“API 价格”页按价格、地区、渠道类型筛选全部模型；每个模型还有独立详情页汇总各渠道单价、Arena 评分与订阅方案。",
            },
          ]
        : []),
    ];
  }
  return [
    {
      question: "What can I compare on aiplans.dev?",
      answer:
        "Two things: metered API prices for the same AI model across channels (official, cloud, aggregators, resellers), and subscription plans for ChatGPT, Claude, Gemini, Kimi, GLM and more — free, pro, team and enterprise tiers with annual discounts. Every price is read in the channel's own currency then normalised to USD for comparison.",
    },
    {
      question: "What is the difference between metered API pricing and a subscription plan?",
      answer:
        "APIs charge per token and suit integrating a model into your own app; subscriptions bill monthly or annually for day-to-day use in an official or third-party app. For high volume, compare per-channel API unit prices; for everyday chat, compare plan tiers, message limits and the models each plan includes.",
    },
    {
      question: "Can I use these channels from mainland China?",
      answer:
        "Every channel is flagged for direct mainland-China access, with a filter to show only those channels. Domestic producers and some aggregators are directly reachable and support Alipay/WeChat Pay; international official channels normally require a proxy or VPN.",
    },
    {
      question: "How up to date and accurate is the pricing data?",
      answer:
        "API prices are scraped hourly and plan prices daily from official pages and every tracked channel, with significant changes recorded in a price-history log. A daily read-only audit cross-checks each channel against the model producer's published price and flags stale or inconsistent rows for correction.",
    },
    ...(hotCount > 0
      ? [
          {
            question: "Where should I start?",
            answer:
              "Open a popular model to see every subscription plan that includes it, or go to API pricing to filter all models by price, region and channel type. Each model also has its own detail page summarising per-channel unit prices, Arena scores and subscription options.",
          },
        ]
      : []),
  ];
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = (locale === "zh" ? "zh" : "en") as Locale;

  let hotModels: HotModel[] = [];
  try {
    hotModels = (await getProducts({
      type: "llm",
      featured: true,
      includePlanCount: true,
    })) as HotModel[];
  } catch (err) {
    // The rest of the landing page is static copy and is worth serving even if
    // the database is unreachable — which is what the old effect's .catch did.
    console.error("home: failed to load hot models", err);
  }

  const faqs = homeFaqs(loc, hotModels.length);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqPage(faqs) }}
      />
      <HomeView locale={locale} hotModels={hotModels} faqs={faqs} />
    </>
  );
}
