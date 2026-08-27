# Setup Feature — Game Edition & Mode Selection

## Overview

On first visit (when `hasCompletedSetup === false`), users see a prominent **Setup** button in the navigation bar. The setup dialog opens only when they select that button; it does not interrupt their first page view. The flow configures their **game edition**, **game mode**, and optional current hideout levels.

---

## Components

| Component | File | Purpose |
|---|---|---|
| `SetupModal` | `src/features/setup/SetupModal.tsx` | Wrapper that manages the two-step flow |
| `GameModeSelection` | `src/features/setup/GameModeSelection.tsx` | Choose PVP, PVE, or KORD profile |
| `EditionSelection` | `src/features/setup/EditionSelection.tsx` | Step 2 — choose game edition |

`SetupModal` is rendered in `src/app/layout.tsx` (root layout) so it is available on all pages. It opens when `isSetupOpen === true` in `useUserStore`.

If an unhandled `deprecatedLegacyState` snapshot exists, the legacy profile
conversion dialog takes precedence over setup. The old snapshot remains available
from Settings if conversion is canceled.

---

## Flow

1. When `!hasCompletedSetup`, `Navbar` renders a highlighted Setup button beside the character preview.
2. Selecting Setup calls `setSetupOpen(true)` and opens `SetupModal`.
3. `SetupModal` renders game mode and edition selection, with an optional hideout-level step.
4. Saving calls `completeSetup()` (sets `hasCompletedSetup: true`, `isSetupOpen: false`).
5. `applyEditionBonuses(stations)` sets the starting Stash and Cultist Circle levels.

The modal can also be reopened from anywhere via `setSetupOpen(true)` (e.g., a "Change Edition" button in settings).

---

## Game Mode Profiles (PVP / PVE / KORD)

Stored in `useUserStore.gameMode`. Defaults to `"PVP"`. Each mode has independent character progress; see `game-mode-profiles.md`.

Controls which bucket of market prices is read from `PriceDataContext`:

```ts
const prices = marketPricesByMode[gameMode].prices;
```

The active mode's prices load first, then the other modes are prefetched. Progression data is refreshed when the character profile changes.

---

## Game Edition

Stored in `useUserStore.gameEdition`. Starts as `null`.

After setup, determines starting station levels via `applyEditionBonuses`:

| Edition | Stash | Cultist Circle |
|---|---|---|
| Standard | 1 | 0 |
| Left Behind | 2 | 0 |
| Prepare for Escape | 3 | 0 |
| Edge of Darkness | 4 | 0 |
| Unheard | 4 | 1 |

`editionBonusesAppliedFor` tracks which edition has already had its bonuses applied, so switching editions applies the new bonuses exactly once (no re-application on reload).

---

## Re-applying Edition Bonuses

If the user changes edition after setup:

1. `setGameEdition(newEdition)` updates the stored edition.
2. `applyEditionBonuses(stations)` must be called again — it checks `editionBonusesAppliedFor !== gameEdition` and applies the new bonus if different.
3. Only the Stash and Cultist Circle levels are adjusted; all other station levels are untouched.

---

## State Reference

```ts
// useUserStore fields relevant to setup
gameEdition: GameEdition | null;
gameMode: "PVP" | "PVE" | "KORD";
hasCompletedSetup: boolean;
isSetupOpen: boolean;
editionBonusesAppliedFor: GameEdition | null;

// Actions
setGameEdition(edition)
setGameMode(mode)
completeSetup()          // sets hasCompletedSetup: true, isSetupOpen: false
setSetupOpen(bool)
applyEditionBonuses(stations)
```
