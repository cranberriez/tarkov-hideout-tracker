# Quests and Kappa

## Data and progression

[questsJson.ts](../src/server/services/questsJson.ts) normalizes offline task data
into [quest domain types](../src/types/quests.ts). `FullQuest` retains complete
objective and presentation data; compact quest/availability shapes support demand
and progression without duplicating every display field. Standard objective and
reward items use IDs; task-owned quest-specific pickups are inline display data.
They do not enter standard inventory or item demand.

[getQuestWorkspaceIndex](../src/server/queries/getQuestWorkspaceIndex.ts) loads a
metadata-only database projection and prepares mode-specific quest summaries.
It includes identity, progression gates, prerequisite/failure relationships, and
derived map/category/key flags plus objective search text. It excludes full
objectives, item lists, rewards, and geometry, and performs no item or price reads.
The summary type cannot be passed as a full detail record. The
[quests layout](<../src/app/(data)/quests/layout.tsx>) prefetches that mode-keyed
Query once for the segment and the client wrapper consumes and refetches the same
payload; parent layouts still load nothing. See [data layer](data-layer.md) for
route delivery and release regeneration.

[getQuestDetailsData](../src/server/queries/getQuestDetailsData.ts) reads only
requested quest IDs (plus custom-correction anchors/prerequisites), prepares them,
and reads only their rendered objective/reward/key item presentations without
prices or trader offers. `/quests/[questId]` shares this read between metadata,
not-found resolution and hydration of that quest's detail cache. A failed read
does not 404. Missing quests/items and independent read errors remain explicit.

[Detail queries](../src/lib/query/quest-details.ts) cache each quest by mode and ID,
coalescing simultaneous misses into requests of at most 50 IDs. Details, sustained
hover previews and the planner reuse those entries. List/board links disable route
prefetch so displaying a list does not eagerly fetch every quest's details. The
earlier dictionary packing layer is no longer needed.

| Change                                                     | Source owner                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prerequisite normalization/status gates                    | [quest-requirements](../src/server/services/quest-requirements.ts), [quest-availability](../src/lib/quests/quest-availability.ts)                                                                                                            |
| Level, prestige, faction, loyalty, and other gates         | [quest-availability](../src/lib/quests/quest-availability.ts), [quest-trader-gates](../src/lib/quests/quest-trader-gates.ts), [quest-trader-completion-gates](../src/lib/quests/quest-trader-completion-gates.ts)                            |
| Prepared mode-specific quest set                           | [quest-preparation](../src/lib/quests/quest-preparation.ts), [removed-quests](../src/lib/quests/removed-quests.ts)                                                                                                                           |
| Reviewed faction/series/tab corrections                    | [quest-faction-overrides](../src/lib/quests/quest-faction-overrides.ts), [quest-series](../src/lib/quests/quest-series.ts), [quest-trader-tab-overrides](../src/lib/quests/quest-trader-tab-overrides.ts), [reviewed data](../src/lib/data/) |
| Custom quests for stale provider data                      | [custom-quests](../src/lib/quests/custom-quests.ts) applies [custom-quests.json](../src/lib/data/custom-quests.json) first in quest preparation: entries with a provider ID patch it, new entries yield to a same-name provider quest, and entries with unresolved prerequisites are skipped. Each carries a wiki `source` and sets `customSource`. |
| LL1–LL4 and Series organization                            | [quest-organization](../src/lib/quests/quest-organization.ts); display categories do not replace prerequisite relationships                                                                                                                  |
| Prerequisite ordering and relationships                    | [quest-ordering](../src/lib/quests/quest-ordering.ts), [quest-relations](../src/lib/quests/quest-relations.ts)                                                                                                                               |
| Failure and completion cascades                            | [quest-failures](../src/lib/quests/quest-failures.ts), [quest-cascade](../src/features/quests/quest-cascade.ts)                                                                                                                              |
| Exact/any-of/broad-any/plant/FiR demand and reward indexes | [quest-item-index](../src/lib/quests/quest-item-index.ts)                                                                                                                                                                                    |

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
which uses the selected quest's scoped detail query (independent of list filters),
with loading/retry and in-pane not-found states. The route parameter is the only
selection source: list rows are real links, so search, filters, group collapse, and
list scroll persist across quest navigation, and Back/Forward select the matching
quest. Workspace-initiated selection keeps an open planner or visualizer; Back/Forward,
search, and shared links switch to Details. Completing a quest does not navigate.
Workspace mode (Details, Trader board, Visualizer, Raid planner) is session state. The
Quests nav entries link to `/quests?view=board|visualizer|planner`; the provider applies
the parameter to the mode once and strips it with `history.replaceState`, deferred a task
so Next's history patch is installed on a full page load.
On mobile the list hides while a quest route is active and "Back to quests" links to
the index. Below `lg`, [QuestMobileMenu](../src/features/quests/workspace/QuestMobileMenu.tsx)
replaces the action bar and filter header: a floating pill opens views (including History)
and filters. Log upload stays desktop-only, and global search replaces quest search. Scrolling panes end
with `QuestMobileMenuSpacer` so the pill never covers the last row. [quest-routes](../src/features/quests/quest-routes.ts) builds hrefs;
legacy `?quest=` links redirect permanently ([next.config](../next.config.ts), with a
page-level fallback) and legacy `#quest-` fragments are translated client-side. The
development fixture opts in with `?q=dev-test`, which is fetched client-side only.

The outer [QuestActionsContext](../src/features/quests/QuestActionsContext.tsx) still owns
shared quest actions and cascade confirmation; standard items in objectives and
rewards are `ItemLink`s that open the item dialog, and quest references are `QuestLink`s.
It remains part of the current page. [quest-data-index](../src/features/quests/quest-data-index.ts)
provides the shared pure indexes consumed by both providers.
Start here for new quest UI; inspect current imports before editing older quest
components that remain in the feature directory.

| Behavior                                                | Owner                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status, trader, map, objective and locked-quest filters | [quest-workspace-selector](../src/features/quests/workspace/quest-workspace-selector.ts), [QuestFilterBar](../src/features/quests/workspace/QuestFilterBar.tsx), [workspace context](../src/features/quests/workspace/QuestWorkspaceContext.tsx)                                 |
| Grouping and list presentation                          | [quest-list-model](../src/features/quests/workspace/quest-list-model.ts), [QuestListPane](../src/features/quests/workspace/QuestListPane.tsx)                                                                                                                                    |
| Detail selection/actions and objectives                 | [useQuestDetailsController](../src/features/quests/workspace/useQuestDetailsController.ts), [quest-details-model](../src/features/quests/workspace/quest-details-model.ts), [QuestDetailsPane](../src/features/quests/workspace/QuestDetailsPane.tsx)                            |
| Trader board                                            | [quest-trader-board-model](../src/features/quests/workspace/quest-trader-board-model.ts), [QuestTraderBoardPane](../src/features/quests/workspace/QuestTraderBoardPane.tsx)                                                                                                      |
| Prerequisite visualizer                                 | [quest-branch-graph](../src/features/quests/workspace/quest-branch-graph.ts), [quest-graph-layout](../src/features/quests/workspace/quest-graph-layout.ts), [QuestVisualizerPane](../src/features/quests/workspace/QuestVisualizerPane.tsx)                                      |
| Raid Planner                                            | [RaidPlannerPane](../src/features/quests/workspace/RaidPlannerPane.tsx), [raid-planner-summary](../src/features/quests/workspace/raid-planner-summary.ts), [raid-planner-markers](../src/features/quests/workspace/raid-planner-markers.ts); geometry belongs to [maps](maps.md) |

The planner uses profile-active quests independently of the workspace's other
status filters. Its map-selection cards use summary counts/categories. Selecting
a map requests full details only for active quests associated with that map;
required key presentations and geometry load then. The selected map's Keys button
lists deduplicated keys for its active quests, including quests without positioned
markers, and opens item details. Map cards retain key requirement counts; marker
previews retain objective-specific keys. Unresolved keys remain visible by ID.
The Keys button hides when a complete read has no required keys. The floating
mobile quest menu hides while a planner map is open; Back and Exit remain available.
Loading, missing data, and
partial failures are shown explicitly rather than appearing as an empty plan.
Visited positioned objectives are profile state and are filtered
before marker grouping; whole-quest completion clears that quest's visited records.
The trader board is a full-width overview (the list pane hides): trader columns with
loyalty-level and Essential sections, completed and failed quests folded behind an
expandable count. Essential quests are grouped into the same series as the list, in chain
order. Below `sm` each trader fills the width and snaps on swipe, with an avatar strip to jump. It ignores workspace filters but omits removed, hidden, other-faction,
and excluded-branch quests; selecting a quest switches to Details. The Pinned toggle
between History and Search limits both the list and trader board to the active
profile's pinned quests, using the existing shared `questShowPinnedOnly` preference.
The list still applies its other filters; the board still folds resolved quests.
Mobile exposes the same toggle as Pinned only in the quest menu.
The workspace loads board, planner, and visualizer component code on demand, with a
loading indicator in the selected pane. Shared quest indexes remain available
for complete prerequisite and filter derivation.
Pan/zoom and temporary map expansion stay in session memory. Standard items link
open the [item-detail dialog](architecture.md#shared-ui-vocabulary-and-entity-links); quest-only pickups are
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

The dialog is three steps for the active profile only: choose the logs folder,
review the quests that would change against stored progress, then a result (or a
gray "nothing imported" state when nothing changed). Closing resets it. Lightkeeper
quests are not synced by import.

## Kappa checklist

[getKappaChecklistPageData](../src/server/queries/getKappaChecklistPageData.ts)
reads only the mode-keyed [Collector quest](../src/lib/quests/collector.ts), its give-item
IDs, and their current prices. It must not fetch/prepare every quest. Missing items
remain in the denominator; price failure must not discard available checklist
items. The route requests the unpriced variant and loads prices in the background
through the boundary described in [data layer](data-layer.md). Completion belongs to the independent
[Kappa store](../src/lib/stores/useKappaStore.ts), not generic inventory or quest
completion. Its reset scope is documented in [user-state](user-state.md).

The uploader takes Collector demand from this checklist instead of quest progress
(Collector is ignored quest demand by default). Unchecked items reserve kept FIR
copies before any other demand; adding kept items checks those items off rather
than adding them to inventory. Its "Ignore Kappa items" switch drops that demand.

## Story chapters

The provider has no story-chapter records, so chapters are hand-authored in
[src/lib/data/story](../src/lib/data/story/) and reviewed against the wiki (Tour,
Falling Skies, Accidental Witness, Batya, Blue Fire, Boreas, The Unheard, They Are Already Here and The Ticket so far). Decisions are global because a choice in one chapter changes
later routes, for example the Falling Skies armored case. Step and decision IDs
are persisted: never rename or reuse them. Items carry catalog IDs where the item
exists; story-only items are name-only references. Items and decisions may name
another chapter; [the chapter index](../src/lib/data/story/index.ts) lists every
chapter so those always link to `/story/[chapterId]`; untracked chapters render a
placeholder that links to the wiki and is not indexed.
Steps may also carry rewards, warnings for route-failing actions, quest links and
wiki screenshots, stored under `public/images/story/<chapter-id>/steps/`.
Every tracked chapter offers a local Simplified toggle in its progress panel. Condensed
step copy contains actions, locations, timers and dialogue choices. Display-only
`simplifiedItems` and `simplifiedRequirements` keep combined item quantities and
requirements in the supporting row alongside images and rewards; they do not
change demand or progress. Both views use the original step text sizing.
A step’s `simplified` string replaces its copy; `false` hides it and its substeps
in Simplified only. Guides omit redundant checklist entries while preserving
route choices, warnings, evidence locations, keys, radio codes and time limits.
Falling Skies also combines supply turn-ins into a later checkpoint. Long item
lists retain their collapse control and source-chapter links in either view.
Hidden required actions remain in the full progression order and totals; they
are not completed by switching views. Images buttons open the same gallery.
Both views use the same step and decision
controls, and switching views does not write player progress or preferences.

Quest links explicitly marked `requiredForEndings` feed the quest workspace's
ending markers through [story-quest-requirements](../src/features/story/story-quest-requirements.ts).
Ordinary links (including optional quests and unlocked side quests) do not imply
requirements. Initial coverage is The Ticket's Lightkeeper case-recovery quest,
both Price of Independence branches for Savior, and Getting Acquainted for Debtor;
prerequisite chains are not inferred. Conditional and alternative requirements
carry explanatory notes. The list overlays only the active profile's selected
ending on the quest image; the trader board shows the same marker at the right.
No selection or a known inapplicable route hides those markers. Unresolved choices
retain the conditional marker. Quest details always show all annotated endings
above requirements, with stacked icons, the selected icon emphasized, and links
to the requiring chapter objectives. This is informational and does not change
quest availability, completion, ignored flags, or item demand.
Story quest references render as neutral buttons with foreground text and retain
the shared quest hover preview. A step's `warningQuest` links the named quest inline
in its warning; explicit `failsEndings` metadata supplies a separate danger notice
above requirements on that quest's detail page, even without an ending selected.
Choose Your Friends Wisely is marked as failing Savior and links back to The Ticket.
Failure references never become required-quest markers or mutate story decisions.
Catalog-linked rewards use `rewardItems`, which render item chips alongside the
reward text and are excluded from the remaining-step item requirements.

Mr. Kerman's major and minor evidence, and how much major evidence each ending
needs, live in [the evidence list](../src/lib/data/story/evidence.ts). Each piece
names the chapter where it is found; that chapter's steps are matched to it by item
ID, or by name for items missing from the catalog, and marked as evidence. The story
index shows each chapter's evidence count when the target ending needs evidence.
Below the chapters, a responsive evidence grid lists only major items in three
columns on wide screens, two on medium screens and one on narrow screens, with
purple-filled cards for completed acquisition objectives and links to those
objectives. A small line below counts minor evidence found, without a completion
target. Items without a tracked acquisition objective remain explicitly
untracked. The chapter sidebar shows the total major evidence collected across
the active profile's chapters, out of nine (or two for Debtor), beside its heading.
Only chapters whose sections vary by ending show the target ending on their card.
The index shows the target ending's evidence requirement beside the evidence
heading. When recorded choices rule out endings, yellow Unavailable tabs beneath
the ending buttons toggle a full-width explanation above the chapters for that
ending, with links to review the choices. The explanation starts hidden and closes
with its close button, by toggling the tab again, or when the target ending or profile changes.
Completed chapter cards show a blue gradient and DONE label on the right, using
the same route-aware completion state as the chapter's completion action.

Choices appear where they matter: a decision made at a step renders inline there,
and sections that depend on it link back to it. Decisions made in other chapters
render as a flat row above the heading of the first section they shape. These
controls keep their authored position and stay visible when the section is
collapsed or hidden by a choice. The sidebar lists them all.
Inline objective choices share the banners' rounded blue, borderless treatment.
Recorded choices that rule out the selected target ending have a solid red header
with black text inline, and a square red left border plus explanation in the sidebar.
Sidebar choices with a location in the current objective list have a jump icon;
it expands the containing section, focuses the choice and smoothly scrolls to it
(instant scrolling for reduced motion). Choices hidden by the route have no jump
control until their objective is available.

Completing a step also completes the earlier active, required steps on the
route; un-completing one clears every later step. Sub-objectives toggle alone.
The progress card's **Complete chapter** action waits for relevant route choices
to be chosen or implied by the target ending, then completes visible required
steps only. Hidden branches, optional steps and sub-objectives are untouched.
Once complete, the action is disabled. An adjacent undo arrow reverses only the
steps added by that click, preserving earlier progress and choices. Undo is local
to the current chapter/profile visit and is unavailable after later step edits.

The [story model](../src/features/story/story-model.ts) resolves each decision from
the player's choice, else the single option compatible with the target ending.
A decision whose own condition fails cannot apply, so sections depending on it are
hidden. Sections or steps that depend on unresolved decisions are shown as pending
and excluded from the remaining count. Recorded choices can rule out endings; the
target ending never overrides a recorded choice. Lightkeeper access is a stored
yes/no answer that flags Lightkeeper steps and endings; it is not derived from quests.
Progress persistence is described in [user state](user-state.md).

## Validation

```bash
node --test --import jiti/register src/lib/quests/quest-availability.test.ts src/lib/quests/quest-item-index.test.ts src/server/queries/getKappaChecklistPageData.test.ts
node --test --import jiti/register src/features/quests/workspace/quest-workspace-selector.test.ts src/features/quests/workspace/quest-details-model.test.ts src/features/quests/import/quest-log-import-model.test.ts src/features/quests/quest-routes.test.ts
node --test --import jiti/register src/features/story/story-model.test.ts
node --test --import jiti/register src/features/story/chapter-completion.test.ts
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
requests. Opening an item's details loads that item's and its recipes' prices through the
[shared price cache](data-layer.md). No player progression or
quest filtering behavior depends on those prices.
