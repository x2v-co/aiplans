/** Test-only adapters. Execute current application functions with injected I/O;
 * never import their credential-loading DB singleton or main scraper runner. */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as promo from '../utils/promo-sync';
import * as unavailable from '../utils/manual-unavailable';
import * as unverified from '../db/unverified-price';
import * as guard from '../utils/model-identity-guard';
import * as normalizer from '../utils/model-normalizer';
import * as history from '../utils/price-history';
import * as pricing from '../../src/lib/deepseek-pricing';
import { resolveCatalogIdentity } from '../../src/lib/catalog-identity';
import { currentChannelWriteTarget, O3_BATCH_FEED } from '../db/channel-write-target';
import type { ScraperResult } from '../utils/validator';
import type { Sql } from 'postgres';

export type Row = Record<string, any>;
export type Client = { from(table: string): any };
function evaluate(source: string, globals: Row): Row {
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(compiled, { exports, ...globals });
  return exports;
}
export function actualQueryClient(sql: Sql): Client {
  const source = readFileSync(new URL('../db/postgres-admin.ts', import.meta.url), 'utf8');
  // The actual builder, minus the credential-loading module prelude.
  return evaluate(source.slice(source.indexOf('type QueryResult =')), { databaseSql: sql }).postgresAdmin;
}
export function applicationPaths(db: Client) {
  const source = readFileSync(new URL('../db/queries.ts', import.meta.url), 'utf8');
  const globals = {
    db, Date, console: { log() {}, warn() {}, error() {} },
    ...promo, ...unavailable, ...unverified, ...guard, ...normalizer, ...history, ...pricing,
    resolveCatalogIdentity, currentChannelWriteTarget, O3_BATCH_FEED,
  };
  const functions = evaluate(
    source.slice(source.indexOf('export async function batchUpsertChannelPriceVariants('), source.indexOf('export async function retireUnseenChannelPriceVariants(')) +
    source.slice(source.indexOf('export async function upsertChannelPrice(data:'), source.indexOf('export async function logScrapeResult(')) +
    source.slice(source.indexOf('export async function getOrCreateProduct('), source.indexOf('// Plan-related functions')),
    globals,
  );
  const runner = readFileSync(new URL('../index-dynamic.ts', import.meta.url), 'utf8');
  const errors: string[] = [];
  let retirements = 0;
  const result = evaluate(runner.slice(runner.indexOf('async function processAPIScraper('), runner.indexOf('// Map scraper source names')) +
    '\nexports.run = processAPIScraper;', {
    ...globals, ...functions, inferProviderId: () => -1, getChannelProviderId: async () => 59, inferRegion: () => 'global',
    recordError: (_: string, error: string) => errors.push(error), errText: (error: unknown) => String(error),
    retireUnseenChannelPrices: async () => { retirements++; },
    retireUnseenChannelPriceVariants: async () => { retirements++; },
  });
  return { upsertChannelPrice: functions.upsertChannelPrice as (data: Row) => Promise<Row>,
    getOrCreateProduct: functions.getOrCreateProduct as (data: Row) => Promise<Row>, errors, retirements: () => retirements,
    run: (input: ScraperResult, full = false, create = false) => result.run(input, input.source, full, create) as Promise<{ updated: number; errors: number }> };
}

export function actualHistorySeries(history: Row[]) {
  const source = readFileSync(new URL('../../src/components/price-history-chart.tsx', import.meta.url), 'utf8');
  const constants = source.slice(source.indexOf('const COLORS ='), source.indexOf('export default function PriceHistoryChart'));
  const computation = source.slice(source.indexOf('  const { seriesMeta, series, currencies } = useMemo'), source.indexOf('  // Provider-level selection'));
  return evaluate(constants + computation + '\nexports.result = { seriesMeta, series, currencies };', {
    history, mode: 'input', unit: 'native', useMemo: (work: () => unknown) => work(),
  }).result;
}

export function memoryClient(tables: Record<string, Row[]>) {
  const mutations: string[] = [];
  let failWrite = false;
  let failRead = false;
  let failHistory = false;
  const db: Client = { from(table) {
    const filters: Array<(row: Row) => boolean> = [];
    let operation = 'select';
    let values: Row = {};
    let single = false;
    const query: any = {
      select() { return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
      order() { return query; }, limit() { return query; },
      update(row: Row) { values = row; operation = 'update'; return query; },
      insert(row: Row) { values = row; operation = 'insert'; return query; },
      single() { single = true; return query; },
      then(resolve: (result: unknown) => unknown) {
        const execute = () => {
          if (operation === 'select' && failRead) return { data: null, error: { code: 'PGRST116', message: 'injected ambiguous read' } };
          let matches = tables[table].filter(row => filters.every(filter => filter(row)));
          if (operation !== 'select') {
            if (failWrite || (failHistory && table === 'price_history')) return { data: null, error: new Error('injected update failure') };
            mutations.push(table + ':' + operation);
            if (operation === 'insert') {
              const row = { id: Math.max(0, ...tables[table].map(row => row.id ?? 0)) + 1, ...values };
              tables[table].push(row); matches = [row];
            } else matches.forEach(row => Object.assign(row, values));
          }
          return single ? (matches.length === 1 ? { data: structuredClone(matches[0]), error: null }
            : { data: null, error: { code: 'PGRST116', message: 'multiple (or no) rows returned' } })
            : { data: structuredClone(matches), error: null };
        };
        return Promise.resolve(execute()).then(resolve);
      },
    };
    return query;
  } };
  return { db, mutations, failWrite: () => { failWrite = true; }, failRead: () => { failRead = true; }, failHistory: () => { failHistory = true; } };
}
