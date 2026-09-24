import { readPlanpriceV1ExchangeRates } from '@/lib/planprice-v1-snapshot';
import { authorized, jsonResponse, methodNotAllowed, rejectNonJsonAccept, requestId, unauthorized } from '@/lib/planprice-v1-http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const unacceptable = rejectNonJsonAccept(request);
  if (unacceptable) return unacceptable;
  if (!authorized(request)) return unauthorized(request);
  const snapshot = await readPlanpriceV1ExchangeRates();
  if (!snapshot || snapshot.schemaVersion !== 'planprice-exchange-rates/1' || snapshot.base !== 'USD' || !Array.isArray(snapshot.quotes) || snapshot.quotes.length === 0) return jsonResponse(request, { schemaVersion: 'planprice-error/1', code: 'catalog_unavailable', message: 'Formal v1 exchange rates have not been published', retryable: true, requestId: requestId(request) }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return jsonResponse(request, snapshot, { headers: { 'Cache-Control': 'private, no-cache, must-revalidate', Vary: 'Authorization, Accept' } });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
