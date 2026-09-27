# Quests and Kappa

## Data and progression

[questsJson.ts](../src/server/services/questsJson.ts) normalizes offline task data
into [quest domain types](../src/types/quests.ts). `FullQuest` retains complete
objective and presentation data; compact quest/availability shapes support demand
and progression without duplicating every display field. Standard objective and
reward items use IDs; task-owned quest-specific pickups are inline display data.
They do not enter standard inventory or item demand.

[getQuestWorkspacePageData](../src/server/queries/getQuestWorkspacePageData.ts)
loads/prepares quests and referenced standard items through the repository. The
[quests layout](<../src/app/(data)/quests/layout.tsx>) prefetches that mode-keyed
Query once for the segment and the client wrapper consumes and refetches the same
payload; parent layouts still load nothing. See [data layer](data-layer.md) for
route delivery and release regeneration.

[getQuestDetailPageData](../src/server/queries/getQuestDetailPageData.ts) is the
bounded one-quest read used by `/quests/[questId]` for metadata and not-found
resolution. It applies the same mode preparation and removed-quest policy. A failed
read does not 404; the workspace reports its own data errors.

| Change | Source owner |
|---|---|
| Prerequisite normalization/status gates | [quest-requirements](../src/server/services/quest-requirements.ts), [quest-availability](../src/lib/quests/quest-availability.ts) |
| Level, prestige, faction, loyalty, and other gates | [quest-availability](../src/lib/quests/quest-availability.ts), [quest-trader-gates](../src/lib/quests/quest-trader-gates.ts), [quest-trader-completion-gates](../src/lib/quests/quest-trader-completion-gates.ts) |
| Prepared mode-specific quest set | [quest-preparation](../src/lib/quests/quest-preparation.ts), [removed-quests](../src/lib/quests/removed-quests.ts) |
| Reviewed faction/series/tab corrections | [quest-faction-overrides](../src/lib/quests/quest-faction-overrides.ts), [quest-series](../src/lib/quests/quest-series.ts), [quest-trader-tab-overrides](../src/lib/quests/quest-trader-tab-overrides.ts), [reviewed data](../src/lib/data/) |
| LL1–LL4 and Series organization | [quest-organization](../src/lib/quests/quest-organization.ts); display categories do not replace prerequisite relationships |
| Prerequisite ordering and relationships | [quest-ordering](../src/lib/quests/quest-ordering.ts), [quest-relations](../src/lib/quests/quest-relations.ts) |
| Failure and completion cascades | [quest-failures](../src/lib/quests/quest-failures.ts), [quest-cascade](../src/features/quests/quest-cascade.ts) |
| Exact/any-of/broad-any/plant/FiR demand and reward indexes | [quest-item-index](../src/lib/quests/quest-item-index.ts) |

Availability is more than a level comparison: preserve required prerequisite
statuses, failure handling, faction, prestige, and trader/other gates. Ignoring
a quest is a separate visibility/demand preference. Reviewed series membership
is not inferred from every prerequisite edge. Candidate generation is a maintenance
tool, not runtime authority; see [operations](operations.md).

## Workspace and client ownership

The [quests layout](<../src/app/(data)/quests/layout.tsx>) renders
[QuestsClientPage](../src/features/quests/QuestsClientPage.tsx), which enters the current
[QuestWorkspace](../src/features/quests/workspace/QuestWorkspace.tsx), backed by
[QuestWorkspaceContext](../src/features/quests/workspace/QuestWorkspaceContext.tsx).
The routed page is the workspace's detail outlet: `/quests` shows a selection prompt
and `/quests/[questId]` renders [QuestDetailRoute](../src/features/quests/workspace/QuestDetailRoute.tsx),
which reuses the loaded workspace quest (independent of list filters) and shows an
in-pane not-found state when the quest is absent. The route parameter is the only
selection source: list rows are real links, so search, filters, group collapse, and
list scroll persist across quest navigation, and Back/Forward select the matching
quest. Workspace-initiated selection keeps an open planner or visualizer; Back/Forward,
search, and shared links switch to Details. Completing a quest does not navigate.
On mobile the list hides while a quest route is active and "Back to quests" links to
the index. [quest-routes](../src/features/quests/quest-routes.ts) builds hrefs;
legacy `?quest=` links redirect permanently ([next.config](../next.config.ts), with a
page-level fallback) and legacy `#quest-` fragments are translated client-side. The
development fixture opts in with `?q=dev-test`, which is fetched client-side only.

The outer [QuestActionsContext](../src/features/quests/QuestActionsContext.tsx) still owns
shared quest actions, cascade confirmation, and item-click routing;
it remains part of the current page. [quest-data-index](../src/features/quests/quest-data-index.ts)
provides the shared pure indexes consumed by both providers.
Start here for new quest UI; inspect current imports before editing older quest
components that remain in the feature directory.

| Behavior | Owner |
|---|---|
| Status, trader, map, objective and locked-quest filters | [quest-workspace-selector](../src/features/quests/workspace/quest-workspace-selector.ts), [QuestFilterBar](../src/features/quests/workspace/QuestFilterBar.tsx), [workspace context](../src/features/quests/workspace/QuestWorkspaceContext.tsx) |
| Grouping and list presentation | [quest-list-model](../src/features/quests/workspace/quest-list-model.ts), [QuestListPane](../src/features/quests/workspace/QuestListPane.tsx) |
| Detail selection/actions and objectives | [useQuestDetailsController](../src/features/quests/workspace/useQuestDetailsController.ts), [quest-details-model](../src/features/quests/workspace/quest-details-model.ts), [QuestDetailsPane](../src/features/quests/workspace/QuestDetailsPane.tsx) |
| Prerequisite visualizer | [quest-branch-graph](../src/features/quests/workspace/quest-branch-graph.ts), [quest-graph-layout](../src/features/quests/workspace/quest-graph-layout.ts), [QuestVisualizerPane](../src/features/quests/workspace/QuestVisualizerPane.tsx) |
| Raid Planner | [RaidPlannerPane](../src/features/quests/workspace/RaidPlannerPane.tsx), [raid-planner-summary](../src/features/quests/workspace/raid-planner-summary.ts), [raid-planner-markers](../src/features/quests/workspace/raid-planner-markers.ts); geometry belongs to [maps](maps.md) |

The planner uses profile-active quests independently of the workspace's other
status filters. Visited positioned objectives are profile state and are filtered
before marker grouping; whole-quest completion clears that quest's visited records.
The workspace loads planner and visualizer component code on demand, with a
loading indicator in the selected pane. Shared quest indexes remain available
for complete prerequisite and filter derivation.
Pan/zoom and temporary map expansion stay in session memory. Standard-item clicks
use the shared [item detail controllers](architecture.md); quest-only pickups are
informational. Persistent filter additions must follow [user-state](user-state.md).

## Log import

Log upload is the supported bulk-progress path; the per-trader manual sync dialog
and its engine have been removed.

[quest-log-parser](../src/lib/quests/quest-log-parser.ts) and
[quest-log-import](../src/lib/quests/quest-log-import.ts) parse and derive import
changes. The [import model](../src/features/quests/import/quest-log-import-model.ts)
and [controller](../src/features/quests/import/useQuestLogImportController.ts)
own review/workflow and seen-file tracking. Keep state mutation through existing
store actions; [user-state](user-state.md) documents import metadata and reset scope.

## Kappa checklist

[getKappaChecklistPageData](../src/server/queries/getKappaChecklistPageData.ts)
owns the mode-keyed Collector quest ID and reads only that quest, its give-item
IDs, and their current prices. It must not fetch/prepare every quest. Missing items
remain in the denominator; price failure must not discard available checklist
items. The route requests the unpriced variant and loads prices in the background
through the boundary described in [data layer](data-layer.md). Completion belongs to the independent
[Kappa store](../src/lib/stores/useKappaStore.ts), not generic inventory or quest
completion. Its reset scope is documented in [user-state](user-state.md).

## Validation

```bash
node --test --import jiti/register src/lib/quests/quest-availability.test.ts src/lib/quests/quest-item-index.test.ts src/server/queries/getKappaChecklistPageData.test.ts
node --test --import jiti/register src/features/quests/workspace/quest-workspace-selector.test.ts src/features/quests/workspace/quest-details-model.test.ts src/features/quests/import/quest-log-import-model.test.ts src/features/quests/quest-routes.test.ts
```

Run the adjacent tests for any correction, graph, marker, or import utility you
change. Browser checks should cover the affected filter/navigation/action and
mode isolation. See [operations](operations.md) for broader validation.

Catalog search includes the prepared mode-specific quest set with removed quests
excluded, independently of player progression and workspace filters. Seasonal
Lightkeeper/series exclusions use the existing preparation policy. Compact
summaries contain identity, display name, normalized name, and trader ID only;
see [compact search delivery](data-layer.md#compact-search-manifest).

The global command palette navigates to `/quests/[questId]`; see the workspace
section for mode and mobile behavior.

## Current-price requests

The quest workspace uses unpriced item summaries and makes no current-price
requests. Explicitly opening an item modal can load the selected item and recipe
prices through the [shared price cache](data-layer.md). No player progression or
quest filtering behavior depends on those prices.
