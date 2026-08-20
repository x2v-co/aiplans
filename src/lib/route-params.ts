/**
 * Next hands a dynamic route param through *still percent-encoded* whenever the
 * URL segment contains a character it normalizes. `claude-opus-5:batch` is a
 * real model slug in this database, and requesting
 * `/en/models/claude-opus-5:batch` delivers `claude-opus-5%3Abatch` to the
 * page — which matches no row, so the page 404s and the metadata/canonical/OG
 * URLs all carry the escape sequence in place of the model name.
 *
 * Every route that looks a slug up by a path param has to decode it first.
 * decodeURIComponent throws on a lone `%`, and a slug is allowed to contain
 * one, so a failed decode falls back to the raw value rather than crashing the
 * page.
 */
export function decodeSlugParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
