export type QuotaTextSource = {
  id: string; name: string; url: string;
  /** Disabled sources are listed for review but never fetched. Always give a reason. */
  enabled?: boolean; disabledReason?: string;
};

// Official sources only. These pages are evidence for review, never quota seeds.
// Client-rendered pages may return no quota text: the monitor warns and skips them.
// chatgpt-plans / grok-plans returned HTTP 403 from prod on 2026-10-15 with the bot UA; the
// monitor now sends browser-like headers. If they still 403 from prod, set enabled:false with a reason.
export const QUOTA_TEXT_SOURCES: readonly QuotaTextSource[] = [
  { id: 'claude-plans', name: 'Claude plans', url: 'https://claude.com/pricing' },
  { id: 'claude-usage', name: 'Claude usage help', url: 'https://support.claude.com/en/articles/9797557-usage-limit-best-practices' },
  { id: 'chatgpt-plans', name: 'ChatGPT plans', url: 'https://chatgpt.com/pricing/' },
  { id: 'codex-plans', name: 'Codex pricing and usage', url: 'https://developers.openai.com/codex/pricing/' },
  { id: 'cursor-plans', name: 'Cursor pricing', url: 'https://cursor.com/pricing' },
  { id: 'copilot-plans', name: 'GitHub Copilot plans', url: 'https://github.com/features/copilot/plans' },
  { id: 'opencode-go', name: 'OpenCode Go plans', url: 'https://opencode.ai/docs/go/' },
  { id: 'google-ai-plans', name: 'Gemini / Google AI plans', url: 'https://one.google.com/about/google-ai-plans/' },
  { id: 'grok-plans', name: 'Grok / SuperGrok plans', url: 'https://grok.com/plans',
    enabled: false, disabledReason: 'HTTP 403 from prod (2026-10-15) and client-rendered: static HTML has no quota text. Needs a rendered fetch or another official source.' },
  // bigmodel.cn/glm-coding is a client-rendered SPA shell (no quota text); the docs page is static.
  { id: 'glm-coding', name: 'Zhipu GLM Coding Plan', url: 'https://docs.bigmodel.cn/cn/coding-plan/overview' },
  { id: 'kimi-membership', name: 'Kimi Code membership', url: 'https://www.kimi.com/code/docs/en/kimi-code/membership.html' },
  { id: 'minimax-plans', name: 'MiniMax Token / M Plan', url: 'https://platform.minimaxi.com/docs/guides/pricing-token-plan' },
  { id: 'qwen-coding', name: 'Alibaba Qwen Coding Plan', url: 'https://help.aliyun.com/zh/model-studio/coding-plan' },
  // Watch Odyssey/Runway pricing launch and Google Ultra tier entitlements.
  { id: 'google-ai-ultra', name: 'Google AI Ultra', url: 'https://gemini.google/subscriptions/' },
  { id: 'worldlabs-api-pricing', name: 'World Labs API pricing', url: 'https://docs.worldlabs.ai/api/pricing' },
  { id: 'decart-pricing', name: 'Decart pricing', url: 'https://docs.platform.decart.ai/getting-started/pricing' },
  { id: 'fal-cosmos-3', name: 'fal Cosmos 3 pricing', url: 'https://fal.ai/models/nvidia/cosmos-3-super/image-to-video' },
  { id: 'odyssey', name: 'Odyssey', url: 'https://odyssey.world/' },
  { id: 'runway-gwm', name: 'Runway GWM research', url: 'https://runwayml.com/research' },
];
