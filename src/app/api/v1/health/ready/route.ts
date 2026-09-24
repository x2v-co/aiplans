import { sql } from '@/lib/db';
import { readPlanpriceV1Snapshot } from '@/lib/planprice-v1-snapshot';
import { authorized, jsonResponse, methodNotAllowed, rejectNonJsonAccept, unauthorized } from '@/lib/planprice-v1-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unacceptable = rejectNonJsonAccept(request);
  if (unacceptable) return unacceptable;
  if (!authorized(request)) return unauthorized(request);
  try {
    const [result] = await sql<Array<{ ok: number }>>`SELECT 1 AS ok`;
    if (result?.ok !== 1) throw new Error('database unavailable');
    const snapshot = await readPlanpriceV1Snapshot();
    if (!snapshot) return jsonResponse(request, { schemaVersion: 'planprice-health/1', status: 'not_ready', reason: 'catalog_missing', checkedAt: new Date().toISOString(), database: { ready: true }, catalog: { ready: false, catalogVersion: null, expiresAt: null } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    const expiresAt = typeof snapshot.expiresAt === 'string' ? snapshot.expiresAt : null;
    if (!expiresAt || Date.parse(expiresAt) <= Date.now()) return jsonResponse(request, { schemaVersion: 'planprice-health/1', status: 'not_ready', reason: 'catalog_expired', checkedAt: new Date().toISOString(), database: { ready: true }, catalog: { ready: false, catalogVersion: snapshot.catalogVersion ?? null, expiresAt } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    return jsonResponse(request, { schemaVersion: 'planprice-health/1', status: 'ready', reason: null, checkedAt: new Date().toISOString(), database: { ready: true }, catalog: { ready: true, catalogVersion: snapshot.catalogVersion, expiresAt } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonResponse(request, { schemaVersion: 'planprice-health/1', status: 'not_ready', reason: 'database_unavailable', checkedAt: new Date().toISOString(), database: { ready: false }, catalog: { ready: false, catalogVersion: null, expiresAt: null } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
