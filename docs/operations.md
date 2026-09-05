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

### Flea stability evidence and validation

On September 5, 2026, read-only inspection of the configured release
`20260904T211847Z` and mutable storage covered 10,750 current rows and 106,017
stored observations. No production refresh or release publication was performed.
The sampling unit is an observed listing snapshot, not a transaction.

| Data mode | Current rows | Latest depth median / p90 | Latest aggregate/minimum p95 / p99 | Stored points with depth 1–2 |
|---|---:|---:|---:|---:|
| regular | 3,541 | 3 / 21 | 1.63 / 2.52 | 46.9% |
| pve | 3,695 | 6 / 40 | 2.03 / 3.75 | 33.5% |
| pvp-season | 3,514 | 4 / 26 | 1.65 / 2.69 | 35.5% |

Reviewed sugar, bolts, Iskra and Salewa, base/default AK-74N, both M1A presets,
Red keycards, graphics cards, LEDX and T-7 goggles in every mode. Sugar's ten
minimums ranged 49–64k regular, 62–92.4k PVE and 38.9–52k KORD, with depths
23–375 across modes. Red keycards ranged roughly 780k–1.11m with depths 5–58.
T-7s legitimately remained 10–30m: PVE had depths 3–10, while KORD's six
observations repeated 18m at depth one. High absolute value is not an anomaly;
repetition of one listing is not proof of liquidity.

Stored aggregate/minimum ratios at least 2x occurred in 2.6%, 5.9% and 2.8% of
regular/PVE/KORD observations. Adjacent minimum ratios at p90 were 1.85x, 2.00x
and 1.69x. Thus 2x divergence/jump signals target substantial moves while the
median tolerates ordinary commodity variation. The 1.25x confirmation cluster,
three-observation/two-hour deep confirmation, five-observation/eight-hour thin
confirmation, and 72-hour stale cutoff are conservative policy choices aligned
with approximately two-hour provider observations and daily regular/PVE refresh.
They are not statistically calibrated transaction-confidence thresholds.

Sustained observed regimes were also reviewed: regular SMW car key settled from
about 20–23k to 10k for three observations at depth 7–8 over 3.83 hours; PVE
default Kedr moved from 14.5–20k through thin spikes to 49–49.6k at depth 3–4 over
3.83 hours. KORD's SPRM rail returned from 24–25k single offers to three 9,995
observations at depth 3–4 over 3.83 hours. These support accepting sustained
regimes while flagging transition windows; they cannot establish completed sales.
There were no zero/null-depth stored points; eight empty current rows had null
depth. Zero, null and malformed cases therefore use synthetic regression coverage.

At inspection time the conservative model classified 1,251 regular, 1,455 PVE and
1,499 KORD items as stable. This classification is advisory: thin/stale/volatile
items retain rough minimum estimates for costs and profits, with a compact warning
on selected unstable flea sales. Only unavailable inputs leave calculations unpriced. Ten points cannot preserve a historical anchor indefinitely, and stable
listings still do not prove throughput or guarantee fill quantity. Reassess using
future observed distributions rather than adding category-specific hard caps.

Additional focused coverage:

```bash
node --test --import jiti/register src/lib/utils/flea-price.test.ts src/lib/utils/price-history.test.ts src/server/services/priceHistory.test.ts src/server/db/price-data.test.ts src/features/items/item-detail/ItemDetailMarket.test.ts
```

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
