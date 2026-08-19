/**
 * Renders what a plan costs per unit of what it meters.
 *
 * A server component, matching the rest of the plan pages: this repo's
 * `useTranslations` is a client-only context hook, so localized server markup
 * uses an `isZh` ternary and takes `locale` as a prop (see src/lib/plan-kinds.ts
 * for the same reasoning).
 *
 * The component takes an `EconomicsDisplay`, never a raw rate, which is what
 * keeps a rate from ever appearing without its qualification: `describeEconomics`
 * is the only public way to produce one and it bundles `caveat` in the same
 * object, so there is no code path that renders $3.62 per 1,000 messages without
 * also saying those are Flash answers only.
 */
import { AlertTriangle, HelpCircle, Info, Sigma } from 'lucide-react';
import type { EconomicsDisplay } from '@/lib/plan-economics';

/**
 * The three no-rate states must stay visually distinct. Collapsing them into
 * one grey dash is what the whole quota research was guarding against: "we
 * haven't looked" and "the vendor publishes nothing" are opposite claims, and a
 * reader who cannot tell them apart learns the wrong thing from both.
 */
function Note({ display }: { display: Extract<EconomicsDisplay, { kind: 'note' }> }) {
  const isMissing = display.tone === 'missing';
  const Icon = isMissing ? HelpCircle : Info;
  return (
    <div
      className={`flex items-start gap-1.5 text-xs ${
        isMissing
          ? 'text-amber-700 dark:text-amber-500'
          : 'text-zinc-500 dark:text-zinc-400'
      }`}
    >
      <Icon className="w-3.5 h-3.5 mt-px flex-shrink-0" />
      <span>{display.text}</span>
    </div>
  );
}

export function PlanRate({
  display,
  locale,
}: {
  display: EconomicsDisplay;
  locale: string;
}) {
  const isZh = locale === 'zh';

  if (display.kind === 'note') return <Note display={display} />;

  if (display.kind === 'allowances' || display.kind === 'ratios') {
    return (
      <div className="text-xs space-y-1">
        <div className="text-zinc-500 dark:text-zinc-400">{display.label}</div>
        {display.items.map((item, i) => (
          <div key={i} className="text-zinc-700 dark:text-zinc-300">
            {item}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-1.5">
        <Sigma className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <span className="text-sm font-semibold tabular-nums text-blue-700 dark:text-blue-400">
          {display.rate}
        </span>
      </div>

      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {isZh ? '依据' : 'Based on'} {display.basis}
        {display.derived && <> · {display.derived}</>}
      </div>

      {/* Rendered unconditionally whenever present — see the module header. */}
      {display.caveat && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500">
          <AlertTriangle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
          <span>{display.caveat}</span>
        </div>
      )}

      {display.ratios.map((ratio, i) => (
        <div key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
          {ratio}
        </div>
      ))}
    </div>
  );
}
