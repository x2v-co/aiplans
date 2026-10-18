import { TOOL_API_PRICES, formatToolPrice } from '@/lib/tool-api-pricing';

/** Static, source-cited per-request prices for web search / fetch tools. */
export function ToolApiPricingSection({ locale }: { locale: string }) {
  const l = locale === 'zh' ? 'zh' : 'en';
  return (
    <section id="tool-pricing" className="container mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl font-bold mb-2">{l === 'zh' ? '联网搜索 / 抓取工具按次价格' : 'Web search & fetch tool pricing (per request)'}</h2>
      <p className="text-sm text-zinc-500 mb-4">
        {l === 'zh' ? '官方公布的按次价格，token 费用另计。每行附官方来源与核验日期。' : 'Official per-request prices; token costs are separate. Each row links its official source and verification date.'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">{l === 'zh' ? '厂商' : 'Provider'}</th>
              <th className="py-2 pr-4">{l === 'zh' ? '工具' : 'Tool'}</th>
              <th className="py-2 pr-4">{l === 'zh' ? '按次价格' : 'Per-request price'}</th>
              <th className="py-2 pr-4">Token</th>
              <th className="py-2 pr-4">{l === 'zh' ? '说明' : 'Notes'}</th>
              <th className="py-2">{l === 'zh' ? '来源' : 'Source'}</th>
            </tr>
          </thead>
          <tbody>
            {TOOL_API_PRICES.map(row => (
              <tr key={`${row.providerSlug}-${row.tool}`} className="border-b align-top">
                <td className="py-2 pr-4 font-medium">{row.provider}</td>
                <td className="py-2 pr-4">{row.tool}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{formatToolPrice(row, l)}</td>
                <td className="py-2 pr-4">{row.tokens[l]}</td>
                <td className="py-2 pr-4 text-zinc-600">{row.note?.[l] ?? '—'}</td>
                <td className="py-2"><a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{l === 'zh' ? '官方' : 'Official'}</a> <span className="text-zinc-400">{row.verifiedAt}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
