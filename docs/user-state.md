# User state

Player data is a protected boundary. Documentation, server-data, and component
refactors must leave persisted keys, fields, store APIs, versions, migrations,
profile isolation, and reset behavior unchanged. Before a feature changes
persistence, inspect the relevant implementation and tests below and explicitly
account for existing users' data.

## Persistent owners

| Storage key | Owner and scope |
|---|---|
| `tarkov-hideout-user-state` | [useUserStore](../src/lib/stores/useUserStore.ts), Zustand persist **v23**; profiles, active profile projection, shared preferences and conversion state |
| `tarkov-kappa-checklist-state` | [useKappaStore](../src/lib/stores/useKappaStore.ts), Zustand persist **v1**; `completedItemsByMode` and shared `viewMode` |
| `tarkov-profit-price-overrides-v1:{mode}` | [useManualPriceOverrides](../src/features/profit-pages/useManualPriceOverrides.ts); independent buy/sell overrides |
| `tarkov-profit-pinned-crafts-v1:{mode}` | [usePinnedCrafts](../src/features/profit-pages/usePinnedCrafts.ts); independent craft pins |
| `tarkov-hideout:quest-log-import:seen-files:v1` | [quest-log-import.ts](../src/lib/utils/quest-log-import.ts) and [import controller](../src/features/quests/components/useQuestLogImportController.ts); processed-file metadata, not per-profile storage |
| `tarkov-active-game-mode` cookie | [game-mode.ts](../src/lib/game-mode.ts); active profile selection for server reads |

Profit key suffixes are app modes `PVP`, `PVE`, and `KORD`, not dataset names.
The user/Kappa stores are separate persistent owners; neither owns the profit
keys or import-file metadata. Store definitions are the field inventory; do not
maintain a copied interface in documentation.

## Profiles, hydration, and setup

`PlayerProfileState` and `createDefaultPlayerProfile` in
[useUserStore](../src/lib/stores/useUserStore.ts) define character-scoped progress:
station levels/hidden stations/completed requirements, inventory, quest state
(including visited objectives and hand-ins), player/prestige level, trader loyalty,
Fence reputation, faction, goals, edition, and setup state. `profiles` stores
PVP/PVE/KORD independently. The flat active fields are a projection used by
existing consumers; the wrapped setter keeps them synchronized with the active
profile. Shared display and filter preferences live outside the profile shape.
Use existing actions rather than writing one side of that projection directly.

Mode changes save/load the corresponding profile and synchronize the cookie.
[ActiveGameModeSync](../src/components/core/ActiveGameModeSync.tsx) repairs the
client/server selection after hydration; [active-game-mode.ts](../src/server/active-game-mode.ts)
reads it for server queries. Dataset mapping is owned by [data layer](data-layer.md).

The store's migration chain preserves older state and retained legacy-profile
conversion data. [LegacyProfileConversionDialog](../src/features/profile-conversion/LegacyProfileConversionDialog.tsx)
uses bounded conversion data to map stable progress into the selected profile.
Check the current `migrate` implementation and
[profile migration tests](../src/lib/stores/useUserStore.profile.test.ts) before
changing defaults or profile fields; adding a field involves more than an interface.

[Setup](../src/features/setup/) configures mode and edition through store actions.
Edition bonuses initialize Stash at levels 1/2/3/4/4 for Standard, Left Behind,
Prepare for Escape, Edge of Darkness, and Unheard respectively; Unheard also
starts Cultist Circle at level 1. The per-profile edition marker prevents repeated
bonus application. Preserve progress-aware handling in the existing action.

## Reset behavior

[StorageResetCard](../src/features/settings/StorageResetCard.tsx) composes store
actions with resets of other owners. Its current behavior is:

| Settings action | Actual scope |
|---|---|
| Hideout reset | Active profile's station levels, hidden stations, and completed requirements |
| Item reset | Active profile's inventory; Kappa completion for **all modes**, retaining Kappa view preference |
| Quest reset | Active profile's completed/failed/visited-objective/hand-in/ignored/pinned/history state; removes the shared import seen-files key |
| Delete ALL data | Resets the entire user store and all three profiles to defaults, selects PVP and updates its cookie; resets all Kappa completion and its view preference |

Section resets preserve unrelated settings/profiles except the explicitly
all-mode Kappa reset above. Despite its label, Delete ALL data does **not** remove
the separate profit overrides, craft pins, or import seen-files key. Do not broaden
that action implicitly. The Settings usage meter counts the two Zustand payloads,
not every localStorage key.

## Ephemeral and server state

[useUIStore](../src/lib/stores/useUIStore.ts) is not persisted. Dialog navigation,
draft inputs, and Raid Planner viewport state are session state. Fetched entities,
prices, and item relations come from route contracts/lazy requests; they do not
belong in the persisted progress store.

Select only the store values needed by a consumer. For grouped selections follow
the existing `useShallow` pattern; put substantial derivation in pure models.
Do not combine a selector cleanup with a persistence redesign.

## Validation

```bash
node --test --import jiti/register src/lib/stores/useUserStore.profile.test.ts src/lib/stores/useKappaStore.test.ts src/lib/stores/quest-workspace-filters.test.ts src/lib/game-mode.test.ts
```

For intentional persistence changes, test representative older payloads, reload,
mode switching, and the exact affected reset action using disposable browser
data. Never clear a contributor's saved progress to make a test pass.
