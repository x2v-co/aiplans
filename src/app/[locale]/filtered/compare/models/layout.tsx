// Same metadata and wrapper as the public route (see filtered/compare/models/page.tsx).
import PublicLayout, { generateMetadata as publicMetadata } from '../../../compare/models/layout';

export function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return publicMetadata(props);
}

export default PublicLayout;
