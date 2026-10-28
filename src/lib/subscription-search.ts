import { selectIndexablePlanComparisons, type PlanComparisonCandidate } from './search-indexing';

/** Search intent copy describes access through listed providers, never an official membership. */
export function subscriptionSearchCopy(modelSlug: string, modelName: string, locale: string) {
  const isZh = locale === 'zh';
  const isDeepSeekLanding = modelSlug === 'deepseek-v4.1-flash';
  const subject = isDeepSeekLanding ? 'DeepSeek' : modelName;
  return {
    heading: isZh
      ? `${subject} 订阅套餐对比${isDeepSeekLanding ? `：${modelName}` : ''}`
      : `${subject} Subscription Plans${isDeepSeekLanding ? `: ${modelName}` : ''}`,
    intro: isZh
      ? `比较包含 ${modelName} 的订阅套餐，查看月付与年付价格、使用额度和可用地区。按聊天、编程或 API 场景选择供应商。`
      : `Compare subscriptions that include ${modelName}: monthly and annual prices, usage limits and regional availability. Choose a provider for your chat, coding or API needs.`,
    question: isZh ? `${subject} 订阅和 API 按量付费有什么区别？` : `How does a ${subject} subscription differ from pay-as-you-go API pricing?`,
    answer: isZh
      ? `订阅套餐按周期收费，包含的模型、工具和额度以套餐条款为准；API 按量付费则按输入、输出或缓存 token 等实际用量计费。支持 ${modelName} 的第三方套餐不等于模型厂商的官方会员，也不自动包含官方 API 余额。`
      : `Subscriptions charge per billing period, with model access, tools and quotas defined by each plan. Pay-as-you-go APIs charge for actual usage such as input, output and cached tokens. A third-party plan supporting ${modelName} is not an official membership from the model creator and does not automatically include official API credits.`,
    apiLink: isZh ? `${modelName} API 价格与按量费用对比` : `${modelName} API pricing and token costs`,
    linkLabel: isZh
      ? `${subject} 订阅套餐与价格对比${isDeepSeekLanding ? `（${modelName}）` : ''}`
      : `${subject} subscription plans & pricing${isDeepSeekLanding ? ` (${modelName})` : ''}`,
  };
}

export function providerSubscriptionComparisons<T extends PlanComparisonCandidate & { name: string }>(models: T[], providerModelSlugs?: ReadonlySet<string>) {
  return selectIndexablePlanComparisons(models)
    .filter(model => !providerModelSlugs || providerModelSlugs.has(model.slug))
    .sort((a, b) => Number(b.slug === 'deepseek-v4.1-flash') - Number(a.slug === 'deepseek-v4.1-flash')
      || b.plan_count - a.plan_count || a.slug.localeCompare(b.slug))
    .slice(0, 6);
}
