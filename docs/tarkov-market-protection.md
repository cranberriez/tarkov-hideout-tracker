# Tarkov Market — API Key Protection

## Current Architecture (Server-Side Only)

The Tarkov Market API key is **never exposed to the client**. All price fetching happens server-side:

1. The daily Vercel cron job (`/api/cron/bulk-update`) fetches the full item price catalogue from Tarkov Market using the `TARKOV_MARKET_KEY` env var.
2. The result is filtered to hideout-required items and written to Redis.
3. Client components read prices from Redis via `getCachedMarketPrices()`, which is called in server components (`PriceDataLayout`) — never from the browser.

There is **no public API route** that proxies or exposes Tarkov Market data. The previous concern about `/api/market/items` being publicly callable no longer applies.

---

## Cron Endpoint Protection

The only public route that touches Tarkov Market is `GET /api/cron/bulk-update`. It is protected by a bearer token:

```
Authorization: Bearer <CRON_SECRET>
```

Requests without a valid token are rejected with HTTP 401. Vercel injects this header automatically when invoking cron jobs.

---

## Historical Context (Pre-Refactor)

The original design used a public `/api/market/items` route that accepted item `normalizedName` arrays and proxied requests to Tarkov Market with server-side Redis caching. The risks that design carried (key exposure through network tab, rate-limit abuse by external callers) were the motivation for moving to the current server-only bulk fetch approach.

The old route no longer exists. The analysis of mitigation options (anonymous JWTs, IP rate limiting, Origin checks) in the original version of this document is no longer actionable, but is preserved in git history for reference.

---

## If You Need Per-Item Price Lookup

`src/server/services/tarkovMarket.ts` contains a legacy per-item Tarkov Market integration with its own Redis cache. It is not used in the main data flow but can be used server-side (e.g., in a new API route or server action) if per-item on-demand pricing is ever needed. The API key is still read from `TARKOV_MARKET_KEY`.
