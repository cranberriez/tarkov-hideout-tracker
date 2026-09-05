# Quests and Kappa

## Data and progression

[questsJson.ts](../src/server/services/questsJson.ts) normalizes offline task data
into [quest domain types](../src/types/quests.ts). `FullQuest` retains complete
objective and presentation data; compact quest/availability shapes support demand
and progression without duplicating every display field. Standard objective and
reward items use IDs; task-owned quest-specific pickups are inline display data.
They do not enter standard inventory or item demand.

[getQuestWorkspacePageData](../src/server/queries/getQuestWorkspacePageData.ts)
loads/prepares quests and referenced standard items through the repository. See
[data layer](data-layer.md) for route delivery and release regeneration.

| Change | Source owner |
|---|---|
| Prerequisite normalization/status gates | [quest-requirements](../src/server/services/quest-requirements.ts), [quest-availability](../src/lib/utils/quest-availability.ts) |
| Level, prestige, faction, loyalty, and other gates | [quest-availability](../src/lib/utils/quest-availability.ts), [quest-trader-gates](../src/lib/utils/quest-trader-gates.ts), [quest-trader-completion-gates](../src/lib/utils/quest-trader-completion-gates.ts) |
| Prepared mode-specific quest set | [quest-preparation](../src/lib/utils/quest-preparation.ts), [removed-quests](../src/lib/utils/removed-quests.ts) |
| Reviewed faction/series/tab corrections | [quest-faction-overrides](../src/lib/utils/quest-faction-overrides.ts), [quest-series](../src/lib/utils/quest-series.ts), [quest-trader-tab-overrides](../src/lib/utils/quest-trader-tab-overrides.ts), [reviewed data](../src/lib/data/) |
| LL1–LL4 and Series organization | [quest-organization](../src/lib/utils/quest-organization.ts); display categories do not replace prerequisite relationships |
| Prerequisite ordering and relationships | [quest-ordering](../src/lib/utils/quest-ordering.ts), [quest-relations](../src/lib/utils/quest-relations.ts) |
| Failure and completion cascades | [quest-failures](../src/lib/utils/quest-failures.ts), [quest-cascade](../src/features/quests/quest-cascade.ts) |
| Exact/any-of/broad-any/plant/FiR demand and reward indexes | [quest-item-index](../src/lib/utils/quest-item-index.ts) |

Availability is more than a level comparison: preserve required prerequisite
statuses, failure handling, faction, prestige, and trader/other gates. Ignoring
a quest is a separate visibility/demand preference. Reviewed series membership
is not inferred from every prerequisite edge. Candidate generation is a maintenance
tool, not runtime authority; see [operations](operations.md).

## Workspace and client ownership

[QuestsClientPage](../src/features/quests/QuestsClientPage.tsx) enters the current
[QuestWorkspace](../src/features/quests/workspace/QuestWorkspace.tsx), backed by
[QuestWorkspaceContext](../src/features/quests/workspace/QuestWorkspaceContext.tsx).
The outer [QuestsContext](../src/features/quests/QuestsContext.tsx) still owns
shared quest actions, cascade confirmation, manual sync, and item-click routing;
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
Pan/zoom and temporary map expansion stay in session memory. Standard-item clicks
use the shared [item detail controllers](architecture.md); quest-only pickups are
informational. Persistent filter additions must follow [user-state](user-state.md).

## Manual sync and log import

[quest-sync.ts](../src/features/quests/quest-sync.ts) is the pure manual sync
engine used by [QuestSyncDialog](../src/features/quests/components/QuestSyncDialog.tsx).
Inference scans selected-trader candidates; cross-trader prerequisite chains can
be backfilled only when they are the sole blocker. Preserve explicit visible-quest
selection, failure state, and the existing availability wrapper.

[quest-log-parser](../src/lib/utils/quest-log-parser.ts) and
[quest-log-import](../src/lib/utils/quest-log-import.ts) parse and derive import
changes. The [import model](../src/features/quests/components/quest-log-import-model.ts)
and [controller](../src/features/quests/components/useQuestLogImportController.ts)
own review/workflow and seen-file tracking. Keep state mutation through existing
store actions; [user-state](user-state.md) documents import metadata and reset scope.

## Kappa checklist

[getKappaChecklistPageData](../src/server/queries/getKappaChecklistPageData.ts)
owns the mode-keyed Collector quest ID and reads only that quest, its give-item
IDs, and their current prices. It must not fetch/prepare every quest. Missing items
remain in the denominator; price failure must not discard available checklist
items. Completion belongs to the independent
[Kappa store](../src/lib/stores/useKappaStore.ts), not generic inventory or quest
completion. Its reset scope is documented in [user-state](user-state.md).

## Validation

```bash
node --test --import jiti/register src/lib/utils/quest-availability.test.ts src/lib/utils/quest-item-index.test.ts src/features/quests/quest-sync.test.ts src/server/queries/getKappaChecklistPageData.test.ts
node --test --import jiti/register src/features/quests/workspace/quest-workspace-selector.test.ts src/features/quests/workspace/quest-details-model.test.ts src/features/quests/components/quest-log-import-model.test.ts
```

Run the adjacent tests for any correction, graph, marker, or import utility you
change. Browser checks should cover the affected filter/navigation/action and
mode isolation. See [operations](operations.md) for broader validation.
