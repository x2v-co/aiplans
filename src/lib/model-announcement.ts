/** Reuse the catalog's explicit description metadata; absent metadata stays available.
 * Shared by JS and PostgreSQL (~) so price-history exclusion uses the same marker.
 */
export const ANNOUNCED_DESCRIPTION_PATTERN = '(^|\n)Status: announced[.]([ \t\r\n]|$)';

export function modelAvailabilityStatus(description?: string | null): 'available' | 'announced' {
  return new RegExp(ANNOUNCED_DESCRIPTION_PATTERN).test(description ?? '') ? 'announced' : 'available';
}

export function modelAnnouncementLabel(description: string | null | undefined, messages: { announced: string }): string | null {
  return modelAvailabilityStatus(description) === 'announced' ? messages.announced : null;
}
