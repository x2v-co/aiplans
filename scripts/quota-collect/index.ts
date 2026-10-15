import { ccusage } from './ccusage';
import { codexLog } from './codex-log';
import { CollectorSkipped, type Collector } from './types';

export const collectors: Collector[] = [
  codexLog, ccusage,
  ...Object.entries({
    'cursor-dashboard': 'a user-authorized dashboard export/session and plan mapping',
    'grok-bot': 'a user-authorized Grok usage endpoint, bot credentials and plan mapping',
    'claude-usage': 'a user-authorized Claude usage endpoint/session and plan mapping',
  }).map(([id, needs]) => ({
    id: id as Collector['id'],
    async collect() { throw new CollectorSkipped(`credentials not configured: needs ${needs}`); },
  })),
];

export type { Collector, CollectOptions, Sample } from './types';
