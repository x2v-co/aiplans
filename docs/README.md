# Docs

Current project documentation. Stale implementation notes from earlier
iterations (Arena v1/v2, old plan scraper designs, one-off data reports)
were removed in the 2026-04 cleanup — any "how X was built" history now
lives in git log + commit messages.

```
docs/
├── README.md        # This index
├── BLOG_POST.md     # Blog-style write-up for marketing
└── PRODUCT_HUNT.md  # Product Hunt launch copy
```

## Root-level docs

- **`README.md`** — public project overview + quick-start
- **`CLAUDE.md`** — authoritative system doc for Claude Code sessions
  (architecture, commands, data accuracy contract, gotchas)
- **`DEVELOPMENT_PLAN.md`** — pre-session planning artifact (historical)
- **`MRD.md`** — product requirements (historical)

## Related

- `scripts/README.md` — data-layer tooling walkthrough
- `scripts/scrapers/DYNAMIC_SCRAPERS.md` — scraper-specific architecture notes
