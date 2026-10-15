export type QuotaTextSource = { id: string; name: string; url: string };

// Official sources only. These pages are evidence for review, never quota seeds.
// Client-rendered pages may return no quota text: the monitor reports and skips them.
export const QUOTA_TEXT_SOURCES: readonly QuotaTextSource[] = [
  { id: 'claude-plans', name: 'Claude plans', url: 'https://claude.com/pricing' },
  { id: 'claude-usage', name: 'Claude usage help', url: 'https://support.claude.com/en/articles/9797557-usage-limit-best-practices' },
  { id: 'chatgpt-plans', name: 'ChatGPT plans', url: 'https://chatgpt.com/pricing/' },
  { id: 'codex-plans', name: 'Codex pricing and usage', url: 'https://developers.openai.com/codex/pricing/' },
  { id: 'cursor-plans', name: 'Cursor pricing', url: 'https://cursor.com/pricing' },
  { id: 'copilot-plans', name: 'GitHub Copilot plans', url: 'https://github.com/features/copilot/plans' },
  { id: 'google-ai-plans', name: 'Gemini / Google AI plans', url: 'https://one.google.com/about/google-ai-plans/' },
  { id: 'grok-plans', name: 'Grok / SuperGrok plans', url: 'https://grok.com/plans' },
  { id: 'glm-coding', name: 'Zhipu GLM Coding Plan', url: 'https://bigmodel.cn/glm-coding' },
  { id: 'kimi-membership', name: 'Kimi Code membership', url: 'https://www.kimi.com/code/docs/en/kimi-code/membership.html' },
  { id: 'minimax-plans', name: 'MiniMax Token / M Plan', url: 'https://platform.minimaxi.com/docs/guides/pricing-token-plan' },
  { id: 'qwen-coding', name: 'Alibaba Qwen Coding Plan', url: 'https://help.aliyun.com/zh/model-studio/coding-plan' },
];
