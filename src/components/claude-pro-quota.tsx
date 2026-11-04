import {
  CLAUDE_PRO_QUOTA_DATE, CLAUDE_PRO_QUOTA_LEDGER, CLAUDE_PRO_QUOTA_REPORT, CLAUDE_PRO_QUOTA_SOURCE,
  claudeProQuotaCopy, claudeProQuotaNotes, claudeProQuotaRows,
} from '@/lib/claude-pro-opus55';

export function ClaudeProQuota({ locale }: { locale: string }) {
  const c = claudeProQuotaCopy(locale);
  return <section className="mb-8 space-y-2 border-t pt-3" aria-label={c.heading} data-quota-source="x2v-first-party">
    <h4 className="font-semibold">{c.heading}</h4>
    <p className="text-xs">{c.verifiedAt}: <time dateTime={CLAUDE_PRO_QUOTA_DATE}>{CLAUDE_PRO_QUOTA_DATE}</time></p>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr>{[c.window, c.outputHeavy, c.agentic].map(s => <th key={s} className="p-2">{s}</th>)}</tr></thead>
      <tbody>{claudeProQuotaRows(locale).map(([w, o, a]) => <tr key={w} className="border-t">
        <th scope="row" className="p-2 font-medium">{w}</th><td className="p-2">{o}</td><td className="p-2">{a}</td>
      </tr>)}</tbody>
    </table></div>
    {claudeProQuotaNotes(locale).map(note => <p key={note} className="text-xs text-zinc-500">{note}</p>)}
    <div className="flex flex-wrap gap-3 text-xs underline">
      <a href={CLAUDE_PRO_QUOTA_SOURCE} rel="noopener" target="_blank">{c.source}</a>
      <a href={CLAUDE_PRO_QUOTA_REPORT}>{c.report}</a>
      <a href={CLAUDE_PRO_QUOTA_LEDGER}>{c.ledger}</a>
    </div>
  </section>;
}
