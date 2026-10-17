# Reflection Beam on Vercel AI Gateway

Verified 2026-10-17 from the [Vercel endpoints API](https://ai-gateway.vercel.sh/v1/models/reflection/beam/endpoints)
and [launch changelog](https://vercel.com/changelog/reflection-ai-beam-now-available-on-ai-gateway-for-free).

USD per 1M tokens:

| Upstream | Input | Output | Cache read |
| --- | ---: | ---: | ---: |
| reflection | 0 | 0 | 0 |
| nebius | 0.25 | 1.00 | Unknown |
| togetherai | 0.40 | 1.20 | 0.04 |
| baseten | 1.30 | 4.30 | 0.13 |

`reflection/beam` with provider `reflection` is temporarily free and transitions
to paid pricing when the offer ends. Neither the end date nor future prices are
published. `reflection/beam-free` has zero input/output prices and stops serving
when the offer ends. Its cache price is unverified. No cutoff, future price, or
OpenCode free offer is inferred.

The seed requires an existing Beam model (including OpenRouter's normalized slug
`reflection-beam-1-0-501b-a23b`) and reuses either `vercel` or `vercel-ai-gateway`.
It creates the Vercel provider only if neither exists. Missing or ambiguous model
identities, provider aliases, channel rows, or variant keys abort before writes.
Model metadata, OpenRouter channels and variants, and subscription mappings are
preserved.

As with OpenRouter upstreams, one `api_channel_prices` row holds the headline
and `api_channel_price_variants` holds the four upstreams plus the free model
alias. The headline explicitly requires provider `reflection`; it does not
promise free default routing or failover. Notes and variant constraints record
the two different offer endings. Unknown cache/future prices and dates remain
NULL. Other headlines on this Vercel/Beam pair are demoted.

This is an optional operator seed, outside deployment and scraper workflows.
Existing price-variant and introductory-price schema migrations must be present.

```bash
# Read-only preview, using the configured database; don't use production for development.
npm run seed:reflection-beam
npm run seed:reflection-beam -- --dry-run

# Operator-only write command; not run during development of this seed.
npm run seed:reflection-beam -- --apply

# Database-free unit tests
npx tsx --test scripts/data/reflection-beam-2026-10-17.test.ts
```

The CLI uses one serializable transaction, sets it READ ONLY for previews, prints
field-level changes, and closes the client on success or failure. Dry-run
negative IDs stand for a future provider insert. Reruns skip unchanged rows.
