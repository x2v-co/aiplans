# Non-LLM catalog seed (2026-10-15)

Static voice/image list and detail pages, plus the Jev versions in decision
models, render immediately from `src/lib/non-llm-catalog.ts`. Missing DB rows
or enrichment columns do not remove these facts. No new schema is needed:
existing speech/image/decision categories, usage prices and lifecycle columns
cover this change. Matrix-Game 4.0 already has Apache-2.0, open weights and
`not_applicable` pricing and was left unchanged. No embedding vertical exists,
so Embedding Gemma 2 is skipped.

SRE preview (offline; no database connection or writes):

```sh
npm run seed:non-llm-2026-10-15
```

SRE apply, from the deployed checkout with its normal `DATABASE_URL` configured:

```sh
npm run seed:non-llm-2026-10-15:apply
```

`npm run seed:non-llm-2026-10-15 -- --apply` is equivalent. Apply runs one
serializable transaction, upserting only these providers/models and their manual
reference plans, mappings and usage prices. Plan subscription prices stay null.
Microsoft owns the MAI models; Vercel AI Gateway owns their price references.
Other Moondream rows receive the shutdown dates and lifecycle note while
retaining their original model metadata and prices. Ambiguous identities abort
the transaction; a repeated apply produces no changes.

This seed is optional and is not part of deploy. Existing broad vertical and
catalog-audit seeds skip these entries. The rollout DB catalog audit reports
their missing/stale DB references as warnings; existing entries retain their
critical checks. After seeding, the new references satisfy that same audit.

Only the supplied facts file was used. Remaining verification items:

- The expected Jev alias switch around October 21 is unverified text only;
  current aliases remain `jev-latest → 1.13.0`, `jev-preview → 1.14.0`.
- xAI voice 2.0 uses the audit date, October 15, for `deprecated_at` because
  the exact announcement date was not supplied; the source is recorded.
- Moondream pricing and Microsoft first-party pricing were not supplied.
  Moondream has no numeric price; MAI prices are explicitly Vercel channel prices.
- The MAI base model's starting image price is approximate. No per-image Flash
  price or per-task Jev price is inferred.
