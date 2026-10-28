/** Live official-source review. Never infer paid prices from plan names or cached seeds. */
export const OPENAI_REVIEW_SOURCES = {
  free: 'https://help.openai.com/en/articles/9275245-chatgpt-free-tier-faq',
  go: 'https://help.openai.com/en/articles/11989085-what-is-chatgpt-go',
  plus: 'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus',
  pro: 'https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers',
  business: 'https://help.openai.com/en/articles/8792828-chatgpt-business-overview',
  enterprise: 'https://openai.com/business/pricing/',
  rename: 'https://help.openai.com/en/articles/12111915-chatgpt-business-rename-faq',
} as const;
export type OpenAIReviewSource = keyof typeof OPENAI_REVIEW_SOURCES;
export type ReviewedOpenAIPlan = {
  slug: string; name: string; price: number | null; annualPrice: number | null;
  contactSales: boolean; features: string[]; notes: string; verified: boolean;
};
function requireMatch(text: string, pattern: RegExp, description: string): RegExpMatchArray {
  const match = text.match(pattern);
  if (!match) throw new Error(`OpenAI source changed: ${description}`);
  return match;
}
function money(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 100000) throw new Error('Invalid official plan price');
  return amount;
}
function excerpt(text: string, start: string, end: string): string {
  const from = text.indexOf(start), to = text.indexOf(end, from + start.length);
  if (from < 0 || to < 0 || to <= from) throw new Error(`Missing official section: ${start}`);
  return text.slice(from + start.length, to).trim().slice(0,2500);
}
export function parseOpenAIReview(input: Record<OpenAIReviewSource, string>): ReviewedOpenAIPlan[] {
  const source = Object.fromEntries(Object.entries(input).map(([key,text]) => [key,text.replace(/\s+/g,' ').trim()])) as Record<OpenAIReviewSource,string>;
  for (const [key,text] of Object.entries(source)) {
    if (key === 'go' && !text) continue;
    if (!text || /Just a moment|Enable JavaScript and cookies to continue/i.test(text)) throw new Error(`Blocked or empty OpenAI source: ${key}`);
  }
  const rows: ReviewedOpenAIPlan[] = [];
  function add(key: OpenAIReviewSource, slug: string, name: string, price: number | null, features: string[], details = '', annualPrice: number | null = null, contactSales = false, verified = true) {
    rows.push({slug,name,price,annualPrice,contactSales,features,verified,
      notes: `${verified ? '' : '[needs-verification] '}${details}\n[aiplans:review-source] ${OPENAI_REVIEW_SOURCES[key]}\nSource: ${OPENAI_REVIEW_SOURCES[key]}`.trim()});
  }
  requireMatch(source.free,/ChatGPT is free to use/i,'Free is explicitly free');
  requireMatch(source.free,/unlimited everyday text chats/i,'Free usage policy');
  add('free','chatgpt-free','ChatGPT Free',0,['Everyday text chats are unlimited, subject to abuse-prevention safeguards.','Uploads, image generation, voice and other tools have separate limits.'], 'No fixed daily message allowance is published. Model availability changes over time.');
  const plusPrice = money(requireMatch(source.plus,/Price:\s*\$([\d.]+)\s*\/month\s*\(billed monthly\)/i,'Plus monthly price')[1]);
  const plusFeatures = excerpt(source.plus,'Benefits of ChatGPT Plus','Subscription Details');
  requireMatch(source.plus,/not support annual billing/i,'Plus monthly-only billing');
  add('plus','chatgpt-plus','ChatGPT Plus',plusPrice,[plusFeatures], 'Monthly billing; API usage is separate. Limits and model availability vary.');
  requireMatch(source.pro,/Monthly price \(USD\)/i,'Pro USD price table');
  for (const tier of [100,200,500]) {
    const price = money(requireMatch(source.pro,new RegExp(`Pro ${tier}\\s+\\$([\\d.]+)\\s+(Not included|Included)`, 'i'),`Pro ${tier} table row`)[1]);
    const features = [excerpt(source.pro,'Overview','Pro plans')];
    const ultra = requireMatch(source.pro,new RegExp(`Pro ${tier}\\s+\\$[\\d.]+\\s+(Not included|Included)`, 'i'),`Pro ${tier} Ultrafast`)[1];
    features.push(`Ultrafast: ${ultra.toLowerCase()}.`);
    add('pro',`chatgpt-pro-${tier}`,`ChatGPT Pro ${tier}`,price,features,'Monthly billing. Included allowances vary by model and tier; API billing is separate.');
  }
  // The current Go Help page delegates prices to localized checkout. A historic
  // launch announcement is not evidence of today's price; publish unknown.
  if (source.go) requireMatch(source.go,/What is ChatGPT Go\?/i,'Go article identity');
  if (source.go) requireMatch(source.go,/Subscription prices can be found in the ChatGPT pricing page/i,'Go price delegation');
  add('go','chatgpt-go','ChatGPT Go',null,source.go ? [excerpt(source.go,"What's included",'Availability')] : [], 'No current USD amount could be verified from the official Help Center; localized checkout could not be verified. Previous $8 US launch price is historical, not a newly verified quote.',null,false,false);
  requireMatch(source.business,/pricing \(USD\)|Prices[^.]{0,120}USD/i,'Business seat pricing');
  for (const [heading,slug,name] of [['Standard seat','chatgpt-business','ChatGPT Business Standard'],['Premium seat','chatgpt-business-premium','ChatGPT Business Premium']]) {
    const start = source.business.search(new RegExp(`${heading}\\b\\s+Monthly plan:`, 'i'));
    if (start < 0) throw new Error(`Missing ${heading}`);
    const section = source.business.slice(start,start+600);
    const match = requireMatch(section,/Monthly plan:\s*\$([\d.]+) per user per month\s*Annual plan:\s*\$([\d.]+) per user per month, billed annually/i,`${heading} monthly and annual prices`);
    const price=money(match[1]), annual=money(match[2])*12;
    add('business',slug,name,price,['ChatGPT, ChatGPT Work and Codex.','Centralized billing and workspace administration.'], 'USD per seat. Minimum two paid seats per workspace; Standard and Premium seats can be mixed. Annual price is the full 12-month total.',annual);
  }
  requireMatch(source.enterprise,/Enterprise.*Custom pricing.*Contact our sales team to discuss enterprise pricing/i,'Enterprise custom pricing');
  add('enterprise','chatgpt-enterprise','ChatGPT Enterprise',null,['Enterprise security, administration and contracted support.'],'Contact sales for a quote. No public minimum price or seat commitment is asserted.',null,true);
  requireMatch(source.rename,/Team plan has been renamed to ChatGPT Business|renamed ChatGPT Team to ChatGPT Business|ChatGPT Team was renamed to ChatGPT Business on August 29, 2025/i,'Team rename');
  add('rename','chatgpt-team','ChatGPT Team (renamed to Business)',null,[], '[aiplans:legacy ends=2025-08-29] Historical name of ChatGPT Business, not a separate purchasable tier. See ChatGPT Business Standard and Premium.',null,false,true);
  const legacy = excerpt(source.pro,'Changes to existing Pro 200 subscriptions','Keeping your allowance');
  requireMatch(legacy,/October 29, 2026/,'legacy Pro allowance deadline');
  add('pro','chatgpt-pro','ChatGPT Pro 200 (legacy allowance)',rows.find(r=>r.slug==='chatgpt-pro-200')!.price,[], `[aiplans:legacy ends=2026-10-29] ${legacy}`);
  return rows;
}

/** Reject replay that would roll a newer verified/reviewed row backwards. */
export function assertOpenAIReviewFreshness(row: {last_verified?: Date | string | null; updated_at?: Date | string | null; notes?: string | null}, capturedAt: Date): void {
  const dates = [row.last_verified, row.notes?.includes('[aiplans:review-source]') ? row.updated_at : null];
  if (dates.some(value => value && new Date(value).getTime() > capturedAt.getTime())) {
    throw new Error('Review evidence predates the existing plan; collect fresh sources');
  }
}
