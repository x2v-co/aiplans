import { sql } from '@/lib/db';

/**
 * Old model slug -> current slug, via model_slug_redirects (keyed by model id
 * so a later rename still lands on the live slug). Returns null when there is
 * no redirect, it points at itself, or the table is not migrated yet.
 */
export async function findModelSlugRedirect(oldSlug: string): Promise<string | null> {
  try {
    const rows = await sql<Array<{ slug: string }>>`
      SELECT m.slug FROM model_slug_redirects r
      JOIN models m ON m.id = r.model_id
      WHERE r.old_slug = ${oldSlug} AND m.slug <> ${oldSlug}
      LIMIT 1
    `;
    return rows[0]?.slug ?? null;
  } catch {
    return null;
  }
}
