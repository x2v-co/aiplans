# 百炼 Xing/Xing4.1-Preview

Official API identity: `Xing/Xing4.1-Preview`; catalog slug:
`xing-xing4-1-preview`. This ordinary text LLM uses `models` and
`api_channel_prices`, following the manual text-model seeds. Its vendor is
星辰大模型 (`xing`); its offering channel reuses Model Studio (`qwen`).
TeleAI Xing4.0 is a separate identity. No image, decision or rerank row is added.

Verified 2026-11-27 against the supplied official snapshots:

- [Model page](https://help.aliyun.com/zh/model-studio/xing-4-1-preview-by-xing.md):
  Text → Text, 285B / 17B active, context 1048576, maximum input 917504,
  maximum output and thinking-chain length 131072. Thinking-mode input/output
  limits match. Function Calling, structured output and context cache supported;
  Batch unsupported. Beijing RPM 300 / TPM 1,000,000.
- [Pricing](https://help.aliyun.com/zh/model-studio/model-pricing.md):
  华北2（北京） only; CNY per million tokens: input 1.5, output 6
  (思维链和回答). Free quota 无. Cache-hit input 0.03 comes from the model page.
  No cache-create, Batch, other-region or USD price is added.
- [Newly released](https://help.aliyun.com/zh/model-studio/newly-released-models.md):
  listing date 2026-11-23, retained in the description. No release timestamp is inferred.

`npm run seed:catalog-2026-11-27-xing` defaults to an offline `fakeSeedTx`
rehearsal whose simulated writes roll back. It does not connect to a database.
`--db` requires an explicit `DATABASE_URL`, loads no environment files, and uses
`runRehearsable` to execute writes then ROLLBACK. Only the explicit `--apply`
option (`seed:catalog-2026-11-27-xing:apply`) commits. The seed is excluded from
`deploy/production/seed-catalog.sh`. Applying it is a separate operation and was
not requested for this change.

`PRODUCTION_SHAPED_DRY_RUN` is an expectation, **not a measured production dry-run**:
with `qwen` present and `xing`, the model and its price absent, it is
providers **1 insert / 0 update**, models **1 insert / 0 update**,
api_channel_prices **1 insert / 0 update**. If `xing` already exists, provider
inserts become 0. No usage-price or price-variant rows are created. Duplicate or
non-canonical identities fail before writes; newer channel evidence and locked
unavailability are preserved. No deletes.
