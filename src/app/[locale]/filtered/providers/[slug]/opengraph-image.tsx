// Same social card as the public route (see filtered/providers/[slug]/page.tsx).
import PublicImage from '../../../providers/[slug]/opengraph-image';
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og-template';

export const alt = 'Provider API Models, Pricing & Subscription Plans — aiplans.dev';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const dynamic = 'force-dynamic';

export default function Image(props: { params: Promise<{ locale: string; slug: string }> }) {
  return PublicImage(props);
}
