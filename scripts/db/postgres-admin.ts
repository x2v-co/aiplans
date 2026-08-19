/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from 'dotenv';
import { resolve } from 'path';
import postgres, { type PendingQuery, type Sql } from 'postgres';

config({ path: resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required in .env.local');
}

export const databaseSql = postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX || 10),
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: process.env.DB_PREPARE !== 'false',
});

type QueryResult = {
  data: any;
  error: null | { code?: string; message: string; details?: string };
  count?: number | null;
};

type Filter =
  | { kind: 'eq'; column: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'or'; expression: string };

type Order = { column: string; ascending: boolean };

function joinFragments(sql: Sql, fragments: any[], separator: any): any {
  if (fragments.length === 0) return sql`TRUE`;
  return fragments.slice(1).reduce(
    (result, fragment) => sql`${result}${separator}${fragment}`,
    fragments[0],
  );
}

// postgres.js wants the OID of the *array* type, not of the element -- see the
// INT4_ARRAY/TEXT_ARRAY comment in src/lib/db.ts for why passing 23/25 here
// failed only on cold connections.
function arrayType(values: unknown[]): number {
  const value = values.find((item) => item != null);
  if (typeof value === 'number') return 1007; // int4[]
  if (typeof value === 'boolean') return 1000; // bool[]
  return 1009; // text[]
}

function selectColumns(sql: Sql, selection: string): any {
  const normalized = selection.trim();
  if (!normalized || normalized === '*') return sql`*`;

  const columns = normalized.split(',').map((column) => column.trim()).filter(Boolean);
  const fragments = columns.map((column) => sql`${sql(column)}`);
  return joinFragments(sql, fragments, sql`, `);
}

class PostgresQueryBuilder implements PromiseLike<QueryResult> {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selection = '*';
  private mutationData: Record<string, unknown> | null = null;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private rowLimit: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private head = false;
  private countMode = false;
  private returning = false;

  constructor(private readonly table: string) {}

  select(selection = '*', options?: { count?: 'exact'; head?: boolean }) {
    if (this.operation !== 'select') this.returning = true;
    this.selection = selection;
    this.head = options?.head === true;
    this.countMode = options?.count === 'exact';
    return this;
  }

  insert(data: Record<string, unknown>) {
    this.operation = 'insert';
    this.mutationData = data;
    return this;
  }

  update(data: Record<string, unknown>) {
    this.operation = 'update';
    this.mutationData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ kind: 'in', column, values });
    return this;
  }

  or(expression: string) {
    this.filters.push({ kind: 'or', expression });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(limit: number) {
    this.rowLimit = limit;
    return this;
  }

  single() {
    this.singleMode = 'single';
    this.rowLimit = 2;
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    this.rowLimit = 2;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private filterFragment(sql: Sql): any {
    const fragments = this.filters.map((filter) => {
      if (filter.kind === 'eq') {
        return filter.value == null
          ? sql`${sql(filter.column)} IS NULL`
          : sql`${sql(filter.column)} = ${filter.value as any}`;
      }

      if (filter.kind === 'in') {
        if (filter.values.length === 0) return sql`FALSE`;
        return sql`${sql(filter.column)} = ANY(${sql.array(filter.values as any[], arrayType(filter.values))})`;
      }

      const alternatives = filter.expression.split(',').map((item) => {
        const [column, operator, rawValue] = item.split('.');
        if (!column || !operator) throw new Error(`Unsupported or() expression: ${item}`);
        if (operator === 'eq') return sql`${sql(column)} = ${rawValue}`;
        if (operator === 'is' && rawValue === 'null') return sql`${sql(column)} IS NULL`;
        throw new Error(`Unsupported or() operator: ${operator}`);
      });
      return sql`(${joinFragments(sql, alternatives, sql` OR `)})`;
    });

    return joinFragments(sql, fragments, sql` AND `);
  }

  private orderFragment(sql: Sql): any {
    if (this.orders.length === 0) return sql``;
    const fragments = this.orders.map((order) => order.ascending
      ? sql`${sql(order.column)} ASC`
      : sql`${sql(order.column)} DESC`);
    return sql`ORDER BY ${joinFragments(sql, fragments, sql`, `)}`;
  }

  private limitFragment(sql: Sql): any {
    return this.rowLimit == null ? sql`` : sql`LIMIT ${this.rowLimit}`;
  }

  private cleanMutationData(): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(this.mutationData || {}).filter(([, value]) => value !== undefined),
    );
  }

  private async execute(): Promise<QueryResult> {
    const sql = databaseSql;
    const where = this.filterFragment(sql);
    const order = this.orderFragment(sql);
    const limit = this.limitFragment(sql);

    try {
      if (this.operation === 'select' && this.countMode && this.head) {
        const [row] = await sql<Array<{ count: number }>>`
          SELECT COUNT(*)::integer AS count
          FROM ${sql(this.table)}
          WHERE ${where}
        `;
        return { data: null, error: null, count: row?.count ?? 0 };
      }

      let query: PendingQuery<any[]>;
      if (this.operation === 'select') {
        const columns = selectColumns(sql, this.selection);
        query = sql`SELECT ${columns} FROM ${sql(this.table)} WHERE ${where} ${order} ${limit}`;
      } else if (this.operation === 'insert') {
        const data = this.cleanMutationData();
        const keys = Object.keys(data);
        const returning = this.returning ? sql`RETURNING ${selectColumns(sql, this.selection)}` : sql``;
        query = sql`INSERT INTO ${sql(this.table)} ${sql(data, ...keys)} ${returning}`;
      } else if (this.operation === 'update') {
        const data = this.cleanMutationData();
        const keys = Object.keys(data);
        const returning = this.returning ? sql`RETURNING ${selectColumns(sql, this.selection)}` : sql``;
        query = sql`UPDATE ${sql(this.table)} SET ${sql(data, ...keys)} WHERE ${where} ${returning}`;
      } else {
        const returning = this.returning ? sql`RETURNING ${selectColumns(sql, this.selection)}` : sql``;
        query = sql`DELETE FROM ${sql(this.table)} WHERE ${where} ${returning}`;
      }

      const result = [...await query];
      if (!this.singleMode) {
        return { data: this.returning || this.operation === 'select' ? result : null, error: null };
      }

      if (result.length === 0) {
        if (this.singleMode === 'maybeSingle') return { data: null, error: null };
        return {
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
        };
      }
      if (result.length > 1) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple rows returned' },
        };
      }
      return { data: result[0], error: null };
    } catch (error: any) {
      return {
        data: null,
        error: {
          code: error?.code,
          message: error?.message || String(error),
          details: error?.detail,
        },
      };
    }
  }
}

export const postgresAdmin = {
  from(table: string) {
    return new PostgresQueryBuilder(table);
  },
};
