import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { buildMetadata, type Locale } from '@/lib/seo';

type InfoSlug = 'about' | 'contact' | 'disclosure' | 'methodology' | 'privacy' | 'terms';
type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };
type PageContent = { title: string; description: string; intro: string; sections: Section[] };

const UPDATED = 'September 3, 2026';
const UPDATED_ZH = '2026 年 9 月 3 日';

const content: Record<Locale, Record<InfoSlug, PageContent>> = {
  en: {
    about: {
      title: 'About aiplans.dev',
      description: 'Who operates aiplans.dev and why we compare AI API and subscription pricing.',
      intro: 'aiplans.dev is an independent pricing comparison product operated by x2v, an independent AI product studio.',
      sections: [
        { heading: 'What we do', paragraphs: ['We collect public pricing and plan information from AI providers, cloud platforms, aggregators, and resellers. We normalize those facts into comparable units so developers and teams can make informed purchasing decisions.'] },
        { heading: 'Editorial independence', paragraphs: ['Price order, comparison results, and recommendations are based on published data and product rules. Commercial relationships do not buy a better ranking. Sponsored placements, if introduced, will be labeled clearly.'] },
        { heading: 'Open development', paragraphs: ['The application source and public issue tracker are available on GitHub. Corrections are welcome when a provider changes a price, plan, or availability condition.'] },
      ],
    },
    contact: {
      title: 'Contact',
      description: 'Contact aiplans.dev about pricing corrections, privacy, partnerships, or technical issues.',
      intro: 'The fastest way to reach the aiplans.dev team is through the public GitHub issue tracker.',
      sections: [
        { heading: 'Pricing corrections', paragraphs: ['Report the model or plan URL, the value that appears incorrect, and a link to the provider source. Do not include account credentials, billing records, or other private information.'] },
        { heading: 'Privacy requests', paragraphs: ['For a private privacy or data request, contact x2v through its website and identify aiplans.dev in your message. We may need enough information to understand the request, but we will never ask for a password or API key.'] },
        { heading: 'Partnerships', paragraphs: ['Commercial and affiliate proposals are reviewed separately from editorial data. A commercial relationship cannot change price calculations or comparison rankings.'] },
      ],
    },
    disclosure: {
      title: 'Affiliate and Advertising Disclosure',
      description: 'How affiliate links, sponsorships, and advertising may support aiplans.dev.',
      intro: 'aiplans.dev may earn compensation from some outbound links or clearly labeled advertising, at no additional cost to the user.',
      sections: [
        { heading: 'Affiliate links', paragraphs: ['Some links to AI providers may contain referral parameters. If a user signs up or purchases through one of those links, aiplans.dev may receive a commission or account credit.'] },
        { heading: 'Ranking independence', paragraphs: ['Compensation does not determine model rankings, cheapest-price calculations, benchmark values, or inclusion in comparison tables. These results are generated from the same published data rules for every provider.'] },
        { heading: 'Advertising', paragraphs: ['Advertising, if enabled, will be visually distinguishable from pricing data and controls. Ads will not be placed in a way that suggests they are a provider ranking, a download button, or a required navigation action.'] },
        { heading: 'Verify before buying', paragraphs: ['Provider prices, availability, taxes, and promotions can change. Confirm the final terms on the provider website before purchasing.'] },
      ],
    },
    methodology: {
      title: 'Pricing Methodology',
      description: 'How aiplans.dev collects, normalizes, verifies, and presents AI pricing data.',
      intro: 'Our comparisons separate source facts from calculations and make the comparison baseline explicit.',
      sections: [
        { heading: 'Sources', paragraphs: ['We prioritize official pricing pages and documentation. Cloud platforms, aggregators, and resellers are tracked as distinct channels rather than presented as the model producer.'] },
        { heading: 'Normalization', bullets: ['API prices are shown per one million tokens when the source supports token billing.', 'Native currency remains visible; USD-normalized values are used for cross-currency ordering and savings calculations.', 'Subscription prices keep their billing period and annual discount assumptions visible.', '“Official baseline” means the lowest tracked official or producer channel, not the cheapest channel overall.'] },
        { heading: 'Updates and checks', paragraphs: ['Automated collectors run regularly and a read-only audit flags missing, stale, zero, inverted, or unusual prices. Automation can still be wrong, so every purchase decision should be checked against the linked source.'] },
        { heading: 'Benchmarks', paragraphs: ['Benchmark scores are comparison signals, not guarantees of quality for every task. The benchmark name and scoring context are kept separate from price calculations.'] },
        { heading: 'Corrections', paragraphs: ['Corrections can be submitted through GitHub with a source URL. Material price changes are kept in the project price-history data where available.'] },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      description: 'How aiplans.dev handles analytics, cookies, advertising, outbound clicks, and privacy choices.',
      intro: `Last updated: ${UPDATED}. This policy explains the limited information processed when you use aiplans.dev.`,
      sections: [
        { heading: 'Information we process', bullets: ['Language and privacy preferences stored in your browser.', 'Standard hosting and security logs, which may include IP address, browser details, requested URL, and time of access.', 'Aggregate referral events containing the campaign, source, product, and timestamp. The application does not add an IP address or account identifier to this referral table.', 'Google Analytics usage data only after you consent to analytics.'] },
        { heading: 'Cookies and local storage', paragraphs: ['A language cookie remembers the selected locale. A local-storage record remembers your privacy choices. With analytics consent, Google Analytics may set cookies such as _ga. You can change your choice at any time through Cookie settings in the footer.'] },
        { heading: 'Google Analytics', paragraphs: ['When analytics is accepted, Google Analytics helps us understand aggregate page usage, device categories, and approximate geography. Analytics does not load before consent through our site preference control. Google may process this data under its own privacy terms.'] },
        { heading: 'Advertising', paragraphs: ['Advertising is not currently enabled. If Google AdSense is enabled later, third-party vendors including Google may use cookies to serve ads based on prior visits to this and other websites. Users can control personalized advertising through Google Ads Settings. Where required, advertising will use a Google-certified consent management platform.'] },
        { heading: 'External links and affiliates', paragraphs: ['Outbound links lead to third-party sites with their own privacy practices. Some referral links may generate an aggregate click record and may compensate aiplans.dev; see the Affiliate and Advertising Disclosure.'] },
        { heading: 'Retention and choices', paragraphs: ['We retain operational records only as long as reasonably needed for security, measurement, legal obligations, and service improvement. You may reject optional storage, reopen Cookie settings, clear site data in your browser, or contact us about a privacy request.'] },
        { heading: 'Children', paragraphs: ['aiplans.dev is intended for a general developer and business audience and is not directed to children under 13.'] },
        { heading: 'Contact and changes', paragraphs: ['Privacy requests can be sent through the contact methods on this site. We may update this policy when data practices or legal requirements change; the latest revision date will appear above.'] },
      ],
    },
    terms: {
      title: 'Terms of Use',
      description: 'Terms governing use of aiplans.dev pricing comparisons and related content.',
      intro: `Last updated: ${UPDATED}. By using aiplans.dev, you agree to these terms.`,
      sections: [
        { heading: 'Informational service', paragraphs: ['Prices, benchmarks, availability notes, and plan details are provided for comparison and general information. They are not financial, legal, procurement, or contractual advice.'] },
        { heading: 'Accuracy and availability', paragraphs: ['We work to keep data current but do not guarantee that every value is complete, error-free, or available in every region. Provider terms and checkout prices control. Verify material decisions with the provider.'] },
        { heading: 'Acceptable use', bullets: ['Do not interfere with the service or attempt unauthorized access.', 'Do not use automated access in a way that materially degrades availability.', 'Do not misrepresent aiplans.dev data as an official statement from a provider.', 'Respect third-party rights and applicable law.'] },
        { heading: 'Third-party services', paragraphs: ['Provider links, advertisements, and external tools are controlled by third parties. aiplans.dev is not responsible for their availability, transactions, security, or terms.'] },
        { heading: 'Intellectual property', paragraphs: ['Provider names and marks belong to their respective owners. The aiplans.dev interface, original copy, and project code are protected by their applicable licenses and laws.'] },
        { heading: 'No warranty and limitation', paragraphs: ['The service is provided “as is” and “as available” to the extent permitted by law. aiplans.dev and x2v are not liable for losses caused by reliance on stale data, provider changes, outages, or third-party services.'] },
        { heading: 'Changes and contact', paragraphs: ['We may change the service or these terms. Continued use after a revision means the revised terms apply. Questions can be submitted through the contact page.'] },
      ],
    },
  },
  zh: {
    about: {
      title: '关于 aiplans.dev',
      description: '了解 aiplans.dev 的运营方，以及我们为何比较 AI API 与订阅套餐价格。',
      intro: 'aiplans.dev 是由独立 AI 产品工作室 x2v 运营的价格比较产品。',
      sections: [
        { heading: '我们做什么', paragraphs: ['我们收集 AI 厂商、云平台、聚合平台和转售渠道公开发布的价格与套餐信息，并统一成可比较的口径，帮助开发者和团队做出更清楚的采购决策。'] },
        { heading: '编辑独立性', paragraphs: ['价格排序、比较结果和推荐依据公开数据与统一规则生成。商业合作不能购买更高排名；未来如有赞助内容，会清楚标注。'] },
        { heading: '开放开发', paragraphs: ['本站代码与公开问题追踪器位于 GitHub。厂商价格、套餐或可用性发生变化时，欢迎提交有来源的纠错。'] },
      ],
    },
    contact: {
      title: '联系我们',
      description: '就价格纠错、隐私、合作或技术问题联系 aiplans.dev。',
      intro: '联系 aiplans.dev 团队最快的方式是使用公开的 GitHub Issue。',
      sections: [
        { heading: '价格纠错', paragraphs: ['请提供对应模型或套餐页面、疑似错误的数据，以及厂商来源链接。不要提交账号凭证、账单或其他隐私信息。'] },
        { heading: '隐私请求', paragraphs: ['如需私下处理隐私或数据请求，请通过 x2v 官网联系，并在消息中注明 aiplans.dev。我们可能需要足以理解请求的信息，但不会索要密码或 API Key。'] },
        { heading: '商业合作', paragraphs: ['商业与联盟合作会和编辑数据分开审核。商业关系不能改变价格计算或比较排名。'] },
      ],
    },
    disclosure: {
      title: '联盟链接与广告披露',
      description: 'aiplans.dev 如何通过联盟链接、赞助和广告获得支持。',
      intro: 'aiplans.dev 可能从部分外链或清楚标注的广告中获得收益，用户无需因此支付额外费用。',
      sections: [
        { heading: '联盟链接', paragraphs: ['部分 AI 厂商链接可能带有推荐参数。用户通过这些链接注册或购买时，aiplans.dev 可能获得佣金或账户额度。'] },
        { heading: '排名独立', paragraphs: ['合作收益不会影响模型排名、最低价计算、基准分数或是否进入比较表。所有厂商使用相同的数据规则。'] },
        { heading: '广告', paragraphs: ['广告启用后会与价格数据及操作控件保持清楚的视觉区别，不会伪装成厂商排名、下载按钮或必要导航。'] },
        { heading: '购买前核实', paragraphs: ['厂商价格、可用地区、税费与促销可能随时变化，请在购买前以厂商结算页和条款为准。'] },
      ],
    },
    methodology: {
      title: '价格方法论',
      description: 'aiplans.dev 如何收集、换算、核验和展示 AI 价格数据。',
      intro: '我们的比较会区分来源事实与计算结果，并明确说明比较基准。',
      sections: [
        { heading: '数据来源', paragraphs: ['我们优先使用官方定价页和文档。云平台、聚合平台和转售商作为独立渠道记录，不会被描述为模型原厂。'] },
        { heading: '统一口径', bullets: ['来源支持 token 计费时，API 价格统一展示为每百万 token。', '保留原币种展示；跨币种排序与节省比例使用美元换算值。', '订阅价格保留计费周期，并明确年付优惠假设。', '“官方基准”是追踪到的最低官方或原厂渠道价，不代表全渠道最低价。'] },
        { heading: '更新与检查', paragraphs: ['自动采集任务定期运行，只读审计会标记缺失、过期、零值、输入输出倒挂或异常价格。自动化仍可能出错，因此重大购买决定应回到来源链接核实。'] },
        { heading: '基准测试', paragraphs: ['基准分数只是比较信号，不保证适合所有任务。基准名称和评分语境与价格计算分开呈现。'] },
        { heading: '纠错', paragraphs: ['可在 GitHub 提交带来源链接的纠错。在条件允许时，重大价格变化会保留在项目的价格历史数据中。'] },
      ],
    },
    privacy: {
      title: '隐私政策',
      description: 'aiplans.dev 如何处理分析、Cookie、广告、外链点击和隐私选择。',
      intro: `最后更新：${UPDATED_ZH}。本政策说明使用 aiplans.dev 时会处理的有限信息。`,
      sections: [
        { heading: '我们处理的信息', bullets: ['保存在浏览器中的语言与隐私偏好。', '标准托管和安全日志，可能包含 IP 地址、浏览器信息、请求网址与访问时间。', '包含活动、来源、产品和时间的汇总推荐点击事件；应用不会在该点击表中加入 IP 地址或账号标识。', '仅在你同意分析后产生的 Google Analytics 使用数据。'] },
        { heading: 'Cookie 与本地存储', paragraphs: ['语言 Cookie 用于记住所选语言，本地存储用于记住隐私选择。同意分析后，Google Analytics 可能设置 `_ga` 等 Cookie。你可以随时通过页脚的“Cookie 设置”修改选择。'] },
        { heading: 'Google Analytics', paragraphs: ['接受分析后，Google Analytics 帮助我们了解汇总页面使用情况、设备类别和大致地区。本站的偏好控件会在取得同意前阻止分析脚本加载；Google 也会依据其隐私条款处理相关数据。'] },
        { heading: '广告', paragraphs: ['本站目前尚未启用广告。将来启用 Google AdSense 后，包括 Google 在内的第三方服务商可能根据用户此前访问本站或其他网站的情况，使用 Cookie 投放广告。在法规要求的地区，我们会使用经 Google 认证的同意管理平台。'] },
        { heading: '外部链接与联盟合作', paragraphs: ['外链会进入有独立隐私规则的第三方网站。部分推荐链接可能记录一次汇总点击并给 aiplans.dev 带来收益，详见《联盟链接与广告披露》。'] },
        { heading: '保留与选择', paragraphs: ['运营记录仅在安全、统计、法定义务和改进服务所合理需要的期限内保留。你可以拒绝可选存储、重新打开 Cookie 设置、清除浏览器网站数据，或联系我们提出隐私请求。'] },
        { heading: '儿童', paragraphs: ['aiplans.dev 面向一般开发者与商业用户，不以 13 岁以下儿童为目标用户。'] },
        { heading: '联系与更新', paragraphs: ['隐私请求可通过本站联系渠道提出。数据实践或法律要求变化时，我们可能更新本政策，并在页首标注最新修订日期。'] },
      ],
    },
    terms: {
      title: '使用条款',
      description: '使用 aiplans.dev 价格比较与相关内容时适用的条款。',
      intro: `最后更新：${UPDATED_ZH}。使用 aiplans.dev 即表示你同意本条款。`,
      sections: [
        { heading: '信息服务', paragraphs: ['价格、基准分数、可用性和套餐信息仅用于比较及一般参考，不构成财务、法律、采购或合同建议。'] },
        { heading: '准确性与可用性', paragraphs: ['我们尽力保持数据及时，但不保证每个值都完整、无误或适用于所有地区。厂商条款和结算价格优先；重大决定请向厂商核实。'] },
        { heading: '可接受使用', bullets: ['不得干扰服务或尝试未经授权的访问。', '不得以明显损害服务可用性的方式自动访问。', '不得把 aiplans.dev 数据冒充为厂商官方声明。', '尊重第三方权利和适用法律。'] },
        { heading: '第三方服务', paragraphs: ['厂商链接、广告和外部工具由第三方控制，aiplans.dev 不对其可用性、交易、安全或条款负责。'] },
        { heading: '知识产权', paragraphs: ['厂商名称与商标归各自权利人所有。aiplans.dev 界面、原创文字和项目代码受相应许可与法律保护。'] },
        { heading: '不保证与责任限制', paragraphs: ['在法律允许范围内，服务按“现状”和“可用”提供。aiplans.dev 与 x2v 不对因过期数据、厂商变更、服务中断或第三方服务造成的损失负责。'] },
        { heading: '变更与联系', paragraphs: ['我们可能调整服务或本条款。修订后继续使用即表示新条款适用；问题可通过联系页面提出。'] },
      ],
    },
  },
};

const infoSlugs = new Set<InfoSlug>(['about', 'contact', 'disclosure', 'methodology', 'privacy', 'terms']);

function isInfoSlug(value: string): value is InfoSlug {
  return infoSlugs.has(value as InfoSlug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; info: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale, info } = await params;
  const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
  if (!isInfoSlug(info)) return {};

  return buildMetadata({
    locale,
    path: `/${info}`,
    title: { en: content.en[info].title, zh: content.zh[info].title },
    description: { en: content.en[info].description, zh: content.zh[info].description },
  });
}

export default async function InfoPage({
  params,
}: {
  params: Promise<{ locale: string; info: string }>;
}) {
  const { locale: rawLocale, info } = await params;
  const locale: Locale = rawLocale === 'zh' ? 'zh' : 'en';
  if (!isInfoSlug(info)) notFound();

  const page = content[locale][info];

  return (
    <div className="min-h-screen bg-zinc-50/60 dark:bg-zinc-950">
      <SiteHeader locale={locale} />
      <main className="container mx-auto max-w-4xl px-4 py-12 md:py-16">
        <header className="border-b pb-8">
          <p className="text-sm font-medium text-blue-600">aiplans.dev</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">{page.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-400">{page.intro}</p>
        </header>

        <div className="divide-y">
          {page.sections.map((section) => (
            <section key={section.heading} className="py-8">
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-7 text-zinc-700 dark:text-zinc-300">{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-zinc-700 dark:text-zinc-300">
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 border-t pt-8 text-sm">
          <Link className="font-medium text-blue-600 hover:underline" href="https://github.com/x2v-co/aiplans/issues" target="_blank" rel="noopener noreferrer">
            {locale === 'zh' ? '提交 GitHub Issue' : 'Open a GitHub issue'}
          </Link>
          <span className="text-zinc-300">|</span>
          <Link className="font-medium text-blue-600 hover:underline" href="https://x2v.co" target="_blank" rel="noopener noreferrer">
            x2v.co
          </Link>
        </div>
      </main>
    </div>
  );
}
