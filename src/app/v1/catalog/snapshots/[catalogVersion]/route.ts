import { readPlanpriceV1SnapshotVersion, isPlanpriceV1Version } from '@/lib/planprice-v1-snapshot';
import { authorized, jsonResponse, methodNotAllowed, rejectNonJsonAccept, requestId, unauthorized } from '@/lib/planprice-v1-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ catalogVersion: string }> }) {
  const unacceptable = rejectNonJsonAccept(request);
  if (unacceptable) return unacceptable;
  if (!authorized(request)) return unauthorized(request);
  const { catalogVersion } = await context.params;
  if (!isPlanpriceV1Version(catalogVersion)) return jsonResponse(request, { schemaVersion: 'planprice-error/1', code: 'invalid_query', message: 'Invalid catalogVersion', retryable: false, requestId: requestId(request) }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const snapshot = await readPlanpriceV1SnapshotVersion(catalogVersion);
  if (!snapshot || snapshot.catalogVersion !== catalogVersion) return jsonResponse(request, { schemaVersion: 'planprice-error/1', code: 'snapshot_not_found', message: 'Catalog snapshot not found', retryable: false, requestId: requestId(request) }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const etag = `W/"${snapshot.digest}"`;
  const headers = { 'Cache-Control': 'private, no-cache, must-revalidate', Vary: 'Authorization, Accept', ETag: etag };
  if (request.headers.get('if-none-match') === etag || request.headers.get('if-none-match') === snapshot.digest) return new Response(null, { status: 304, headers: { ...headers, 'X-Request-Id': requestId(request) } });
  return jsonResponse(request, snapshot, { headers });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
