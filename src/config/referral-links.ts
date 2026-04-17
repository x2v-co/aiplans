// Affiliate / referral destination map for /go/:source/:campaign/:product
//
// Keys are product slugs used in article links. Values are the actual
// referral URLs to redirect to. Unknown product slugs fall through to "/".
//
// TODO: Replace placeholder URLs with real referral codes as they arrive.
// Until then these point to the vendor's pricing page so clicks still convert.
export const REFERRAL_LINKS: Record<string, string> = {
  'claude-max': 'https://www.anthropic.com/pricing',
  'glm': 'https://z.ai/subscribe',
  'aliyun-coding-plan': 'https://bailian.console.aliyun.com/',
  'minimax': 'https://platform.minimaxi.com/subscribe/token-plan',
  'codex': 'https://openai.com/chatgpt/pricing',
  'gemini': 'https://codeassist.google/',
  'volcengine': 'https://www.volcengine.com/product/doubao',
  'aliyun-lingma': 'https://lingma.aliyun.com/pricing',
};
