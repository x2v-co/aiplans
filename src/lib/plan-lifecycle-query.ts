import { sql } from './db';

/** Current listings only; historical detail/redirect and quota-history reads keep all rows. */
export function currentPlanCondition(table: 'plans' | 'pl' | 'p' = 'plans') {
  // Callers supply a fixed table alias, never request data. Keep the catalog's
  // existing NOT LIKE rule in one SQL fragment, including NULL notes as current.
  return sql.unsafe(`COALESCE(${table}.notes, '') NOT LIKE '%[aiplans:superseded-by %'`);
}
