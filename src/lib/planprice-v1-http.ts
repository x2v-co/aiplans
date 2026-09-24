import { NextResponse } from 'next/server';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function requestId(request: Request): string {
  const supplied = request.headers.get('x-request-id');
  return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
}

export function jsonResponse(
  request: Request,
  body: unknown,
  init: ResponseInit = {},
): NextResponse {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const bodyRequestId = body && typeof body === 'object' && 'requestId' in body && typeof body.requestId === 'string' && REQUEST_ID_PATTERN.test(body.requestId)
    ? body.requestId
    : requestId(request);
  headers.set('X-Request-Id', bodyRequestId);
  return NextResponse.json(body, { ...init, headers });
}

export function rejectNonJsonAccept(request: Request): NextResponse | null {
  const accept = request.headers.get('accept');
  if (!accept || accept === '*/*' || accept.split(',').some((part) => part.trim().split(';', 1)[0] === 'application/json' || part.trim().split(';', 1)[0] === '*/*')) return null;
  return jsonResponse(request, {
    schemaVersion: 'planprice-error/1',
    code: 'not_acceptable',
    message: 'Accept must include application/json',
    retryable: false,
    requestId: requestId(request),
  }, { status: 406, headers: { 'Cache-Control': 'no-store' } });
}

/** v1 exposes complete snapshots only; filtering and pagination are client-side. */
export function rejectUnsupportedQuery(request: Request): NextResponse | null {
  const { searchParams } = new URL(request.url);
  if (searchParams.keys().next().done) return null;
  return jsonResponse(request, {
    schemaVersion: 'planprice-error/1',
    code: 'invalid_query',
    message: 'Query parameters are not supported by the v1 snapshot protocol',
    retryable: false,
    requestId: requestId(request),
  }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

export function unauthorized(request: Request): NextResponse {
  return jsonResponse(request, {
    schemaVersion: 'planprice-error/1',
    code: 'unauthorized',
    message: 'Bearer token required',
    retryable: false,
    requestId: requestId(request),
  }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } });
}

export function authorized(request: Request): boolean {
  const token = process.env.PLANPRICE_CATALOG_TOKEN;
  return Boolean(token && request.headers.get('authorization') === `Bearer ${token}`);
}

export function methodNotAllowed(request: Request, _context?: unknown): NextResponse {
  void _context;
  return jsonResponse(request, {
    schemaVersion: 'planprice-error/1',
    code: 'method_not_allowed',
    message: 'Method not allowed',
    retryable: false,
    requestId: requestId(request),
  }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
}
