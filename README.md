# Tarkov Hideout Tracker

A comprehensive tool for Escape from Tarkov players to track their Hideout progress, manage inventory, and calculate item requirements for upgrades.

## Features

### Version 2.0 Major Update

-   **Individual Item Counts**: Granular control over your inventory. Track the exact number of items you have versus what you need.
-   **Hideout Station Statuses**:
    -   **Ready to Upgrade**: You have all items and prerequisite station levels.
    -   **Missing Requirements**: Shows exactly what items or station levels are missing.
    -   **Illegal State**: Indicates if a station cannot be upgraded due to logical constraints (e.g., requiring a higher level of another station that isn't met).
-   **"Add Items" Feature**: Quickly tally up loot after a raid. These items feed directly into your total counts.
-   **FiR vs. Non-FiR Separation**: Strict separation between **Found in Raid** and **Non-Found in Raid** items to ensure you don't accidentally use quest items for crafting.
-   **Smart Item Usage**: The app knows when to use FiR items for non-FiR requirements only if they aren't needed for other FiR-specific upgrades.

### Core Features

-   **Hideout Tracking**: Interactive dashboard to manage your Hideout station levels and visualize your progress.
-   **Item Requirements**: Automatically calculates the total items needed to complete your Hideout based on your current station levels.
-   **Inventory Management**: Track your collected items and see exactly what remains to be found.
-   **Cost Analysis**: View current Tarkov.dev flea market prices for required items to estimate upgrade costs.

## Development Setup

To set up the project locally, you will need a few prerequisites.

### 1. Redis Storage (Required)

The application requires a Redis instance for data caching and state management.

-   You can use **Upstash Redis** (easiest for Vercel deployments) or any standard **Redis** instance.
-   Set the `REDIS_URL` environment variable to your connection string.
-   If using Vercel KV/Upstash, you may also need to set `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc., as seen in `.sample.env`.

### 2. Environment Variables

Copy the `.sample.env` file to `.env.local` and fill in your details:

```bash
cp .sample.env .env.local
```

Edit `.env.local`:

```env
# Redis / Upstash Configuration
REDIS_URL="redis://localhost:6379" # or your remote redis URL

# Cron endpoint bearer token
CRON_SECRET="your_secret_here"
```

### 3. Run the Development Server

Install dependencies:

```bash
npm install
# or
yarn install
```

Start the dev server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Refresh local price data:

```bash
npm run pull-prices
```

## Learn More

-   [Next.js Documentation](https://nextjs.org/docs)
-   [Tarkov.dev API](https://api.tarkov.dev/)
