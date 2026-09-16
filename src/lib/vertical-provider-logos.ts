export const VERTICAL_PROVIDER_LOGOS: Record<string, string> = {
  openai: 'https://www.google.com/s2/favicons?domain=openai.com&sz=128',
  google: 'https://www.google.com/s2/favicons?domain=google.com&sz=128',
  runway: 'https://www.google.com/s2/favicons?domain=runwayml.com&sz=128',
  kuaishou: 'https://www.google.com/s2/favicons?domain=klingai.com&sz=128',
  pika: 'https://www.google.com/s2/favicons?domain=pika.art&sz=128',
  'luma-ai': 'https://www.google.com/s2/favicons?domain=lumalabs.ai&sz=128',
  suno: 'https://www.google.com/s2/favicons?domain=suno.com&sz=128',
  udio: 'https://www.google.com/s2/favicons?domain=udio.com&sz=128',
  elevenlabs: 'https://www.google.com/s2/favicons?domain=elevenlabs.io&sz=128',
  minimax: 'https://www.google.com/s2/favicons?domain=minimax.io&sz=128',
  'minimax-china': 'https://www.google.com/s2/favicons?domain=minimax.io&sz=128',
  volcengine: 'https://www.google.com/s2/favicons?domain=volcengine.com&sz=128',
  qwen: 'https://www.google.com/s2/favicons?domain=qwenlm.github.io&sz=128',
  shengshu: 'https://www.google.com/s2/favicons?domain=vidu.com&sz=128',
  nvidia: 'https://www.google.com/s2/favicons?domain=nvidia.com&sz=128',
  skyreels: 'https://www.google.com/s2/favicons?domain=skyreels.ai&sz=128',
  mureka: 'https://www.google.com/s2/favicons?domain=mureka.ai&sz=128',
  'world-labs': 'https://www.google.com/s2/favicons?domain=worldlabs.ai&sz=128',
  meta: 'https://www.google.com/s2/favicons?domain=meta.com&sz=128',
  'stability-ai': 'https://www.google.com/s2/favicons?domain=stability.ai&sz=128',
};

export function getVerticalProviderLogo(slug?: string | null): string | undefined {
  return slug ? VERTICAL_PROVIDER_LOGOS[slug] : undefined;
}
