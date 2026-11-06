import { deriveProviderRegions, type RegionFields } from '../../src/lib/supported-regions';

/** Advisory only: source completeness must not fail the audit gate. */
export function regionSourceWarning(row: RegionFields): string | null {
  if (row.supported_regions != null) {
    return deriveProviderRegions(row).hasSource ? null
      : 'supported_regions has a value without a valid regions_source_url';
  }
  return row.access_from_china === true
    ? 'legacy China value needs verified supported_regions and regions_source_url'
    : null;
}

export function isRegionAdvisory(finding: { check: string }): boolean {
  return finding.check === 'regions.missing_source';
}
