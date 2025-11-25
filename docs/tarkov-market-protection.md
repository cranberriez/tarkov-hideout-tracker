# Protecting Tarkov Market Usage in `tarkov-hideout-tracker`

## Problem Overview

The app relies on a third‑party API (Tarkov Market) for real‑time item prices. This API is:

-   Rate limited.
-   Protected by a private API key stored on the server.

Our app exposes a public route `/api/market/items` that:

-   Accepts a list of item `normalizedName`s.
-   For each item, calls `getTarkovMarketItemByNormalizedName`.
-   That function uses Redis to cache responses and only hits Tarkov Market when needed.

### Core risk

Because `/api/market/items` is a **public HTTP endpoint**, anyone can:

-   Discover it (DevTools, network tab, repo).
-   Call it directly (`curl`, scripts, Postman, etc.).
-   Indirectly consume our Tarkov Market API quota/key through our server.

Even with caching, a malicious or careless user can:

-   Rapidly spam `/api/market/items` with large or repeated payloads.
-   Force our server to:
    -   Blow through Redis cache windows.
    -   Hit Tarkov Market enough to trigger rate limits or key bans.

We want to:

-   Keep the feature “no‑auth” and frictionless for normal users.
-   Discourage or block **external / automated abuse**.
-   Protect the Tarkov Market key and our cache from being burned.

---

## Existing Mitigations

### 1. Server‑side caching

In `getTarkovMarketItemByNormalizedName`:

-   Redis cache with `CACHE_WINDOW_MS` (currently 45 minutes).
-   If cached entry is fresh:
    -   Return it; do not hit Tarkov Market.
-   On error / rate limit / HTML response:
    -   Log the error.
    -   Fall back to cached entry when available.

This reduces **upstream** load but does **not** stop someone from hammering **our** `/api/market/items` route.

### 2. Aggregated API route

`/api/market/items`:

-   Accepts an array of normalized item names.
-   Deduplicates them.
-   Fetches all in a **single batch** via `Promise.all`.
-   Aggregates responses into a single `TimedResponse`.

This is efficient, but still public and callable by anyone.

### 3. Client‑side caching

`usePriceStore`:

-   Keeps `prices`, `updatedAt`, and an in‑memory cache window (15 minutes).
-   `fetchPrices(names)`:
    -   Normalizes + deduplicates names.
    -   If cache is fresh and all names are already cached:
        -   Returns early; no API call.
    -   If cache is fresh but some names are missing:
        -   Requests **only the missing** names.
    -   Avoids stacking multiple concurrent requests when cache is fresh.

This prevents the UI from spamming the endpoint on normal usage and page navigations.

---

## What Cannot Be Fully Solved

Because `/api/market/items` is a public HTTP route:

-   **We cannot fully guarantee that only our frontend calls it.**
-   A determined user can:
    -   Capture any non‑secret tokens/headers/cookies via DevTools.
    -   Replay them from scripts or other clients.

Any browser‑visible credential (even if HttpOnly) is **not** a perfect barrier, only a speed bump.

This means:

-   We should focus on **rate limiting** and **abuse detection**, not on achieving perfect isolation from external callers.

---

## Solution Options

### 1. Anonymous JWT + Redis “User” (No-Auth Identification)

**Goal:** Identify and rate‑limit “users” without formal login.

**High‑level idea:**

-   On first request from a browser that lacks a specific cookie:

    -   Generate an anonymous ID (e.g., derived from IP + User-Agent + random salt, but **do not** store raw IP in the JWT).
    -   Create a JWT with payload like `{ sub: anonId, iat, exp? }`.
    -   Sign with a server secret.
    -   Set as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (e.g. `tk_anonymous`).
    -   Optionally store metadata in Redis: `user:<anonId>` → { createdAt, lastSeen, counters }.

-   On subsequent requests to `/api/market/items`:
    -   Verify the JWT from the cookie.
    -   Extract `anonId` from `sub`.
    -   Use `anonId` as the **key for rate limiting** and tracking.

**What this gives:**

-   A stable, per‑browser “user:ID” with no UI friction.
-   Ability to:
    -   Limit requests per anonId (e.g. N requests per 15 minutes).
    -   Detect obvious abuse patterns (single anonId making excessive calls).
-   Weak but useful gating: bots/scripts that never visit the site won’t have the cookie.

**What it doesn’t give:**

-   Hard security: an attacker can still:
    -   Use a real browser, grab the cookie, and replay it elsewhere.
    -   Script a headless browser to automatically obtain cookies.

**Use it for:**

-   Implementing **per-user or per-session rate limits** on `/api/market/items`.
-   Optionally tying other preferences/state to an anonymous ID.

---

### 2. IP and User-Agent–Based Rate Limiting

In combination with or instead of anonymous JWTs:

-   Use IP and/or User-Agent as keys for rate limiting.

**Pros:**

-   Does not require cookies or JWT.
-   Simple to implement with Redis:
    -   e.g. `rate:market:<ip>` counters with expiration.

**Cons:**

-   IPs are not stable:
    -   Shared NATs / CGNAT / VPNs mean many users share an IP.
    -   A single real user can change IP often (mobile).
-   User-Agent is easily spoofed.

**Use it for:**

-   Coarse, **backstop** limits to avoid absolute abuse.
-   Example:
    -   Cap total requests per IP per 15 minutes.
    -   If exceeded, temporarily block or degrade responses.

---

### 3. Origin / Referer Checks

Add extra checks in `/api/market/items`:

-   Inspect `Origin` or `Referer` headers.
-   Only accept requests where:
    -   `Origin` matches your production domain.
    -   or `Referer` starts with your site URL.

**Pros:**

-   Blocks simple cross-site abuse from other websites.
-   Stops some misconfigured scripts that don’t spoof headers.

**Cons:**

-   Headers can be forged easily by non-browser clients.
-   Browsers may omit these headers in some cases (e.g. some privacy settings).

**Use it for:**

-   Basic hygiene and to block the laziest forms of abuse.

---

### 4. Stricter Server-Side Validation and Limits

Inside `/api/market/items`:

-   Enforce **payload limits**:
    -   Maximum length of `items` array.
    -   Maximum size of normalized names.
-   Reject:
    -   Requests with invalid or malformed JSON.
    -   Requests with empty or obviously malicious arrays.
-   Add **global caps**:
    -   Total allowed requests per minute globally (to protect the upstream API and your infra).

**Pros:**

-   Predictable load.
-   Ensures single requests can’t be absurdly large.

**Cons:**

-   Doesn’t differentiate between individual users; just controls overall behavior.

---

### 5. Fully Authenticated Users (Not Currently Desired)

The “hardest” option would be:

-   Require login (OAuth, email, etc.).
-   Associate each user with:
    -   A verified identity.
    -   Tight per-user, per-day quotas for `/api/market/items`.

This would give:

-   Stronger protections and clearer abuse control.
-   But contradicts the current no-auth UX goal.

---

## Recommended Combined Approach

Given the project goals (no explicit login, but protect the Tarkov Market key):

1. **Keep the existing caching**:

    - Redis caching per item (`getTarkovMarketItemByNormalizedName`).
    - 15-min client cache in `usePriceStore`.
    - These minimize legitimate traffic.

2. **Add anonymous identification + rate limiting**:

    - Implement an anonymous JWT cookie as a soft “user ID”.
    - In `/api/market/items`, require a valid token.
    - Use `anonId` + IP for Redis-based rate limiting:
        - e.g. X requests per 15 minutes per anonId.
        - global/day caps for safety.

3. **Add safety checks on the route**:

    - Limit `items.length`.
    - Limit string length for names.
    - Short-circuit obviously bad payloads.

4. **Optionally add Origin/Referer checks**:
    - Reject requests not coming from your domain (best-effort).

This won’t make `/api/market/items` truly private, but it:

-   **Heavily discourages casual abuse**.
-   **Protects the Tarkov Market key and quota** via:
    -   aggressive caching,
    -   per-“user” and per-IP limits,
    -   global caps and validation.

And it preserves the **no-auth user experience**: regular users don’t see any extra prompts or workflows.
