# Static catalog audit (2026-10-15)

Decision-1 is excluded from the static catalog because no provider, access path
or source URL is known. Restore it only after those facts can be sourced; no
price has been inferred for it.

Audited video/music/decision entries retain their sourced numeric prices in the
static catalog. The static audit accepts `pricingConfidence: verified` with
`priceStatus: priced`, a currency, pricing unit, verification date and source,
plus a numeric unit price or decision input/output token prices. Zero output
prices mean free output; unknown task prices remain null. Other unverified
prices remain unknown. DB drift checks still require the existing DB references
when explicitly invoked with `--db`.

Modalities: video generation takes text/image and produces video; Lyria takes
text and produces audio; decision models take text and return text (including
classification labels).

DB-free validation: `npm run audit:verticals`, `npm run lint`, `npm test`,
`npx tsc --noEmit`.
