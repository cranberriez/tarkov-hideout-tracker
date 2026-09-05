# Tarkov Hideout Tracker

A web app for Escape from Tarkov players to track hideout upgrades, inventory,
quest progress, quest hand-ins, and item requirements.

## Features

-   **Quests page**: Browse Tarkov.dev quest data by tree, trader, map, or list.
-   **Quest progress**: Track completed, failed, pinned, ignored, and item-ready quests.
-   **Manual quest sync**: Rebuild quest progress trader by trader from the quests currently visible in game.
-   **Quest log import**: Semi-automated log importing helps keep quest state closer to your character.
-   **Character settings**: Adjust level, faction, prestige, trader loyalty, game edition, and game mode in one place.
-   **Quest items on Items**: Include quest hand-ins and quest item groups alongside hideout requirements.
-   **Item filtering**: Filter by hideout items, quest items, available/future quest demand, FiR, pinned quests, Kappa, and Lightkeeper.
-   **Hideout tracking**: Manage station levels, hidden stations, upgrade readiness, and missing requirements.
-   **Inventory management**: Track collected item counts, including separate Found in Raid and non-FiR counts.
-   **Price data**: View current flea and trader values, recipe acquisition costs, and price history.
-   **Raid Planner**: Plan active quests on interactive objective maps with required keys, PMC extracts, and transits.
-   **Profit pages**: Compare barter and crafting routes with profile-aware availability and manual price overrides.
-   **Kappa checklist**: Track Collector items separately for each game mode.

## Profiles and saved progress

PVP, PVE, and KORD have independent character progress, inventory, quests, and
edition/setup state. KORD uses the seasonal dataset. Progress is saved locally in
your browser; some display preferences are shared between profiles. See
[user state](docs/user-state.md) for storage and reset details.

Inventory, Keys, Station Goals, and Bitcoin Farm currently have placeholder routes.

## Other Tarkov Trackers

This site started as a pet project and learning tool for an early-career web
developer. If you want more features, deeper progression tools, or probably more
active development, check out these excellent sites:

-   [ttracker.org](https://ttracker.org/)
-   [tarkovtracker.org](https://tarkovtracker.org/)
-   [kappas.pages.dev](https://kappas.pages.dev/)

## Development Setup

To set up the project locally, you will need a few prerequisites.

### 1. Storage

The hosted project runs on Vercel and reads normalized game data from Turso.
For local development, use the Turso database credentials for the selected
immutable releases.

### 2. Environment Variables

Copy [.sample.env](.sample.env) to `.env` if you do not already have a local
environment file, then fill in your details:

```bash
cp .sample.env .env
```

Required variables:

```env
TURSO_DATABASE_URL="libsql://your-database.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
```

Runtime release IDs are selected in
[release-config.ts](src/server/db/release-config.ts). `CRON_SECRET` protects
scheduled price refreshes. [Operations](docs/operations.md) covers environment
configuration, release publication, and price maintenance.

### 3. Run the Development Server

Install dependencies:

```bash
npm ci
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Run production checks:

```bash
npm run lint
npm run build
npm run docs:check
npm run test:architecture
npm run test:contracts
```

## Learn More

-   [Project documentation](docs/README.md)
-   [Contributor and AI agent guidance](AGENTS.md)
-   [Focused tests and operations](docs/operations.md)
-   [Next.js Documentation](https://nextjs.org/docs)
-   [Tarkov.dev API](https://api.tarkov.dev/)
