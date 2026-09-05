# Operations

## Local setup

Install the Node/npm versions supported by the checked-in
[Next.js package](../package.json), then run `npm ci`. Copy
[.sample.env](../.sample.env) to `.env` and provide credentials for the Turso
database containing the releases selected in
[release-config.ts](../src/server/db/release-config.ts). Do not overwrite an
existing local environment file or commit credentials.

| Variable | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | Runtime and offline-tool database URL |
| `TURSO_AUTH_TOKEN` | Remote Turso authentication; local CLI `file:` databases can omit it |
| `CRON_SECRET` | Bearer secret for price-refresh routes; use at least 16 characters as directed by the sample environment |
| `TARKOV_JSON_REQUEST_TIMEOUT_MS` | Optional positive per-attempt offline source timeout override; default 120,000ms in the [JSON client](../src/server/services/tarkovJson/client.ts) |

The [offline environment loader](../db-scripts/lib/config.mjs) reads process
environment, then `.env.local` and `.env` without replacing existing values.

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). After building, `npm start` serves
the production build. Database-backed routes require usable configured releases.

## Validation

Run from the repository root. [package.json](../package.json) is the command owner.

```bash
npm run docs:check
npm run test:architecture
npm run test:contracts
npm run lint
npm run build
```

`docs:check` uses the `markdown-link-check` development dependency
through [check-doc-links.mjs](../scripts/check-doc-links.mjs) to check relative
Markdown links in root guidance, the active docs, and the ingestion README.
It ignores external URLs, does not check backticked filenames, and is not a claim
that remote services are available. Use real Markdown links for source owners.

`test:architecture` runs [import-boundary checks](../src/architecture/data-import-boundaries.test.ts).
The existing [ESLint configuration](../eslint.config.mjs) also enforces selected
import restrictions. `test:contracts` runs repository-injected query tests for
bounded reads, partial failures, and Kappa's single-quest call behavior. Neither
requires a live Turso database. Do not describe these as exhaustive static analysis.

Focused TypeScript tests use Node's test runner with `jiti/register`:

```bash
node --test --import jiti/register src/features/quests/quest-sync.test.ts
node --test --import jiti/register src/server/prices/refresh-prices.test.ts src/server/prices/price-store.test.ts src/server/prices/live-price-history.test.ts
node --test scripts/generate-quest-series-candidates.test.mjs scripts/pull-map-overlays.test.mjs
```

Find adjacent tests with `rg --files src scripts | rg '\.test\.(ts|mjs)$'`.
[Quests](quests.md), [maps](maps.md), [profits](profits.md), and
[user state](user-state.md) identify relevant focused suites. Run tests for changed
behavior plus lint/build for application changes. Docs-only edits need the link
check; no new UI test is needed for prose. Verify visible behavior with the dev
server when changing interactions, including affected empty/error states and mode
switches. Keep failures and environmental blockers explicit in the handoff.

## Immutable release publication

The [ingestion CLI guide](../db-scripts/README.md) owns full command usage and
generated-file layout. The safe sequence is generate, locally validate, upload,
inspect readiness/counts, then select the release for runtime.

```bash
npm run db:generate -- --modes regular,pve,pvp-season --release <new-release-id>
npm run db:validate -- db-scripts/.generated/<new-release-id>
npm run db:upload -- --release-dir db-scripts/.generated/<new-release-id>
npm run db:status
```

Use a new release ID for changed content. Upload refuses conflicting content under
an existing ID and marks a mode ready only after count validation. Generated
snapshots are ignored by Git. Do not publish malformed/empty required domains.

`db:activate` updates `active_data_releases` as an operational pointer; the app
does **not** read that pointer. Serving the new release requires an explicit update
to [ACTIVE_DATA_RELEASE_IDS](../src/server/db/release-config.ts) and deployment.
Review each mode independently and keep older good releases available for rollback.
Cache freshness and current-price hydration are specified in [data layer](data-layer.md).
Release generation, upload, activation, and deployment are maintenance operations,
not validation steps for unrelated UI or documentation changes.

## Mutable price refresh

```bash
npm run db:prices:init
npm run db:prices:refresh -- --modes pvp-season
npm run db:prices:refresh -- --modes regular,pve
```

Initialization creates additive price tables. Manual refresh accepts
`--concurrency` from 1 to 32, default 12. [vercel.json](../vercel.json) schedules
seasonal refresh every two hours and regular/PVE refresh daily at 00:15 UTC.
[cron.ts](../src/server/prices/cron.ts) protects the routes with `CRON_SECRET`;
[refresh-prices.ts](../src/server/prices/refresh-prices.ts) owns locking, conditional
requests, and per-item failure handling. Refresh runs complete within one function
invocation, so inspect duration/run records when diagnosing schedule failures.
Current-price retention and on-demand modal history are separate paths in
[data layer](data-layer.md).

## Diagnostics and content maintenance

| Symptom or task | Start here |
|---|---|
| Missing or wrong-mode game data | [release-config](../src/server/db/release-config.ts), `db:status`, [release-info](../src/server/db/release-info.ts), [database error mapping](../src/server/db/route-errors.ts) |
| Inspect configured releases | [/dev source](../src/app/dev/page.tsx): development-only, read-only release timestamps/readiness/freshness/counts; no provider refresh |
| Stale current prices | [price refresh runs/store](../src/server/prices/price-store.ts), active release flea eligibility, cron authorization and run duration |
| History fails but current price works | [live-price-history](../src/server/prices/live-price-history.ts): independent upstream request/cache |
| Search misses/ranking | [item-search](../src/server/db/item-search.ts), [search validation](../src/server/queries/searchItems.ts), [controller](../src/features/items/useItemSearchController.ts) |
| Quest source corrections | [quests](quests.md); `npm run quest-series-candidates -- <task-snapshot.json>` emits review candidates, never automatic manifest updates |
| Compare quest snapshots | [compare-quest-data.mjs](../scripts/compare-quest-data.mjs); inspect its arguments before running `npm run quest-data-compare` |
| Refresh navigation overlays | `npm run pull-map-overlays`, review committed [overlay chunks](../src/lib/data/map-overlays/) and run the script's tests |
| Hideout quantity/FiR correction | [override owners in data layer](data-layer.md), then regenerate the affected release |

Use the active documentation and source implementations above for operational
requirements.
