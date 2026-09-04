# Current Price Refresh

Current flea prices are mutable and independent of immutable Tarkov data releases.
Recipe graphs, item relations, and item entities do not embed current prices in newly
generated snapshots. Runtime queries hydrate item summaries from `item_prices` and
fall back to the active release's legacy price entity while the mutable store is
being populated.

## Eligibility

The item ingestion adapter derives `onFleaMarket` from the upstream `noFlea` item
type. Refresh jobs query only item IDs marked `onFleaMarket: true` in the active
release. Releases generated before this field existed use the presence of a legacy
flea price as a compatibility fallback.

## Storage

- `item_prices` stores one current derived price and synchronization state per
  mode/item, including its ETag, last check, latest point, and failure state.
- `item_price_points` stores at most the ten newest endpoint points per mode/item.
- `price_refresh_locks` prevents overlapping refreshes for the same mode.
- `price_refresh_runs` records aggregate refresh outcomes.

The effective price is the offer-count-weighted average of the five newest valid
points. If none has a positive offer count, the newest point is used. Calculations
prefer this value; the release's `avg24hPrice` remains reference data and retains
the latest generated trader valuations.

## Manual operation

Apply the additive price tables once:

```bash
npm run db:prices:init
```

Refresh only seasonal prices:

```bash
npm run db:prices:refresh -- --modes pvp-season
```

Refresh regular and PVE prices:

```bash
npm run db:prices:refresh -- --modes regular,pve
```

The optional `--concurrency` value accepts 1 through 32 and defaults to 12.
Failed item requests retain their previous good data.

## Vercel schedules

`vercel.json` declares:

- `/api/cron/prices/seasonal` every two hours;
- `/api/cron/prices/daily` once daily at 00:15 UTC.

Both GET routes require `Authorization: Bearer <CRON_SECRET>`. Vercel adds this
header automatically when the project has a matching `CRON_SECRET` environment
variable. The two-hour schedule requires a Vercel plan that permits sub-daily
cron jobs. Schedules run only for production deployments.

The routes currently perform the complete refresh within one function invocation.
Run duration and provider behavior should be observed before enabling the schedules;
manual execution remains the operational fallback.
