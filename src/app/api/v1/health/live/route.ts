import { jsonResponse, methodNotAllowed, rejectNonJsonAccept, rejectUnsupportedQuery } from '@/lib/planprice-v1-http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const unacceptable = rejectNonJsonAccept(request);
  if (unacceptable) return unacceptable;
  const invalidQuery = rejectUnsupportedQuery(request);
  if (invalidQuery) return invalidQuery;
  return jsonResponse(request, { schemaVersion: 'planprice-health/1', status: 'alive' }, { headers: { 'Cache-Control': 'no-store' } });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
