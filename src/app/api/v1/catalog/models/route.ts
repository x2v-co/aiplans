import { readPlanpriceV1Snapshot } from '@/lib/planprice-v1-snapshot';
import { authorized, jsonResponse, methodNotAllowed, rejectNonJsonAccept, rejectUnsupportedQuery, unauthorized, requestId } from '@/lib/planprice-v1-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unacceptable = rejectNonJsonAccept(request);
  if (unacceptable) return unacceptable;
  if (!authorized(request)) return unauthorized(request);
  const invalidQuery = rejectUnsupportedQuery(request);
  if (invalidQuery) return invalidQuery;
  const snapshot = await readPlanpriceV1Snapshot();
  const expiresAt = typeof snapshot?.expiresAt === 'string' ? Date.parse(snapshot.expiresAt) : NaN;
  if (!snapshot || snapshot.schemaVersion !== 'planprice-catalog/1' || typeof snapshot.catalogVersion !== 'string' || !Array.isArray(snapshot.offerings) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return jsonResponse(request, { schemaVersion: 'planprice-error/1', code: 'catalog_unavailable', message: 'Formal v1 catalog has not been published or has expired', retryable: true, requestId: requestId(request) }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const etag = `W/"${snapshot.digest}"`;
  const headers = { 'Cache-Control': 'private, no-cache, must-revalidate', Vary: 'Authorization, Accept', ETag: etag };
  if (request.headers.get('if-none-match') === etag || request.headers.get('if-none-match') === snapshot.digest) {
    return new Response(null, { status: 304, headers: { ...headers, 'X-Request-Id': requestId(request) } });
  }
  return jsonResponse(request, snapshot, { headers });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
