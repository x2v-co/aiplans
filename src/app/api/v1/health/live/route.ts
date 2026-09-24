import { jsonResponse, methodNotAllowed, rejectNonJsonAccept } from '@/lib/planprice-v1-http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const unacceptable = rejectNonJsonAccept(request);
  if (unacceptable) return unacceptable;
  return jsonResponse(request, { schemaVersion: 'planprice-health/1', status: 'alive' }, { headers: { 'Cache-Control': 'no-store' } });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
