// Same social card as the public route (see filtered/plans/page.tsx).
import PublicImage from '../../plans/opengraph-image';
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og-template';

export const alt = 'AI Subscription Plans — aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image(props: { params: Promise<{ locale: string }> }) {
  return PublicImage(props);
}
