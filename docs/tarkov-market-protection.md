# Tarkov Market - Historical Note

The app no longer uses Tarkov Market for the active price data path. Current flea price data comes from Tarkov.dev GraphQL through the server-side cron flow documented in `cron-jobs.md`.

The old Tarkov Market integration required a server-only `TARKOV_MARKET_KEY`, fetched bulk item data during cron, and wrote Redis keys under `tarkov-market:*`. That path has been removed from the main application.

There is still no public browser-facing price proxy. Client components read prices from `PriceDataContext`, which is populated by server components reading Redis.

The original public `/api/market/items` proxy route was removed before this migration and should not be reintroduced.
