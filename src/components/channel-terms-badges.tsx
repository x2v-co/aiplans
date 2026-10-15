import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { channelTermBadges, type ChannelTermsFields } from '@/lib/channel-terms';

export function ChannelTermsBadges({ terms }: { terms?: ChannelTermsFields | null }) {
  const t = useTranslations('channelTerms');
  const badges = channelTermBadges(terms);
  if (!badges.length) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1 whitespace-normal">
      {badges.map(badge => badge.kind === 'training' ? (
        <Badge
          key="training"
          variant="outline"
          className="border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          title={badge.note ?? undefined}
        >
          {t('training')}
        </Badge>
      ) : (
        <Badge key="quota" variant="outline" className="font-normal">
          {t('quota', { unit: t(`units.${badge.unit}`) })}
        </Badge>
      ))}
    </div>
  );
}
