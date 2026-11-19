/**
 * ChatGPT Advanced and Standard voice retirement, from the 2026-11-10 entry of
 * the ChatGPT release notes (read 2026-11-15). Code-only: shown on current
 * ChatGPT subscription plan cards, no DB write (the OpenAI plan scraper owns
 * plan features).
 */
export const CHATGPT_VOICE_SOURCE = 'https://help.openai.com/en/articles/6825453-chatgpt-release-notes';
export const CHATGPT_VOICE_RETIREMENT_DATE = '2026-12-11';
export const CHATGPT_VOICE_NOTICE_DATE = '2026-11-10';
/** Current ChatGPT plans. Legacy chatgpt-team / chatgpt-pro rows are excluded. */
export const CHATGPT_VOICE_PLANS = [
  'chatgpt-free', 'chatgpt-go', 'chatgpt-plus', 'chatgpt-pro-100', 'chatgpt-pro-200', 'chatgpt-pro-500',
  'chatgpt-business', 'chatgpt-business-premium', 'chatgpt-enterprise',
] as const;

export function chatGptVoiceRetirement(slug: string | null | undefined, locale: string) {
  if (!slug || !(CHATGPT_VOICE_PLANS as readonly string[]).includes(slug)) return null;
  const zh = locale === 'zh';
  return {
    text: zh
      ? `ChatGPT 将于 ${CHATGPT_VOICE_RETIREMENT_DATE} 下线 Advanced 和 Standard voice，语音统一改用 GPT-Live；在 GPT-Live 支持之前，实时视频和屏幕共享仍由 Advanced voice 提供（${CHATGPT_VOICE_NOTICE_DATE} 公告）。`
      : `ChatGPT retires Advanced and Standard voice on ${CHATGPT_VOICE_RETIREMENT_DATE}; voice moves to GPT-Live. Live video and screen sharing stay on Advanced voice until GPT-Live supports them (announced ${CHATGPT_VOICE_NOTICE_DATE}).`,
    source: zh ? 'ChatGPT 官方更新说明' : 'ChatGPT release notes',
    url: CHATGPT_VOICE_SOURCE,
  };
}
