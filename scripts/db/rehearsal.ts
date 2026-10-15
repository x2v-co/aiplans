/**
 * Rehearsal dry-run: run the real writes inside a writable serializable transaction, then
 * ROLLBACK. Constraint, type and trigger failures surface exactly as they would on --apply,
 * and nothing is committed. Use for every DB-backed seed dry-run.
 */
export class RehearsalRollback extends Error {
  constructor() { super('rehearsal: rolled back'); }
}

type Begin<Tx> = { begin: (isolation: string, fn: (tx: Tx) => Promise<unknown>) => Promise<unknown> };

export async function runRehearsable<Tx, T>(sql: Begin<Tx>, apply: boolean, work: (tx: Tx) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await sql.begin('isolation level serializable', async tx => {
      result = await work(tx);
      if (!apply) throw new RehearsalRollback();
    });
  } catch (error) {
    if (!(error instanceof RehearsalRollback)) throw error;
  }
  return result as T;
}
