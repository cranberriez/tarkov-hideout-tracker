# Tarkov Market - Historical Note

The app no longer uses Tarkov Market for the active price data path. Current flea and trader values come directly from each mode-specific Tarkov.dev JSON `/items` record.

The old Tarkov Market integration required a server-only `TARKOV_MARKET_KEY`, fetched bulk item data during cron, and wrote Redis keys under `tarkov-market:*`. That path has been removed from the main application.

There is still no public browser-facing price proxy. Client components read the `marketPrice` attached to each tracked `ItemDetails` record in `DataContext`.

The original public `/api/market/items` proxy route was removed before this migration and should not be reintroduced.
