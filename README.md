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
-   **Price data**: View Tarkov.dev flea market prices for PVP and PVE.

## Current Limitations

Only one character profile is currently supported. Switching between PVP and PVE
changes pricing and quest visibility, but it does not create a separate account
or separate quest progress.

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

Copy the `.sample.env` file to `.env` and fill in your details:

```bash
cp .sample.env .env
```

Required variables:

```env
TURSO_DATABASE_URL="libsql://your-database.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
```

The runtime release IDs are selected in `src/server/db/release-config.ts`.

### 3. Run the Development Server

Install dependencies:

```bash
npm install
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
```

## Learn More

-   [Next.js Documentation](https://nextjs.org/docs)
-   [Tarkov.dev API](https://api.tarkov.dev/)
