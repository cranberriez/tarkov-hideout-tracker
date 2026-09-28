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
observation counts for the time it represents. Upstream keeps daily aggregates (00:00
UTC, held up to 26 h) for older history and a snapshot about every two hours recently
(held up to 3 h). It records nothing when no listings exist, so a gap counts as no data,
never as the last price persisting.

| Field                                       | Meaning                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `live_*`                                    | Latest upstream observation                                               |
| `market_value`, `stability`                 | The site's robust current estimate (same function as `item_prices.price`) |
| `median_24h/7d/30d`                         | Time-weighted medians; null below 50% window coverage                     |
| `range_low_7d/high_7d`                      | 7-day p10–p90: the recent normal range                                    |
| `change_6h/24h/7d`                          | Market value now vs the market value as of then (null if either is stale) |
| `change_24h_rub/7d_rub`                     | The same changes in roubles, e.g. to compare with `flea_fee`              |
| `current_level`                             | Median of the last 3 snapshots: responsive, unlike the market value       |
| `move_12h`                                  | Robust (Theil–Sen) direction of the last 12 h, as change per 12 h         |
| `shock_*`, `retracement`                    | A ≥2× move within 72 h and how much of it has been given back (below)     |
| `percentile_30d`                            | Share of the last 30 days spent below the market value                    |
| `volatility_7d`                             | (p75 − p25) / median over 7 days                                          |
| `trend`                                     | 7-day change beyond max(5%, volatility / 2); `unknown` without coverage   |
| `persistence_hours`                         | How long the current price regime (within 1.25×) has held                 |
| `depth_median_24h`                          | Listing depth: supporting evidence, not volume                            |
| `confidence`, `confidence_reasons`          | high / medium / low with reasons (stale, thin, thin-large-move, …)        |
| `trader_value`, `base_price`                | Best trader buyback and inferred base value                               |
| `flea_net`, `flea_fee`                      | Net of listing at market value (no Intelligence Center reduction)         |
| `trader_break_even`, `practical_break_even` | Asking price matching the trader, and beating it by min(5%, 5,000 ₽)      |
| `max_net_price`, `max_net`                  | Listing price with the highest net; above it fees eat the increase        |

### Shocks and retracement

Flea spikes rarely persist: a demand shock draws sellers in and undercutting walks the
minimum back down (crashes the reverse). A **shock** is a robust level (median of three
consecutive snapshots, so a lone listing cannot form one) at least 2× away from the market
value 24 h before it, within the last 72 h. `retracement` is the share of the jump given
back. The phase is `reverted` (≥ 85% back), `retracing` (the 12 h move is ≥ 10% against
the shock), `holding` (< 25% back) or `settled` (a new level). Example: VAZ car key, 2k →
18k, retracing, 56% back, −23% over 12 h, where the 24 h change alone says +800%.

## Run it

The migration is shared with the site: run `npm run db:migrate` from the repository
root against the target database first (applies `0002_market_analytics.sql`).

```bash
cp .sample.env .env
docker compose up -d --build
```

Commands run inside the container: `docker compose exec market-analyzer node dist/worker.cjs <command>`.

| Command                        | Purpose                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `run` (default)                | Long-running scheduler                                               |
| `run-now <spec>`               | Ask the running worker to run steps now (picked up within ~5 s)      |
| `once [spec]`                  | Run steps once and exit (default `all`); refused while a worker runs |
| `status [--modes …]`           | Local cache/state summary (no database access)                       |
| `recheck-excluded [--modes …]` | Check excluded items again on the next poll                          |

A spec is `mode:steps`, comma-separated: `pvp-season:analyze`, `pvp-season:poll+push`,
`regular` (all steps) or `all:analyze`. Steps are `poll` (also refreshes the eligible
list), `push` (also refreshes catalog prices) and `analyze` (items with new upstream data).
`reanalyze` recomputes every cached item, e.g. after changing a metric; `all` excludes it.
`MARKET_RUN_ON_START=<spec>` runs a spec as soon as the worker starts. The development-only
[/dev page](../src/app/dev/page.tsx) shows the latest push, analysis runs and biggest movers.

Configuration is in [.sample.env](.sample.env); only `DATABASE_URL` is required. Inside the
container `localhost` is the container itself: for a database on the Docker host use
`host.docker.internal` (mapped in compose.yml). Logs are JSON lines by default;
`MARKET_LOG_FORMAT=pretty` prints one readable line per event, and errors add indented lines
with their underlying cause and hints.

- **One worker per volume**: `/data/worker.lock` makes a second worker on the same volume
  refuse to start (`state-directory-locked`); a restarted container reclaims its own lock.
- **Health**: unhealthy when the heartbeat is stale or every mode has failed for 15 minutes.
  A failing mode is retried every 5 minutes.

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
