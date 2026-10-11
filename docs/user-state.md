# User state

Player data is a protected boundary. Documentation, server-data, and component
refactors must leave persisted keys, fields, store APIs, versions, migrations,
profile isolation, and reset behavior unchanged. Before a feature changes
persistence, inspect the relevant implementation and tests below and explicitly
account for existing users' data.

## Persistent owners

| Storage key                                     | Owner and scope                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tarkov-hideout-profiles-state`                 | [useUserStore](../src/lib/stores/useUserStore.ts), Zustand persist **v26**; profiles, active profile projection, shared preferences and conversion state                                                                                                                                                |
| `tarkov-hideout-user-state`                     | Previous application's save; read-only fallback through [user-state-storage](../src/lib/stores/user-state-storage.ts), never written or removed by the new user store                                                                                                                                   |
| `tarkov-kappa-checklist-state`                  | [useKappaStore](../src/lib/stores/useKappaStore.ts), Zustand persist **v1**; `completedItemsByMode`, shared `viewMode`, and uploader `ignoreInUploader` (reset with `viewMode`)                                                                                                                         |
| `tarkov-profit-price-overrides-v1:{mode}`       | [useManualPriceOverrides](../src/features/profit-pages/useManualPriceOverrides.ts); independent buy/sell overrides and optional empty-container values                                                                                                                                                  |
| `tarkov-profit-pinned-crafts-v1:{mode}`         | [usePinnedCrafts](../src/features/profit-pages/usePinnedCrafts.ts); independent craft pins                                                                                                                                                                                                              |
| `tarkov-craft-board-v1:{mode}`                  | [StationBoard](../src/features/profit-pages/optimize/StationBoard.tsx); recipe acquisition variants, stable ingredient route choices and custom input costs                                                                                                                                             |
| `tarkov-profit-options-v1:{mode}`               | [useProfitOptions](../src/features/profit-pages/useProfitOptions.ts); options-menu preferences and crafting skill shared by crafts and barters within each mode                                                                                                                                         |
| `tarkov-bitcoin-farm-cards-v1:{mode}`           | [useBitcoinFarmCards](../src/features/hideout/power/useBitcoinFarmCards.ts); installed graphics-card count per profile for the Bitcoin Farm calculator, capped to built slots on read; not in backups or resets                                                                                         |
| `tarkov-market-pinned-items-v1:{mode}`          | [useMarketPins](../src/features/items/market/useMarketPins.ts); pinned item IDs in pin order for the Market page's pinned table; not in backups or resets                                                                                                                                               |
| `tarkov-higher-lower-v1`                        | [useHigherLowerGame](../src/features/games/higher-lower/useHigherLowerGame.ts); `{ bestStreak }` for Higher or Lower, one global value shared by every profile and mode; not in backups or resets                                                                                                       |
| `tarkov-do-i-need-it-v1`                        | [useDoINeedItGame](../src/features/games/do-i-need-it/useDoINeedItGame.ts) via [useBestScore](../src/features/games/useBestScore.ts); `{ best }` streak using your progress, global like Higher or Lower; not in backups or resets                                                                      |
| `tarkov-do-i-need-it-all-v1`                    | [useDoINeedItGame](../src/features/games/do-i-need-it/useDoINeedItGame.ts) via [useBestScore](../src/features/games/useBestScore.ts); `{ best }` streak playing without progress (and before setup); not in backups or resets                                                                           |
| `tarkov-trader-alibi-v1`                        | [useTraderAlibiGame](../src/features/games/trader-alibi/useTraderAlibiGame.ts) via [useBestScore](../src/features/games/useBestScore.ts); `{ best }` score, global; not in backups or resets                                                                                                            |
| `tarkov-fuel-routes-v1:{mode}`                  | [useFuelRouteChoices](../src/features/hideout/power/useFuelRouteChoices.ts); chosen acquisition route key per fuel tank item ID, set in the generator Configure dialog; a stale key leaves the tank unpriced; not in backups or resets                                                                  |
| `tarkov-story-progress-v1:{mode}`               | [useStoryProgress](../src/features/story/useStoryProgress.ts) with [story-progress](../src/features/story/story-progress.ts); target ending, Lightkeeper access answer, decisions by ID and completed steps per chapter; tolerant parsing keeps unknown IDs; not in backups or resets yet               |
| `tarkov-filter-drawer-v1:{page}`                | [ProfitPageClient](../src/features/profit-pages/ProfitPageClient.tsx); `shown`/`hidden` filter-drawer visibility per profit page (`barter-profits`, `crafting-profits`), not mode-scoped                                                                                                                |
| `tarkov-app-preferences-v1`                     | [useAppPreferencesStore](../src/lib/stores/useAppPreferencesStore.ts), Zustand persist **v1**; global `theme`, `hoverCards` and `uploaderIntroSeen`, shared by all profiles; not in backups or any reset; also read by the theme boot script in [app-preferences.ts](../src/lib/cfg/app-preferences.ts) |
| `tarkov-battle-pass-ui-preferences-v1`          | [useBattlePassPreferences](../src/features/battle-pass/useBattlePassPreferences.ts); reward-page UI preferences shared across all profiles and modes; not in backups or resets |
| `tarkov-hideout:quest-log-import:seen-files:v1` | [quest-log-import.ts](../src/lib/quests/quest-log-import.ts) and [import controller](../src/features/quests/import/useQuestLogImportController.ts); processed-file metadata, not per-profile storage                                                                                                    |
| `tarkov-active-game-mode` cookie                | [game-mode.ts](../src/lib/game-mode.ts); active profile selection for server reads                                                                                                                                                                                                                      |

Profile key suffixes are `PVP`, `PVE`, `KORD` (Season 1), and `KORD:season-2` (Test), not dataset names. Existing Season 1 keys are retained unchanged; later seasonal characters use separate keys. The same scope applies to Kappa completion, story progress, profit options, craft boards, pins, price overrides, fuel routes and installed graphics cards.
Story chapter completion uses the existing mode-scoped progress writer and adds
only active required step IDs after route choices resolve. Its undo receipt is
ephemeral, scoped to the chapter/profile visit, and removes only IDs added by
that action if the chapter's completed steps have not since changed. Stored
choices, unknown IDs, other chapters, keys and the save version are preserved.
The character card's ending selector shares this story progress owner with the
Story Chapters page. Selecting an ending in either place updates both; selecting
it again clears only the target ending for the active mode.
The user/Kappa stores are separate persistent owners; neither owns the profit
keys or import-file metadata. Store definitions are the field inventory; do not
maintain a copied interface in documentation.

## Profiles, hydration, and setup

### Battle pass progress

Document-map navigation is independent of player progress. The `map` URL query
selects the shared map; a namespaced browser-history snapshot stores the view's
zoom, pan, hidden document types, and map color preference per entry. It merges with
existing Next.js history metadata and is validated on restore. This transient
state adds no local-storage key, profile field, migration, backup, or reset behavior.

[useBattlePass](../src/features/battle-pass/useBattlePass.ts) owns
`tarkov-battle-pass-{seasonId}-v1`, an independent account-wide save for each
season, shared across PVP/PVE/seasonal characters. Season 1 retains the exact
`tarkov-battle-pass-season-1-v1` key. Test uses `tarkov-battle-pass-season-2-v1`. It stores completed tile IDs,
goal tile IDs, retained legacy ordinary-document balances, a classified-document balance,
and avoided document types (defaulting to none for older saves). Collection
preferences persist in the same save and are shared across modes. They only break
equal-total-cost suggestion ties; explicit goals and minimum total cost remain
authoritative. After ordinary inventory, avoided shortages become classified
demand. When enabled, owned classified stock covers avoided types first, then
other shortages, once across the plan. The top document section and floating document panel show the same live remaining
ordinary and classified needs, owned-balance inputs, and collection toggles. Edits
in either view immediately update both. Known document item IDs read the selected seasonal character's inventory when
using KORD or viewing a non-current pass. For the current pass in PVP/PVE, they
read the active permanent profile. Explicit historical links never spend the new
seasonal character's stock. An absent historical character supplies zero stock
and is not created by editing the pass. Counts combine non-FiR and FiR stock. Missing records and
tracked zeros both mean zero owned ordinary documents. Legacy account-wide
ordinary balances remain saved but are inactive; they are never automatically
assigned to a profile. Reads never copy balances between profiles or rewrite the
account-wide save. Editing an ordinary balance uses the existing item count action,
creating an absent profile record as needed and retaining FiR stock where possible.
Classified balances remain account-wide and independent of profile inventory.
It reuses the external-store storage helper, never writes on mount, and synchronizes
between tabs. Battlepass saves remain independent of profile migrations, progression backups
and Settings resets.

Individual completion toggles only the selected tile. Page headers also offer
Complete suggested (the currently suggested prerequisite tiles on that page)
and Complete all (every tile on that page). Both add completion IDs without
uncompleting existing rewards. The **Consume Docs from Inventory** toggle defaults
off until changed and appears beside page navigation and below the
document panel's total. When enabled, individual and bulk completion spend only
newly completed rewards' actual document costs, using available non-FiR stock
before FiR stock and never deducting more than is available. Missing ordinary
inventory records spend nothing. Repeating a bulk completion spends nothing for
already completed rewards; marking a reward incomplete does not refund documents.
Classified allocation remains a preview and does not spend classified stock.
Completion never infers prior completions or clears goals. This permits recording
existing progress on a later page. Unknown saved IDs and inventory keys survive
updates; unknown goals are reported and cannot satisfy prerequisites. Numeric
balances normalize to integers from 0 to 99,999. Cumulative display, plan scope
and classified allocation never spend stored balances.
[useBattlePassPreferences](../src/features/battle-pass/useBattlePassPreferences.ts)
stores the requested plan scope, Use classified, Cumulative costs, Possible
progress, List view, Consume Docs from Inventory, Locations visibility, and
document-panel visibility in `tarkov-battle-pass-ui-preferences-v1`. These UI
preferences survive navigation and reload and are shared across profiles and
PVP/PVE/KORD. All boolean preferences default off; plan scope defaults to Goals
(displaying Everything when no goals exist). Reads normalize invalid fields
without writing, edits preserve unknown preferences, and the external-store
helper synchronizes open consumers and browser tabs. Page navigation position
and the separate document-map history state remain transient. No profile
migration, backup, or reset scope changes.
The **Possible progress** toggle previews
the current plan in page and slot order with one shared owned-document pool,
including classified stock only when **Use classified** is enabled. Classified
allocation covers avoided shortages first within each reward. Only fully covered
rewards count toward unlocking the next page; partial coverage never satisfies a
prerequisite.
Incomplete plan rewards show a green check for full coverage and a yellow `~`
beside each partially covered document count. Yellow portions of the overview
and page-minimap bars count full rewards plus the covered document fraction of
partial rewards. Completed
rewards contribute only to actual progress. This local preview does not change
completion, goals, saved balances, or **Consume Docs from Inventory** behavior.

### Seasonal activation and history

[seasons.ts](../src/lib/cfg/seasons.ts) owns stable IDs, names, colors, end dates
and seasonal crafting rules. The end date controls availability only: crossing
it never activates a character or clears progress. The registry order determines
the next season. A null end date means there is no scheduled end.

The v26 user-store migration assigns the existing KORD character to `season-1`,
retaining every profile field and the legacy conversion snapshot. Activation
creates a default character only if the available season has no profile, then
selects it. Repeated activation selects the existing character without resetting
it. Selection and all normal progress actions synchronize the active projection
and the matching seasonal profile. Storage failure during activation restores
the previous in-memory state and reports the error.

The three primary choices are PVE, PVP and the currently available season.
**View past** replaces them with saved seasonal characters; **View current**
returns to the primary list. Past characters stay editable. A banner on an old
seasonal character offers Activate or Switch to the current season. Availability
refreshes on focus and periodically while the page remains open.

Season 2 uses the placeholder name **Test** and blue identity color. Its character
starts with default progress, while shared app preferences remain intact. Profit
filters fall back to existing preferences until edited, but character skill
levels start at zero. No Season 1 character, battlepass or auxiliary key is
removed or copied into Test. Uploader receipts remount per seasonal identity.
The storage adapter merges unchanged seasonal fields from newer saved payloads
to preserve characters created in another tab; simultaneous edits to the same
field remain last-writer-wins.

Historical characters retain stable progress IDs, but the server's `pvp-season`
catalog is still the live seasonal dataset. This does not snapshot historical
quest/hideout provider releases. Battlepass/map snapshots are separately owned
by season through [battle-pass-seasons.ts](../src/lib/battle-pass-seasons.ts).

### Character profiles

`PlayerProfileState` and `createDefaultPlayerProfile` in
[useUserStore](../src/lib/stores/useUserStore.ts) define character-scoped progress:
station levels/hidden stations/station goals/completed requirements, inventory, quest state
(including visited objectives and hand-ins), player/prestige level, trader loyalty,
Fence reputation, faction, edition, and setup state. `profiles` stores
PVP/PVE plus a compatibility KORD projection. `seasonalProfiles` stores each
seasonal character under its stable season ID; `selectedSeasonId` determines
which character supplies the KORD projection. The flat active fields are a projection used by
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
the old key without changing its bytes. Existing v19–v25 profile saves retain their
profiles, quests, preferences and conversion flags through the existing migration
chain. v24 only drops the removed Kappa/Lightkeeper quest-goal flags from
the top level and each profile. v25 adds empty `stationGoals` to the top level and
each profile (keeping any present) and the shared `itemIgnoreStationGoals` off. Flat saves (including main's v15 schema) become a retained conversion
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
Only Skip (or Ignore on the follow-up banner) sets the dismissal flag; outside clicks
do not close the dialog, and Escape/close defers it for the page session while a
banner under the nav offers to reopen it. Settings can reopen conversion after
dismissal or completion. Subsequent changes
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
download permanent and all saved seasonal profiles as a versioned JSON file and review imports.
The import dialog starts with a file drop zone, then shows the chosen filename
and profile comparisons; choosing a file also works from the keyboard. The
[backup model](../src/features/settings/progress-backup.ts) validates the complete
file before any write, rejects unknown versions/fields and unsafe values, preserves
signed inventory balances produced by existing consumption actions, and
compares records independently of object key order. Version 2 files may contain any nonempty
selection of PVP/PVE/KORD/KORD:season-2 profiles. KORD always means Season 1
in a backup, regardless of the currently selected character. Version 1 files
remain supported and their KORD entry also targets Season 1. The review lists
season names explicitly, including new archive destinations; IDs stay unchanged.

The explicit [progress allowlist](../src/lib/player-progress.ts) includes inventory,
hideout levels/requirements, completed/failed quests, visited objectives, hand-ins,
history, character levels, traders, Fence reputation, faction, edition and setup
markers. Backups also include mode-specific Kappa completion and Crafting/Hideout
Management skills. They exclude hidden/ignored lists, station goals, pins, filters, display
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
previous state if a write fails. The backup envelope is version 2; existing profile storage keys remain in place. The former hideout-only clipboard code is replaced by this
file format; old `v1-` codes are not accepted as full progress backups.

Run `node --test --import jiti/register src/features/settings/progress-backup.test.ts`
for file validation, round trips, defaults, comparisons, mode isolation, reload,
preference preservation and write-failure recovery.

## Reset behavior

The Item Checklist's bottom filter drawer lists active result restrictions with
removable icon chips. **Clear search and filters** in a filtered empty state uses
the existing visibility actions to show all future hideout and quest requirements,
including hidden stations, ignored quests and future FiR needs, without station-goal
caps, source, cheap-price, FiR-only or pinned-only restrictions. Saved hidden/ignored
IDs, station goals, pins, inventory, completion and profile progress remain intact;
threshold/lookahead numbers and display preferences are retained. The existing
`showHidden` and `checklistViewMode` preferences are shared with Hideout, so broadening
them here also changes Hideout visibility. Sort, item size and categorization do not
count as active filters. This adds no persistent field, migration or reset scope.

[StorageResetCard](../src/features/settings/StorageResetCard.tsx) composes store
actions with resets of other owners. Its current behavior is:

| Settings action | Actual scope                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hideout reset   | Active profile's station levels, hidden stations, station goals, and completed requirements                                                              |
| Item reset      | Active profile's inventory; Kappa completion for **all modes**, retaining Kappa view preference                                                          |
| Quest reset     | Active profile's completed/failed/visited-objective/hand-in/ignored/pinned/history state; removes the shared import seen-files key                       |
| Delete ALL data | Resets the user store, including saved seasonal characters, to defaults, selects PVP and updates its cookie; resets all Kappa completion and its view preference |

Section resets preserve unrelated settings/profiles except the explicitly
all-mode Kappa reset above. Despite its label, Delete ALL data does **not** remove
the separate profit overrides, craft pins, import seen-files key, or app preferences. Do not broaden
that action implicitly. Profit options also remain independent of these resets. The locked craft/barter
route preference defaults to false for older saves, preserves existing options,
and uses the same mode-scoped key without a migration.
The old user-state key remains untouched by every new-app reset, including Delete
ALL data. That action clears the new conversion snapshot/flags along with new
profiles, but the now-present new key prevents silently importing the old key again.
The Crafting and Hideout Management skill options default to zero for older
payloads and are normalized to integers from 0 to 51; existing saved preferences
are retained without changing the storage key.
The Settings usage meter counts the two Zustand payloads,
not every localStorage key.
The top-per-station/trader filter defaults off, its count defaults to 2 and accepts integers
1–5, and ignore-player-level defaults off for older profit-option payloads. They
use the existing mode-scoped profit key and preserve all other saved preferences.
Ignoring player level only changes pricing inputs; it never rewrites profile levels.

## Ephemeral and server state

Site ratings use independent, site-wide cookies `tarkov-feedback-submitted` and
`tarkov-feedback-reshow-at`, with Path=/ and SameSite=Lax (Secure on HTTPS).
They are shared across profiles/modes, outside backups and every progress reset.
The rating action validates `good`/`bad` and ignores repeats while success or a
retry deadline is saved. Success saves `true` and clears the retry date; failure
saves `false` with a timestamp 48 hours ahead. A lost action response writes the
failure cookies in the browser. Cookies last 400 days (subject to browser limits);
return visits renew successful suppression. Closing the result is ephemeral and
does not change these cookies. The widget checks them on focus and schedules the
retry deadline while a page stays open. It never changes player data.
Accepted submissions increment the site-wide PostgreSQL `feedback` singleton's
`good` or `bad` counter before success is saved. No voter identity or per-vote record
is stored. These aggregate totals remain outside player backups and resets; cookies
only suppress browser repeats and cannot guarantee exactly-once voting.

Uploader decisions remain ephemeral. The uploader reads saved item counts to
decide which scanned copies are still needed. Its explicit Kept only/Everything
actions add the scan's FIR/non-FIR quantities through `addItemCounts`. Sends are
tracked per scan in page state, so repeating an action adds nothing and sending
everything after kept items adds only the remainder; a new scan starts fresh.
Unknown FIR quantities block the corresponding send. No schema, storage key,
migration, or reset behavior changes.

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
