/** Retained exact-identity context from the existing public catalog notice
 * (scripts/data/catalog-2026-10-29.ts) and saved public Thinking page. This is
 * dated provenance, not a fresh verification of the external documentation.
 * No price, subscription entitlement, or exact shutdown day is inferred.
 */
const SOURCE = 'https://platform.moonshot.cn/docs/pricing/chat';
const NAMES: Readonly<Record<string, string>> = {
  'moonshotai-kimi-k2': 'Kimi K2',
  'moonshotai-kimi-k2-thinking': 'Kimi K2 Thinking',
};

export function retainedModelContext(slug: string, locale = 'en') {
  const name = NAMES[slug];
  if (!name) return null;
  return {
    sourceUrl: SOURCE,
    recordedOn: '2026-10-29',
    heading: locale === 'zh' ? `${name}：保留的型号与可用性说明` : `${name}: retained identity and availability`,
    text: locale === 'zh'
      ? `${name} 保留其独立型号页面，不能用后续 Kimi 型号的报价代替。本站 2026-10-29 留存的 Moonshot 官方通知记载：K2 系列自 2026-10-31 起不再向新注册用户开放，已注册用户不受该限制影响，并计划在 2026 年 12 月底下线；通知未给出确切日期。这是已留存的通知，未在此重新核验。当前 API 报价缺失不代表免费，也不能据此断言老用户已无法使用。下方厂商套餐仅供参考，不证明任何套餐包含此型号；可用性与额度以厂商最新条款为准。`
      : `${name} retains its own model page; quotes for later Kimi models do not describe this identity. The Moonshot notice retained here on 2026-10-29 states that the K2 series would close to newly registered users on 2026-10-31, without that restriction affecting existing users, and was planned to shut down at the end of December 2026 without an exact date. This is a retained notice, not a new verification. Missing current API quotes do not mean free access or establish that existing users have lost access. Provider plans below are references and do not prove that any plan includes this model; consult the provider's current terms for availability and quotas.`,
  };
}
