# Operations

## Local setup

Install the Node/npm versions supported by the checked-in
[Next.js package](../package.json), then run `npm ci`. Copy
[.sample.env](../.sample.env) to `.env` and provide credentials for the Turso
database containing ready releases and per-mode active pointers.
[release-config.ts](../src/server/db/release-config.ts) reads those pointers. Do not overwrite an
existing local environment file or commit credentials.

| Variable                         | Purpose                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURSO_DATABASE_URL`             | Runtime and offline-tool database URL                                                                                                              |
| `TURSO_AUTH_TOKEN`               | Remote Turso authentication; local CLI `file:` databases can omit it                                                                               |
| `CRON_SECRET`                    | Bearer secret for price-refresh routes; use at least 16 characters as directed by the sample environment                                           |
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
npm run test:theme
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
`test:theme` checks [color conventions](../src/architecture/theme-colors.test.ts):
application source uses the documented global palette, with explicit loading-art
and profile-identity exceptions.
The existing [ESLint configuration](../eslint.config.mjs) also enforces selected
import restrictions. `test:contracts` runs repository-injected query tests for
bounded reads, partial failures, and Kappa's single-quest call behavior. Neither
requires a live Turso database. Do not describe these as exhaustive static analysis.

Focused TypeScript tests use Node's test runner with `jiti/register`:

```bash
node --test --import jiti/register src/features/quests/quest-sync.test.ts
node --test --import jiti/register src/server/prices/refresh-prices.test.ts src/server/prices/price-store.test.ts src/server/prices/live-price-history.test.ts
node --test --import jiti/register src/server/db/read-cache.test.ts src/server/db/price-data.test.ts src/features/items/deferred-prices.test.ts
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

`db:activate` updates `active_data_releases`, which is now the runtime source of
truth. No source edit or redeployment is needed to select a release. The resolver
shares its result within a React server render, with no cross-request TTL; the
next render sees activation or rollback. Existing browser/CDN item-view responses
can remain cached for their documented lifetime. Immutable entity caches remain
keyed by the selected release. Deferred price requests return 409 when their page
belongs to a different active release and pin all reads to their accepted scope.

Before deploying this version, initialize additive catalog history and any missing
active pointers from the frozen pre-1.1.5 baseline:

```bash
npm run db:catalog:init
```

This requires ready baseline `20260904T211847Z` for each mode. Existing history
and active pointers are preserved. If a baseline is unavailable, initialization
fails rather than treating every item as new. Player progress is unaffected.

For routine maintenance, one command generates all supported datasets, validates,
reports additions/changes/removals, uploads, records new items, and activates
unpinned included modes after they are ready:

```bash
npm run db:update
npm run db:update -- --modes regular,pve,pvp-season --patch 1.1.5.0
```

The default tracked patch is `1.1.5.0`; pass the next patch explicitly when it
changes. The command includes initialization, preserves existing release price
payloads/timestamps, assigns null price fallbacks to new items, and never refreshes
mutable prices or price history. New trader offers and recipe data still update.
Its ignored snapshot directory contains `changes.json` with IDs/names for added,
changed, and removed entities, plus never-seen items. A changed active pointer
during the update blocks automatic activation; regenerate against the new pointer
or explicitly activate the ready release after reviewing it.

Check only for new catalog items without writing anything:

```bash
npm run db:items:check
npm run db:items:check -- --modes pvp-season
```

The check reads the full upstream item catalog and durable known IDs, rather than
player demand or only the immediately preceding release. It does not consume new
items or assign dates. See [catalog history](data-layer.md) for field semantics.

Activate and pin an already uploaded ready release, including rollback, without local
snapshot files:

```bash
npm run db:activate -- --release <release-id> --modes regular,pve,pvp-season
```

Keep older good releases available for rollback. Cache freshness and price
hydration remain specified in [data layer](data-layer.md). Publication commands
are maintenance operations, not validation steps for unrelated changes.

### Release dashboard and development override

Open `/dev` under `npm run dev`. The [dashboard](../src/app/dev/page.tsx)
lists 20 releases per page for PVP, PVE, or KORD, including upload status,
timestamps, counts, the current shared release, and the effective local selection.
It remains unavailable in production builds; its server actions also enforce this.

**Pin shared release** activates a ready release and persistently pins that mode
in the configured database. This changes production when production uses the same
database. Manual `db:activate` also pins. `db:update` and `db:upload --activate`
still publish new releases but skip pinned modes during their activation
transaction, including pins made while an upload is running. Their output lists
activated and skipped modes. **Resume automatic updates** removes only that mode's
pin; the current release stays selected until a subsequent update activates one.
Pin storage is additive and initialized by the schema tooling or the first shared
panel mutation; existing pointers and catalog history are preserved.

**Use in local dev** selects a ready release for this browser and mode without
writing a shared pointer. **Follow shared release** clears the override. The
HTTP-only, same-site cookie lasts 30 days and is honored only in development;
production builds and offline tooling ignore it. It applies to page, search,
detail, conversion, status, and deferred-price release selection. Missing/unready
overrides fail explicitly and can be cleared from the panel. Item-view HTTP
responses use no-store in development, and successful panel changes reload the
page to discard client caches. Mutable prices still use current mode-scoped price
storage; selecting an older release does not rewind price history or player data.

For example, pin an older shared release to roll production back, then select the
newer release with **Use in local dev** to reproduce and verify a fix. Pin the
verified ready release when appropriate, or resume automatic updates before the
next publication.

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

| Data mode  | Current rows | Latest depth median / p90 | Latest aggregate/minimum p95 / p99 | Stored points with depth 1–2 |
| ---------- | -----------: | ------------------------: | ---------------------------------: | ---------------------------: |
| regular    |        3,541 |                    3 / 21 |                        1.63 / 2.52 |                        46.9% |
| pve        |        3,695 |                    6 / 40 |                        2.03 / 3.75 |                        33.5% |
| pvp-season |        3,514 |                    4 / 26 |                        1.65 / 2.69 |                        35.5% |

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

| Symptom or task                       | Start here                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing or wrong-mode game data       | [release-config](../src/server/db/release-config.ts), `db:status`, [release-info](../src/server/db/release-info.ts), [database error mapping](../src/server/db/route-errors.ts) |
| Manage releases                       | [/dev source](../src/app/dev/page.tsx): development-only release history, shared pin/rollback, resume updates, and browser-local development override |
| Stale current prices                  | [price refresh runs/store](../src/server/prices/price-store.ts), active release flea eligibility, cron authorization and run duration                                           |
| History fails but current price works | [live-price-history](../src/server/prices/live-price-history.ts): independent upstream request/cache                                                                            |
| Search misses/ranking                 | [item-search](../src/server/db/item-search.ts), [search validation](../src/server/queries/searchItems.ts), [controller](../src/features/items/useItemSearchController.ts)       |
| Quest source corrections              | [quests](quests.md); `npm run quest-series-candidates -- <task-snapshot.json>` emits review candidates, never automatic manifest updates                                        |
| Compare quest snapshots               | [compare-quest-data.mjs](../scripts/compare-quest-data.mjs); inspect its arguments before running `npm run quest-data-compare`                                                  |
| Refresh navigation overlays           | `npm run pull-map-overlays`, review committed [overlay chunks](../src/lib/data/map-overlays/) and run the script's tests                                                        |
| Hideout quantity/FiR correction       | [override owners in data layer](data-layer.md), then regenerate the affected release                                                                                            |

Use the active documentation and source implementations above for operational
requirements.
