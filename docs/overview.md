# Tarkov Hideout Tracker — Overview

A Next.js web app for tracking hideout upgrades and item requirements in Escape From Tarkov.

---

## Goals

- **Track all requirements** for every hideout station level.
- **Simulate in-game progression** starting from a configurable state based on game edition.
- **Pool required items** across all stations into a single checklist, respecting the user's current progress.
- **Separate FiR from non-FiR** requirements — some items must be Found in Raid; the app tracks both counts independently.
- **Show live market prices** for both PVP and PVE game modes (flea + best trader).
- **Let users manage inventory** — track how many of each item they already have.
- **Support game edition bonuses** — automatically set starting Stash and Cultist Circle levels.
- **Provide simple views**: a hideout-focused station view, an item checklist view, and a quest item requirements view.

---

## Core Concepts

**Station**
A hideout module (e.g., Lavatory, Generator, Workbench) with multiple upgrade levels. There are 25 stations tracked.

**Level**
A specific upgrade level of a station. Each level has item requirements and may have station, skill, or trader prerequisites.

**Item Requirement**
An item + quantity needed to build/upgrade. May require the item to be "Found in Raid" (FiR) based on per-station configuration in `src/lib/cfg/foundInRaid.ts`.

**FiR vs Non-FiR**
- Some station levels require items with the FiR attribute; others do not.
- The app tracks both `have` and `haveFir` counts separately in `useUserStore.itemCounts`.
- `showFirOnly` filter lets users focus on FiR items they still need.

**Hidden Station**
A station the user has chosen to exclude. Hidden stations are omitted from pooled item counts when `showHidden` is false (the default).

**Game Mode (PVP / PVE)**
Controls which market price set is shown. Prices are fetched for both modes on every request; the user switches mode without a reload.

**Game Edition**
Determines the starting Stash level and whether Cultist Circle starts at level 1:

| Edition | Stash | Cultist Circle |
|---|---|---|
| Standard | 1 | 0 |
| Left Behind | 2 | 0 |
| Prepare for Escape | 3 | 0 |
| Edge of Darkness | 4 | 0 |
| Unheard | 4 | 1 |

**Cheap Items**
Items below the `cheapPriceThreshold` (default 5,000 ₽). Can be hidden from the checklist with the `hideCheap` filter.

---

## Pages

| Route | Purpose |
|---|---|
| `/` | Redirects to `/hideout` |
| `/hideout` | Station list with upgrade levels and next-level requirements |
| `/items` | Pooled item checklist across all stations |
| `/quests` | Quest item requirements (giveItem objectives), filterable by trader and player level |
| `/news` | In-app news and update posts |
| `/settings` | User preferences (not currently a dedicated settings page) |

---

## Application State (High Level)

**Persisted in localStorage (via Zustand):**
- Current level per station
- Hidden/visible flag per station
- Manually completed individual requirements
- Item counts owned (`have` / `haveFir`)
- All view filters and preferences
- Game edition and game mode

**Server-fetched (via React context or server props):**
- Hideout station structure (from Tarkov.dev GraphQL, cached 12h)
- Required item metadata (from Tarkov.dev, cached 12h)
- Market prices for PVP and PVE (from Tarkov Market, refreshed daily via cron)
- Quest data and trader list (from Tarkov.dev GraphQL, cached 12h — passed as props to `/quests`)

See `state-management.md` for store shapes and `data-and-price-context-architecture.md` for the server data flow.

---

## Key Filters (Items Checklist)

| Filter | Effect |
|---|---|
| `checklistViewMode: "all"` | All levels above current for each station |
| `checklistViewMode: "nextLevel"` | Only the next level per station |
| `showHidden: false` | Exclude hidden stations from pooled items |
| `hideCheap` | Hide items below `cheapPriceThreshold` |
| `hideMoney` | Hide currency items (roubles, dollars, euros) |
| `showFirOnly` | Show only items where FiR count is still needed |

---

## Data Sources

| Source | What it provides |
|---|---|
| Tarkov.dev GraphQL | Station structure, item metadata, trader/skill info, quest data, trader list |
| Tarkov Market REST | Flea + trader prices for PVP and PVE modes |
| `wiki-data.json` + `foundInRaid.ts` | Manual overrides for requirements and FiR flags |
| localStorage | All user progress and preferences |

---

## Deployment

Hosted on Vercel. A daily cron job at 00:00 UTC refreshes market prices via `/api/cron/bulk-update`. See `cron-jobs.md`.
