# User state

Player data is a protected boundary. Documentation, server-data, and component
refactors must leave persisted keys, fields, store APIs, versions, migrations,
profile isolation, and reset behavior unchanged. Before a feature changes
persistence, inspect the relevant implementation and tests below and explicitly
account for existing users' data.

## Persistent owners

| Storage key                                     | Owner and scope                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tarkov-hideout-profiles-state`                 | [useUserStore](../src/lib/stores/useUserStore.ts), Zustand persist **v24**; profiles, active profile projection, shared preferences and conversion state                                                                                                                           |
| `tarkov-hideout-user-state`                     | Previous application's save; read-only fallback through [user-state-storage](../src/lib/stores/user-state-storage.ts), never written or removed by the new user store                                                                                                              |
| `tarkov-kappa-checklist-state`                  | [useKappaStore](../src/lib/stores/useKappaStore.ts), Zustand persist **v1**; `completedItemsByMode` and shared `viewMode`                                                                                                                                                          |
| `tarkov-profit-price-overrides-v1:{mode}`       | [useManualPriceOverrides](../src/features/profit-pages/useManualPriceOverrides.ts); independent buy/sell overrides and optional empty-container values                                                                                                                             |
| `tarkov-profit-pinned-crafts-v1:{mode}`         | [usePinnedCrafts](../src/features/profit-pages/usePinnedCrafts.ts); independent craft pins                                                                                                                                                                                         |
| `tarkov-craft-board-v1:{mode}`                  | [StationBoard](../src/features/profit-pages/optimize/StationBoard.tsx); recipe acquisition variants, stable ingredient route choices and custom input costs                                                                                                                        |
| `tarkov-profit-options-v1:{mode}`               | [useProfitOptions](../src/features/profit-pages/useProfitOptions.ts); options-menu preferences and crafting skill shared by crafts and barters within each mode                                                                                                                    |
| `tarkov-bitcoin-farm-cards-v1:{mode}`           | [useBitcoinFarmCards](../src/features/hideout/power/useBitcoinFarmCards.ts); installed graphics-card count per profile for the Bitcoin Farm calculator, capped to built slots on read; not in backups or resets                                                                    |
| `tarkov-fuel-routes-v1:{mode}`                  | [useFuelRouteChoices](../src/features/hideout/power/useFuelRouteChoices.ts); chosen acquisition route key per fuel tank item ID, set in the generator Configure dialog; a stale key leaves the tank unpriced; not in backups or resets                                             |
| `tarkov-filter-drawer-v1:{page}`                | [ProfitPageClient](../src/features/profit-pages/ProfitPageClient.tsx); `shown`/`hidden` filter-drawer visibility per profit page (`barter-profits`, `crafting-profits`), not mode-scoped                                                                                           |
| `tarkov-app-preferences-v1`                     | [useAppPreferencesStore](../src/lib/stores/useAppPreferencesStore.ts), Zustand persist **v1**; global `theme` and `hoverCards`, shared by all profiles; not in backups or any reset; also read by the theme boot script in [app-preferences.ts](../src/lib/cfg/app-preferences.ts) |
| `tarkov-hideout:quest-log-import:seen-files:v1` | [quest-log-import.ts](../src/lib/quests/quest-log-import.ts) and [import controller](../src/features/quests/import/useQuestLogImportController.ts); processed-file metadata, not per-profile storage                                                                               |
| `tarkov-active-game-mode` cookie                | [game-mode.ts](../src/lib/game-mode.ts); active profile selection for server reads                                                                                                                                                                                                 |

Profit key suffixes are app modes `PVP`, `PVE`, and `KORD`, not dataset names.
The user/Kappa stores are separate persistent owners; neither owns the profit
keys or import-file metadata. Store definitions are the field inventory; do not
maintain a copied interface in documentation.

## Profiles, hydration, and setup

`PlayerProfileState` and `createDefaultPlayerProfile` in
[useUserStore](../src/lib/stores/useUserStore.ts) define character-scoped progress:
station levels/hidden stations/completed requirements, inventory, quest state
(including visited objectives and hand-ins), player/prestige level, trader loyalty,
Fence reputation, faction, edition, and setup state. `profiles` stores
PVP/PVE/KORD independently. The flat active fields are a projection used by
existing consumers; the wrapped setter keeps them synchronized with the active
profile. Shared display and filter preferences live outside the profile shape.
Use existing actions rather than writing one side of that projection directly.

Mode changes save/load the corresponding profile and synchronize the cookie.
[ActiveGameModeSync](../src/components/core/ActiveGameModeSync.tsx) repairs the
client/server selection after hydration using the store's current snapshot (the
initial render can still contain the server-default mode after hydration finishes).
This avoids alternating mode-cookie writes and refresh loops on missing routes.
[active-game-mode.ts](../src/server/active-game-mode.ts)
reads it for server queries. Dataset mapping is owned by [data layer](data-layer.md).

The new profile key takes precedence. When it is absent, the storage adapter reads
the old key without changing its bytes. Existing v19–v24 profile saves retain their
profiles, quests, preferences and conversion flags through the existing migration
chain. v24 only drops the removed Kappa/Lightkeeper quest-goal flags from
the top level and each profile. Flat saves (including main's v15 schema) become a retained conversion
snapshot with fresh conversion flags, even if a branch-switch test left a newer
version number or stale flags. Mixed saves written by an old build retain their
profile map and offer their flat progress for explicit conversion.

[LegacyProfileConversionDialog](../src/features/profile-conversion/LegacyProfileConversionDialog.tsx)
opens after hydration for an unconverted, undismissed snapshot. Its bounded station
query supplies labels only; loading or missing station metadata does not prevent
copying stable IDs. Conversion copies inventory with separate non-FiR/FiR balances
(including signed balances), station levels, completed hideout requirements,
hidden stations, character levels, traders, faction, edition and setup markers.
It replaces the chosen profile after an overwrite review and leaves other profiles
alone. The destination's "Has data" badge and overwrite review ignore the automatic
level-1 Stash in an otherwise untouched profile. Higher Stash levels, other station
upgrades, saved progress, or an explicitly configured profile still require review.
**Legacy quests are not imported:** completed/failed quests, visited
objectives, hand-ins, pins and history start fresh; ignored quests use
current defaults. Existing new-profile quests are preserved during key relocation.
Save failures restore the prior in-memory profile and show an error without reloading.

Conversion/dismissal flags and the retained snapshot live only in the new key.
Settings can reopen conversion after dismissal or completion. Subsequent changes
made by an old build do not overwrite the new profiles. Global legacy preferences
are not copied from flat saves. The old `v1-` export code remains unsupported because
it contains station levels only, not inventory; use the retained save for migration
and the JSON backup for ongoing backups. See the [repeatable test](operations.md#old-to-new-player-data-test).

Check the current `migrate` implementation and
[profile migration tests](../src/lib/stores/useUserStore.profile.test.ts) before
changing defaults or profile fields; adding a field involves more than an interface.

[Setup](../src/features/setup/) edits a local [draft](../src/features/setup/setup-draft.ts)
of mode, edition and station levels. Nothing reaches the store until Save/Complete,
when `completeSetup` writes the chosen profile, marks it set up and makes it active
(including the mode cookie) in one update; closing the dialog discards the draft.
Once any profile has completed setup its edition is inherited, so first-time setup
of another profile opens on Hideout Levels (Back still reaches mode/edition).
Edition bonuses are typed entries in [editionBonuses.ts](../src/lib/cfg/editionBonuses.ts)
(currently station levels: Stash 1/2/3/4/4 for Standard, Left Behind, Prepare for
Escape, Edge of Darkness, and Unheard; Unheard also Cultist Circle 1). Setup and
`initializeDefaults` share one applier, and bonus levels are floors: they raise
lower levels but never lower one, including when switching to a lower edition.
Profiles without an edition get the Standard baseline. The per-profile edition
marker prevents repeated bonus application. Preserve progress-aware handling in
the draft model.

## Player progress backups

Settings uses [PlayerProgressCard](../src/features/settings/PlayerProgressCard.tsx)
and its [controller](../src/features/settings/useProgressBackupController.ts) to
download all three profiles directly as a versioned JSON file and review imports.
The import dialog starts with a file drop zone, then shows the chosen filename
and profile comparisons; choosing a file also works from the keyboard. The
[backup model](../src/features/settings/progress-backup.ts) validates the complete
file before any write, rejects unknown versions/fields and unsafe values, preserves
signed inventory balances produced by existing consumption actions, and
compares records independently of object key order. Files may contain any nonempty
selection of PVP/PVE/KORD profiles; IDs and modes are retained exactly.

The explicit [progress allowlist](../src/lib/player-progress.ts) includes inventory,
hideout levels/requirements, completed/failed quests, visited objectives, hand-ins,
history, character levels, traders, Fence reputation, faction, edition and setup
markers. Backups also include mode-specific Kappa completion and Crafting/Hideout
Management skills. They exclude hidden/ignored lists, pins, filters, display
preferences, craft plans, price overrides, import-file metadata, legacy conversion
archives, active mode and ephemeral UI state. Setup/edition markers travel with
progress to prevent onboarding from applying starting bonuses again.

Imports replace progression only for selected modes, including removing current
records absent from the incoming profile. Default profiles are preselected;
identical profiles are disabled and skipped. Existing progress requires selection
and an overwrite acknowledgment. Expandable comparisons show current/incoming
values and full records with their stable IDs. The
[storage coordinator](../src/features/settings/progress-backup-storage.ts) rejects
stale previews, uses dedicated user/Kappa import actions, preserves active-mode
projection and preferences, merges only skills into profit settings, and restores
previous state if a write fails. Persistent keys, schemas, migrations and reset
scopes are unchanged. The former hideout-only clipboard code is replaced by this
file format; old `v1-` codes are not accepted as full progress backups.

Run `node --test --import jiti/register src/features/settings/progress-backup.test.ts`
for file validation, round trips, defaults, comparisons, mode isolation, reload,
preference preservation and write-failure recovery.

## Reset behavior

[StorageResetCard](../src/features/settings/StorageResetCard.tsx) composes store
actions with resets of other owners. Its current behavior is:

| Settings action | Actual scope                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hideout reset   | Active profile's station levels, hidden stations, and completed requirements                                                                             |
| Item reset      | Active profile's inventory; Kappa completion for **all modes**, retaining Kappa view preference                                                          |
| Quest reset     | Active profile's completed/failed/visited-objective/hand-in/ignored/pinned/history state; removes the shared import seen-files key                       |
| Delete ALL data | Resets the entire user store and all three profiles to defaults, selects PVP and updates its cookie; resets all Kappa completion and its view preference |

Section resets preserve unrelated settings/profiles except the explicitly
all-mode Kappa reset above. Despite its label, Delete ALL data does **not** remove
the separate profit overrides, craft pins, import seen-files key, or app preferences. Do not broaden
that action implicitly. Profit options also remain independent of these resets.
The old user-state key remains untouched by every new-app reset, including Delete
ALL data. That action clears the new conversion snapshot/flags along with new
profiles, but the now-present new key prevents silently importing the old key again.
The Crafting and Hideout Management skill options default to zero for older
payloads and are normalized to integers from 0 to 51; existing saved preferences
are retained without changing the storage key.
The Settings usage meter counts the two Zustand payloads,
not every localStorage key.

## Ephemeral and server state

[useUIStore](../src/lib/stores/useUIStore.ts) is not persisted. Dialog navigation,
draft inputs, and Raid Planner viewport state are session state. Fetched entities,
prices, and item relations come from route contracts/lazy requests; they do not
belong in the persisted progress store.
The item dialog adds same-URL browser-history entries containing only a session
token and position. Its item summaries stay in memory, are invalidated on mode
changes, and are not restored after a reload. Existing player storage, keys,
migrations and reset actions are unchanged; [architecture](architecture.md) owns
the Back, Forward and dismissal behavior.

Select only the store values needed by a consumer. For grouped selections follow
the existing `useShallow` pattern; put substantial derivation in pure models.
Do not combine a selector cleanup with a persistence redesign.

## Validation

```bash
node --test --import jiti/register src/lib/stores/useUserStore.profile.test.ts src/lib/stores/useKappaStore.test.ts src/lib/stores/quest-workspace-filters.test.ts src/lib/game-mode.test.ts
node --test --import jiti/register src/lib/stores/user-state-storage.test.ts
```

For intentional persistence changes, test representative older payloads, reload,
mode switching, and the exact affected reset action using disposable browser
data. Never clear a contributor's saved progress to make a test pass.

## Craft board persistence

The station board shares the existing array of craft IDs with profit-table pins.
Multiple pins at a station are a routine, not simultaneous jobs. Its separate
mode-scoped board key stores recipe variants, input route keys and custom unit
costs. Existing pins and buy/sell amounts retain their keys, schema and values;
manual sale entries may additionally specify `sellSource` as flea or trader.
Older entries infer flea when accessible, otherwise trader.

Price entries may also carry an optional non-negative `emptyValue` in roubles,
initially consumed only for the two reviewed fuel-can IDs. It is the pre-tax sale price,
shared by all consumers in that profile, and independent of normal buy/sell prices.
The editor saves the entered amount unchanged; calculation consumers estimate and
deduct flea tax. Existing saved numbers are not rewritten.
Older payloads have no deduction or ingredient substitution; zero is an explicit
value. Buy/sell edits and resets preserve it; the fuel card's Empty value reset
removes only that field. Invalid empty values are ignored without dropping valid
buy/sell amounts. The storage key/version, progress backups and section/all-data
reset scopes remain unchanged. Empty values, like other price overrides, are not
part of progression backups or resets.

[useStoredProfitValue](../src/features/profit-pages/useStoredProfitValue.ts)
synchronizes pins and prices between mounted consumers/tabs using external-store
subscriptions. It never writes on mount, avoiding hydration/mode-switch data loss.
Storage failures fall back to memory for the visit. Existing reset scopes are
unchanged; the independent board key is not cleared by profile section resets.
