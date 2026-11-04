// Same metadata and wrapper as the public route (see filtered/api-pricing/page.tsx).
import PublicLayout, { generateMetadata as publicMetadata } from '../../api-pricing/layout';

export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return publicMetadata(props);
}

export default PublicLayout;
