/**
 * 审计（2026-10-15）把 OpenRouter 上没有固定单价的路由模型（-1 哨兵，如
 * typesafe/jev-router、nvidia/switchyard）记为 价格 NULL + is_available=false。
 * 任何写入方只要不给出真实数字价格，就不能把这类人工下架行改回可用。
 */
export const VARIABLE_ROUTER_SENTINEL = '[needs-verification] Variable/router pricing';

type ExistingRow = { is_available?: boolean | null; notes?: string | null } | null | undefined;
type Incoming = { is_available: boolean; input_price_per_1m: number | null; output_price_per_1m: number | null };

export function isManuallyUnavailable(existing: ExistingRow): boolean {
  return existing?.is_available === false && String(existing.notes ?? '').includes(VARIABLE_ROUTER_SENTINEL);
}

export function retainManualUnavailable<T extends Incoming>(data: T, existing: ExistingRow): T {
  if (!data.is_available || !isManuallyUnavailable(existing)) return data;
  const priced = Number.isFinite(data.input_price_per_1m as number) && Number.isFinite(data.output_price_per_1m as number)
    && data.input_price_per_1m != null && data.output_price_per_1m != null;
  return priced ? data : { ...data, is_available: false };
}
