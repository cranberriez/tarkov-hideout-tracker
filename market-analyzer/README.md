# Market analyzer

A small Dockerized worker for the VPS. It keeps flea prices fresh and records derived
market analytics in the site's PostgreSQL. The website still owns reads; this worker
only writes.

It bundles the website's own pricing code from [src/](../src/) (history normalization,
effective price, flea tax, trader comparisons), so both produce identical results for
identical inputs.

## What it does

| Step      | Seasonal (`pvp-season`) | Regular / PVE | Touches PostgreSQL?                         |
| --------- | ----------------------- | ------------- | ------------------------------------------- |
| Poll      | every 30 min            | every 6 h     | No (upstream + local cache only)            |
| Push      | hourly                  | hourly        | Only if something changed                   |
| Catalog   | every 6 h               | every 6 h     | Reference prices / trader offers, at a push |
| Analytics | 00:00 / 12:00 UTC       | 00:00 UTC     | One row per item with new upstream data     |

- **Poll**: conditional (ETag) requests to `json.tarkov.dev/{mode}/prices/{id}`. A full
  304 pass takes a few seconds. Full histories are cached on the `/data` volume, never
  in PostgreSQL; Tarkov.dev stays the canonical raw history.
- **Push**: changed items go through the site's
  [price store](../src/server/prices/price-store.ts) under the same per-mode lease as the
  Vercel crons, so they never write concurrently. Not-modified checks are not written.
  The cache is the push buffer (dirty flags), so a restart cannot lose changes.
- **Exclusions**: items that 404 or have no history since the cutoff are not on the flea
  in that mode. They are skipped on later polls until a recheck is requested.
- **Analytics**: [explainable measurements](src/analytics/metrics.ts) and the
  [economic envelope](src/analytics/economics.ts), written to `item_market_observations`
  with one `market_analysis_runs` row per pass.

## Analytics fields

Market state uses flea minimum listing prices. Windows are time-weighted: each
observation counts for the time it represents (capped at 26 h), because upstream
history is two-hourly recently and daily further back.

| Field                                       | Meaning                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `live_*`                                    | Latest upstream observation                                               |
| `market_value`, `stability`                 | The site's robust current estimate (same function as `item_prices.price`) |
| `median_24h/7d/30d`                         | Time-weighted medians; null below 50% window coverage                     |
| `range_low_7d/high_7d`                      | 7-day p10–p90: the recent normal range                                    |
| `change_6h/24h/7d`                          | Change of the robust level versus that long ago                           |
| `percentile_30d`                            | Share of the last 30 days spent below the market value                    |
| `volatility_7d`                             | (p75 − p25) / median over 7 days                                          |
| `trend`                                     | 7-day change beyond max(5%, volatility / 2); `unknown` without coverage   |
| `persistence_hours`                         | How long the current price regime (within 1.25×) has held                 |
| `depth_median_24h`                          | Listing depth: supporting evidence, not volume                            |
| `confidence`, `confidence_reasons`          | high / medium / low with explicit reasons (stale, thin, volatile, …)      |
| `trader_value`, `base_price`                | Best trader buyback and inferred base value                               |
| `flea_net`, `flea_fee`                      | Net of listing at market value (no Intelligence Center reduction)         |
| `trader_break_even`, `practical_break_even` | Asking price matching the trader, and beating it by min(5%, 5,000 ₽)      |
| `max_net_price`, `max_net`                  | Listing price with the highest net; above it fees eat the increase        |

## Run it

The migration is shared with the site: run `npm run db:migrate` from the repository
root against the target database first (applies `0002_market_analytics.sql`).

```bash
cp .sample.env .env
docker compose up -d --build
```

Commands (use `docker compose run --rm market-analyzer <command>` or `exec`):

| Command                             | Purpose                                        |
| ----------------------------------- | ---------------------------------------------- |
| `run` (default)                     | Long-running scheduler                         |
| `once [--modes pvp-season,regular]` | Every step once, then exit                     |
| `status [--modes …]`                | Local cache/state summary (no database access) |
| `recheck-excluded [--modes …]`      | Check excluded items again on the next poll    |

Configuration is in [.sample.env](.sample.env); only `DATABASE_URL` is required. Logs
are JSON lines. The container health check watches `/data/heartbeat.json`.

## Development

From this directory, with the repository root's dependencies installed:

```bash
npm install
npm test
npm run typecheck
npm run once
```

`npm run once` builds the bundle and runs every step once using `.env` (point
`DATABASE_URL` at a development database).
