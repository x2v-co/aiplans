/** Durable, source-reviewed feed binding. This continues the pre-merge writer;
 * it makes no claim about equivalence of the two historical quote contracts. */
export const O3_BATCH_FEED = Object.freeze({
  source: 'OpenRouter', upstreamModelId: 'openai/o3:batch',
  modelId: 3192, modelSlug: 'openai-o3-batch', providerId: 59, channelId: 15334,
  retainedChannelId: 15031, sourceModelId: 3014, sourceModelSlug: 'o3-(batch)',
});

export type FeedIdentity = { source: string; upstreamModelId?: string };
type Row = Record<string, any>; // Existing query builder's public row contract.
type Result = { data: Row[] | null; error: unknown };
type Query = PromiseLike<Result> & { select(columns: string): Query; eq(column: string, value: unknown): Query };
export type ChannelReadClient = { from(table: string): Query };

/** Array selection distinguishes absence from ambiguity; PGRST116 is never
 * treated as authorization to INSERT. Used by both baseline/history and upsert. */
export async function currentChannelWriteTarget(
  client: ChannelReadClient, modelId: number, providerId: number, feed?: FeedIdentity,
): Promise<Row | null> {
  const { data, error } = await client.from('api_channel_prices').select('*')
    .eq('model_id', modelId).eq('provider_id', providerId);
  if (error) throw error;
  const rows = data ?? [];
  const binding = O3_BATCH_FEED;
  const bound = feed?.source === binding.source && feed.upstreamModelId === binding.upstreamModelId;
  if (bound) {
    if (modelId !== binding.modelId || providerId !== binding.providerId) throw new Error('o3 batch feed identity rebound');
    const model = await client.from('models').select('id, slug').eq('id', modelId);
    if (model.error) throw model.error;
    if (model.data?.length !== 1 || model.data[0].slug !== binding.modelSlug) throw new Error('o3 batch model identity drift');
    const retained = await client.from('api_channel_prices').select('id, model_id, provider_id, is_available').eq('id', binding.retainedChannelId);
    if (retained.error) throw retained.error;
    const source = retained.data?.[0];
    if (retained.data?.length !== 1 || source?.provider_id !== binding.providerId || source.is_available !== false ||
      ![binding.sourceModelId, binding.modelId].includes(source.model_id)) throw new Error('o3 batch retained channel identity drift');
    if (source.model_id === binding.sourceModelId) {
      const origin = await client.from('models').select('id, slug').eq('id', binding.sourceModelId);
      if (origin.error) throw origin.error;
      if (origin.data?.length !== 1 || origin.data[0].slug !== binding.sourceModelSlug) throw new Error('o3 batch source identity drift');
    }
    const target = rows.find(row => row.id === binding.channelId);
    if (!target || target.is_available !== true || rows.some(row => row.id !== binding.channelId &&
      (row.id !== binding.retainedChannelId || row.is_available !== false))) {
      throw new Error('o3 batch channel binding drift; no write permitted');
    }
    return target;
  }
  if (rows.length > 1) throw new Error('Ambiguous channel write target; explicit reviewed feed binding required');
  if (rows.some(row => row.id === binding.retainedChannelId)) throw new Error('Retained o3 batch channel is OFF; no unbound write permitted');
  if (modelId === binding.modelId && providerId === binding.providerId) throw new Error('Reviewed o3 batch feed required; no unbound write permitted');
  return rows[0] ?? null;
}
