/** Known persisted catalog labels may outlive the seed that introduced them.
 * Correct this identity at presentation time, without requiring a DB write.
 */
export function publicModelName(value: string): string {
  return value.replace(/DeepSeek V4 Flash \(legacy slug; API DeepSeek-V4\.1-Flash-1017\)/gi,
    'DeepSeek V4.1 Flash (1017)');
}

/** Drop entire editorial instructions, never just a marker leaving its task text.
 * Status metadata is interpreted separately and isn't product description prose.
 */
export function publicModelDescription(value?: string | null): string {
  return (value ?? '').split(/\r?\n/).map(line => line.trim()).filter(line =>
    !/legacy[ -](?:catalog[ -])?slug|deprecated[ -]slug|\bTODO\b|\bFIXME\b|\binternal\s+(?:note|review|only)\b|占位|内部备注|\[needs-verification\]|^Status:/i.test(line),
  ).join('\n').trim();
}
