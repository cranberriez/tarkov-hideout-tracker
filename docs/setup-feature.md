# Setup Feature — Game Edition & Mode Selection

## Overview

On first visit (when `hasCompletedSetup === false`), users are presented with an onboarding flow to choose their **game edition** and **game mode**. This configures starting station levels and the market price data source for the session.

---

## Components

| Component | File | Purpose |
|---|---|---|
| `SetupModal` | `src/features/setup/SetupModal.tsx` | Wrapper that manages the two-step flow |
| `GameModeSelection` | `src/features/setup/GameModeSelection.tsx` | Step 1 — choose PVP or PVE |
| `EditionSelection` | `src/features/setup/EditionSelection.tsx` | Step 2 — choose game edition |

`SetupModal` is rendered in `src/app/layout.tsx` (root layout) so it is available on all pages. It opens when `isSetupOpen === true` in `useUserStore`.

---

## Flow

1. On first load, `HideoutClientPage` calls `setSetupOpen(true)` if `!hasCompletedSetup`.
2. `SetupModal` renders `GameModeSelection` first.
3. After mode is selected, renders `EditionSelection`.
4. On edition selection, calls `completeSetup()` (sets `hasCompletedSetup: true`, `isSetupOpen: false`).
5. `applyEditionBonuses(stations)` is called, which sets the starting Stash and Cultist Circle levels.

The modal can also be reopened from anywhere via `setSetupOpen(true)` (e.g., a "Change Edition" button in settings).

---

## Game Mode (PVP / PVE)

Stored in `useUserStore.gameMode`. Defaults to `"PVP"`.

Controls which bucket of market prices is read from `PriceDataContext`:

```ts
const prices = marketPricesByMode[gameMode].prices;
```

Both PVP and PVE prices are fetched on every page load — switching modes is instant with no re-fetch.

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
gameMode: "PVP" | "PVE";
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
