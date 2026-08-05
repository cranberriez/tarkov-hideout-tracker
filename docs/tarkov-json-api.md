# Tarkov JSON API Provider

The application can load Tarkov data from either the original GraphQL services or parallel JSON API adapters. The provider is selected server-side with `TARKOV_DATA_SOURCE`:

- `json` (default) uses `https://json.tarkov.dev`.
- `graphql` uses `https://api.tarkov.dev/graphql`.

The selection facade is `src/server/services/tarkovData.ts`. Pages and cron routes import data-fetching entry points from this facade. The original GraphQL service files remain intact so switching back does not require a code change.

All requests to the Tarkov.dev JSON and GraphQL APIs send the shared user agent `TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)`. Keep this identity on new upstream request paths so Tarkov.dev can attribute traffic to tarkovhideout.com.

## JSON API Shape

The JSON API publishes a base dataset and an English locale dictionary for each translatable endpoint:

```text
/regular/hideout     /regular/hideout_en
/regular/items       /regular/items_en
/regular/tasks       /regular/tasks_en
/regular/traders     /regular/traders_en
/regular/maps        /regular/maps_en
```

PVE market refreshes use the equivalent `/pve/items` and `/pve/traders` datasets. Base records refer to related entities by ID and contain translation keys. The adapters hydrate those references and translate them into the existing application types.

## Compatibility and Caching

JSON and GraphQL providers expose the same `TimedResponse` payloads and use the existing versioned Redis keys. No client component, Zustand field, persisted storage key, or persistence behavior changes when the provider changes.

Every JSON adapter validates both cached and upstream data:

- Empty or malformed Redis bodies are ignored rather than treated as fresh.
- Missing or empty upstream datasets throw before `redis.mset`.
- A valid stale Redis body is returned when an upstream refresh fails.
- An invalid upstream response never overwrites a valid Redis body.

The JSON client fetches base and `_en` locale payloads together. Concurrent requests for the same URL share one in-flight promise to avoid duplicate downloads of the large item dataset during a cold render.

## Switching Providers

Set the server-only environment variable and redeploy:

```text
TARKOV_DATA_SOURCE=json
```

Use `graphql` to switch back when the GraphQL endpoint is healthy. After changing providers, invoke the authenticated `/api/revalidate` route for the `hideout-data` and `quests` tags if an immediate refresh is required.
