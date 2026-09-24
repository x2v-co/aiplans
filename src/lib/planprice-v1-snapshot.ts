import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const VERSION_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._~-]{0,119}$/;

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

function digestPayload(value: Record<string, unknown>): string {
  const payload = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'digest'));
  return `sha256:${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}`;
}

async function readJson(path: string | undefined): Promise<Record<string, unknown> | null> {
  if (!path) return null;
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readDigestedJson(path: string | undefined): Promise<Record<string, unknown> | null> {
  const value = await readJson(path);
  if (!value || typeof value.digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.digest)) return null;
  return value.digest === digestPayload(value) ? value : null;
}

/** Read the current immutable catalog snapshot. */
export async function readPlanpriceV1Snapshot(): Promise<Record<string, unknown> | null> {
  return readDigestedJson(process.env.PLANPRICE_V1_SNAPSHOT_PATH);
}

/** Read an immutable historical snapshot retained under the configured directory. */
export async function readPlanpriceV1SnapshotVersion(version: string): Promise<Record<string, unknown> | null> {
  if (!VERSION_PATTERN.test(version)) return null;
  const directory = process.env.PLANPRICE_V1_SNAPSHOT_DIR;
  if (!directory) return null;
  return readDigestedJson(`${directory}/${version}.json`);
}

/** Read the separately published exchange-rate snapshot. */
export async function readPlanpriceV1ExchangeRates(): Promise<Record<string, unknown> | null> {
  return readJson(process.env.PLANPRICE_V1_FX_PATH);
}

export function isPlanpriceV1Version(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.test(value);
}
