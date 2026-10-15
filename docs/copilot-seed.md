Copilot is an optional data rollout, using the existing plans and channel-terms schema. Deployment does not run this seed or require its rows. No new migration is needed.

After the existing channel-terms migration is deployed, SRE can run with the intended database configuration:

```sh
npm run seed:copilot         # default: read-only transaction, field-level preview
npm run seed:copilot:apply   # explicit: serializable transaction, idempotent writes
```

The seed reuses GitHub's provider/product ID, protects unrelated records and manual model links, and writes derived preview-pool links only for models already in the catalog. Missing models are skipped; rerun after catalog additions or use the usual mapping materializer. If no pool model exists, the selector remains NULL until the seed is rerun. Free and Max have no verified model selector.

Business and Enterprise have NULL seat prices, NULL verification timestamps, and `[needs-verification]` notes. HydraFusion and HydraFusion Max are preview features on Pro, Pro+, Business and Enterprise with preview features enabled; they are never priced model rows. Their billing multiplier is unverified. Max is not listed in the preview changelog, and its training policy is not covered by the supplied Free/Pro/Pro+ statement. Annual pricing, regional access and payment methods also remain unverified. Flex credits may change.

Sources are the supplied GitHub Copilot facts dated 2026-10-15, including the official plans page and HydraFusion changelog URLs stored in plan notes. The plans page is already enabled in the daily quota-text monitor.
