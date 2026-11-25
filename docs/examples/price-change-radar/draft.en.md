# Price-change radar draft (do not send)

> Synthetic fixture. This is not market data and must not be cited as fact.

- Status: draft. Do not publish or send it to Feishu, email, or an external platform.
- Denoising threshold: 15% (a configurable parameter that shortens the draft)
- Comparison clock: 2026-11-01T00:00:00.000Z
- Previous citable sample: sha256:ca5196fed125d5ca585dfa049f19fe04bc586beebb523046fbac5d4f57354cfd
- Current citable sample: sha256:dab3a8ab4abaec7c03f2918c86bef565b5d14da9682463b3638be522cb814e17
- Publishable snapshot-comparison events: 1

## Publishable events

### Example Alpha (synthetic fixture) / Example Official

- Model slug: `example-alpha`
- Channel: `example-official`
- Currency / unit / conditions: USD / per_1m_tokens / `scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=quoted;promo=none`
- input: 2 → 3 (+50%)
- output: 8 → 8 (0%)
- cached_input: 1 → 1 (0%)
- Previous source: https://example.test/pricing/alpha
- Current source: https://example.test/pricing/alpha
- Previous verification: 2026-10-20T00:00:00.000Z
- Current verification: 2026-10-20T00:00:00.000Z
- Site citation: https://aiplans.dev/en/models/example-alpha

## Not emitted as events

- `example-beta / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: below_threshold (below the denoising threshold); max_abs_percent=10.00
- `example-delta / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: zero_value (a zero price makes the move incomparable)
- `example-epsilon / example-official`: missing_price (a comparable input or output price is missing)
- `example-eta / example-official`: condition_changed (billing conditions changed)
- `example-gamma / example-official`: unit_changed (price unit changed)
- `example-iota / example-official`: not_in_current_rows (absent from the current rows)
- `example-kappa-v2 / example-official`: version_replaced (model version was replaced); example-kappa-v1 -> example-kappa-v2
- `example-nu / example-official`: new_listing (no previous row for this model and channel)
- `example-omicron / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: missing_source (a verifiable https source is missing)
- `example-pi / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: unverified (verification time is missing)
- `example-theta / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: stale (verification is older than the staleness window)
- `example-zeta / example-official`: currency_changed (currency changed)

## Left out of the citable sample

- invalid_source: 1
- missing_price: 1
- missing_source: 1
- non_official_channel: 2
- restricted_or_nonpublic: 1
- stale: 1
- unavailable: 1
- unverified: 1

## Price-history log

Reviewed 1 rows. 0 can stand alone as drafts. A stock price_history row stores one currency and the prices, without old/new units, billing conditions, source URLs, and verification times on both sides. Those rows stay incomplete_history and do not become events.
The history log has no publishable events.
- *: incomplete_history (the history row lacks same-scope fields)
- incomplete_history: 1

Same scope means the same model slug, channel, currency, price unit, and billing conditions. Missing values, zeros, unit or currency changes, new listings, version replacements, stale rows, and unverified rows stay out of the publishable events.

