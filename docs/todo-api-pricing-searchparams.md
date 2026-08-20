# TODO: move /api-pricing filtering into the URL

Status: **not started.** The SSR fix that landed alongside this note solved the
crawlability problem; this is the follow-up that would make filtered views
themselves rankable. Written 2026-08-20.

## Where things stand

`/[locale]/api-pricing`, `/[locale]/compare/plans`, `/[locale]/coupons` and the
landing page each used to be a single client component that fetched its data in
a `useEffect`. A `"use client"` component *is* server-rendered — the boundary
controls hydration, not SSR — but the effect only runs in the browser, so the
server rendered the `loading === true` branch and emitted a spinner. Crawlers
got 63 characters for `/api-pricing`, the page CLAUDE.md calls the site's core
SEO surface.

Each page is now split in two: a server `page.tsx` that awaits the data and a
`*-view.tsx` client component that receives it as a prop. The payload builders
moved out of the API routes into `src/lib/` (`grouped-products.ts`,
`products.ts`, `plans.ts`, `coupons.ts`, `compare-plans-index.ts`) so both the
route and the page call one implementation. `/en/api-pricing` now serves ~57KB
of visible text, 320 model links and 459 channel rows.

Search, sorting and the four filters stayed client-side and unchanged.

## What is still worth doing

Every filter state lives in `useState`, so there is exactly one URL for every
view of the data:

```
/en/api-pricing        ← 320 models, all channels, every filter combination
```

Two consequences:

1. **The whole dataset ships to the browser on every visit.** SSR serialises it
   twice — once as rendered HTML, once as the flight payload React hydrates
   from. Raw that is ~337KB of JSON; ~16KB gzipped, so this is a real cost but
   not an urgent one.
2. **No filtered view is addressable.** "cheapest Claude channel reachable from
   China" is a query this database can answer and a thing people search for, and
   there is no URL to rank for it.

The fix is to drive the filters from `searchParams` and filter in SQL:

```
/en/api-pricing?region=china&type=official&sort=price
/en/api-pricing?q=claude
```

- `page.tsx` reads `searchParams`, passes them to `getGroupedProducts()`, which
  grows `WHERE` clauses instead of returning everything.
- The view keeps its controls but writes to the URL (`useRouter().replace`,
  or a `<form>` with `GET`) rather than to local state.
- Instant feedback comes from `useTransition` — without it every keystroke in
  the search box becomes a server round trip. Debounce the text input; the
  selects can navigate immediately.
- Add the filter combinations worth indexing to `src/app/sitemap.ts` and
  `rel="canonical"` the rest back to the bare page, or the crawl budget goes to
  a combinatorial explosion of near-duplicates.

## Why it was deferred

It is a rewrite of the interaction layer, and the SEO hole it would close is
smaller than the one already closed. Sequencing the cheap fix first also means
the searchParams work can be judged on its own merits (traffic on long-tail
filter queries) instead of being bundled into a crawlability bug fix.

## Related

- `docs/archive/COMPARE_PLANS_ROUTE_FIX.md` — the same client-render bug on
  `/compare/plans/[model]`, fixed the same way.
- The "Common gotchas" section of `CLAUDE.md` on why these routes must never get
  a route-level `loading.tsx`: an ancestor Suspense boundary flushes the shell
  and commits a 200 before the page body runs, which turns every `notFound()`
  into a soft 404.
