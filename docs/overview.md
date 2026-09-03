# Tarkov Hideout Tracker — Overview

A Next.js app for tracking Escape From Tarkov hideout upgrades, quest item
requirements, and inventory across PVP, PVE, and KORD profiles.

## Goals

- Track every hideout station level and its remaining requirements.
- Pool hideout and quest item demand against the user's inventory.
- Track Found in Raid and ordinary counts independently.
- Show current flea and trader values for standard items.
- Preserve independent character progress for each supported game mode.
- Keep all player progress local and stable across server-data refactors.

## Core concepts

**Stations and requirements.** A station contains upgrade levels. Item
requirements retain stable requirement IDs for completion state and refer to
standard items by `itemId`.

**Found in Raid.** The app tracks `have` and `haveFir` independently. Requirement
FiR values combine upstream attributes with reviewed local overrides.

**Game modes.** PVP maps to the `regular` Tarkov.dev dataset, PVE to `pve`, and
KORD to `pvp-season`. Progress, inventory, quests, traders, faction, goals, and
edition are isolated per profile.

**Game editions.** Edition controls starting Stash and Cultist Circle levels:

| Edition | Stash | Cultist Circle |
|---|---:|---:|
| Standard | 1 | 0 |
| Left Behind | 2 | 0 |
| Prepare for Escape | 3 | 0 |
| Edge of Darkness | 4 | 0 |
| Unheard | 4 | 1 |

**Standard versus quest-specific items.** Standard items come from `/items`, can
have inventory and market state, and are shared by ID. Quest-specific pickup/find
items come from task content and are display-only.

## Pages

| Route | Purpose |
|---|---|
| `/` | Redirects to `/hideout` |
| `/hideout` | Station upgrades and next-level requirements |
| `/items` | Combined hideout and quest item checklist |
| `/quests` | Quest objectives, progression, prerequisites, and planning |
| `/items/inventory` | Inventory (placeholder) |
| `/items/kappa-checklist` | Collector quest item checklist with profile-specific completion tracking |
| `/items/keys` | Keys (placeholder) |
| `/items/barter-profits` | Recursive barter costs, availability, and profit comparison |
| `/items/crafting-profits` | Recursive craft costs, effective duration, and profit per hour |
| `/hideout/station-goals` | Hideout station goals (placeholder) |
| `/hideout/bitcoin-farm` | Bitcoin farm tools (placeholder) |
| `/news` | In-app news and updates |
| `/dev` | Development-only cache policy and quest snapshot comparison |

## Application state

Persisted in localStorage through `useUserStore`:

- station levels, hidden stations, and completed requirements;
- standard-item inventory counts;
- quest completion, failure, ignore, pin, and hand-in state;
- filters, preferences, setup state, and three game-mode profiles.

Persisted separately through `useKappaStore`:

- Collector checklist completion per game mode and the All/Need view preference.

Server-fetched data:

- mode-specific hideout stations with ID-based item requirements;
- the complete compact standard-item catalog and current market values;
- full or lightweight quest content with standard item IDs and inline
  quest-specific presentation;
- barter and craft indexes, queried lazily per selected standard item or loaded when a profit page is visited.

Server pages call named query modules in `src/server/queries/`. Each query requests
only the repository domains and IDs needed by that route and returns a contract from
`src/types/contracts.ts`. Clients build local ID indexes from those route-scoped
arrays. Search and item-detail relationships are fetched lazily through bounded API
routes instead of shipping the full catalog or every relationship in the layout.

## Item data flow

```text
page -> named query -> TarkovDataRepository -> cached JSON adapters
                    -> route-scoped items/prices by referenced ID
item search --------> bounded /api/items/search
item modal ---------> lazy relations + usage + acquisition + history APIs
profit pages -------> both recipe graphs + compact source presentation
```

The large catalog, barter index, and craft index use versioned Redis caches only.
Stations and quests additionally use small Next.js cache wrappers. All runtime
data services use Tarkov.dev JSON and all caches are isolated by game mode.

## Data sources

| Source | What it provides |
|---|---|
| Tarkov.dev JSON API | Items, market values, hideout, quests, traders, barters, crafts, maps, and price history |
| `wiki-data.json` and `foundInRaid.ts` | Reviewed requirement and FiR overrides |
| localStorage | Player progress and preferences |

See `state-management.md`, `data-and-price-context-architecture.md`, and
`caching-architecture.md` for detailed contracts.

## Deployment

The app is deployed on Vercel. Normalized source datasets refresh on a shared
24-hour production freshness window; price history uses a separate 15-minute
cache.
