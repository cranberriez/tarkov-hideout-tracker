import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { itemModes, itemPrices, items, postgresSchema } from "../postgres/schema";
import { getCurrentPriceData, getStoredPriceHistoryData, getTraderOffersByItemIds } from "./price-data";

const require = createRequire(import.meta.url);
const { postgresFixture } = require("../../../db-scripts/lib/test-postgres.mjs") as {
	postgresFixture: () => Promise<{ pool: import("pg").Pool; close: () => Promise<void> }>;
};

test(
	"price reads preserve reference metadata, bounded observations, and mode-scoped trader offers",
	{
		skip: !process.env.TEST_DATABASE_URL,
	},
	async () => {
		const fixture = await postgresFixture();
		const db = drizzle(fixture.pool, { schema: postgresSchema });
		try {
			await db.insert(items).values({ id: "shared-item", name: "Shared", normalizedName: "shared" });
			await db.insert(itemModes).values([
				{ itemId: "shared-item", mode: "regular", onFleaMarket: true },
				{ itemId: "shared-item", mode: "pve", onFleaMarket: true },
			]);
			const offers = [
				{
					traderId: "prapor",
					price: 10,
					priceRUB: 10,
					currency: "RUB",
					currencyItemId: "rouble",
					minTraderLevel: 1,
					restockAmount: null,
					buyLimit: 2,
				},
			];
			const points = Array.from({ length: 12 }, (_, index) => ({
				timestamp: 1_000 + index,
				price: 100 + index,
				priceMin: 90 + index,
				offerCount: 3,
			})).slice(-10);
			await db.insert(itemPrices).values([
				{
					itemId: "shared-item",
					mode: "regular",
					avg24hPrice: "700",
					catalogAveragePrice: "700",
					high24hPrice: 900,
					catalogHighPrice: "900",
					low24hPrice: 600,
					catalogLowPrice: "600",
					lastLowPrice: 90,
					latestPrice: 100,
					latestPriceMin: 90,
					latestOfferCount: 3,
					latestPointAt: 1_009,
					sampleCount: 10,
					totalOfferCount: 30,
					lastCheckedAt: 2_000,
					catalogReferenceUpdatedAt: 2_100,
					recentPoints: points,
					traderPurchaseOffers: offers,
					traderSellOffers: [],
				},
				{
					itemId: "shared-item",
					mode: "pve",
					avg24hPrice: "1",
					catalogAveragePrice: "1",
					recentPoints: [],
					traderPurchaseOffers: [],
					traderSellOffers: [],
				},
			]);
			const regular = await getCurrentPriceData("regular", ["shared-item"], db);
			assert.equal(regular.data["shared-item"].avg24hPrice, 700);
			assert.equal(regular.data["shared-item"].price, 99);
			assert.equal(regular.data["shared-item"].fleaStability, "unstable");
			assert.ok(regular.data["shared-item"].fleaPriceReasons?.includes("stale"));
			assert.equal(regular.data["shared-item"].updatedAt, 1_009);
			const pve = await getCurrentPriceData("pve", ["shared-item"], db);
			assert.equal(pve.data["shared-item"].avg24hPrice, 1);
			assert.equal(pve.data["shared-item"].price, undefined);
			assert.equal(pve.data["shared-item"].fleaStability, "reference");
			assert.equal(pve.updatedAt, 0, "a null provider timestamp stays unknown instead of appearing fresh");
			assert.deepEqual((await getTraderOffersByItemIds("regular", ["shared-item"], db))["shared-item"], offers);
			assert.deepEqual((await getTraderOffersByItemIds("pve", ["shared-item"], db))["shared-item"], []);
			assert.equal((await getStoredPriceHistoryData("regular", "shared-item", db)).data.length, 10);
			assert.equal((await getStoredPriceHistoryData("pve", "missing-item", db)).updatedAt, 0);
			assert.equal((await getCurrentPriceData("regular", ["missing-item"], db)).updatedAt, 0);
			assert.equal((await db.select().from(itemPrices).where(eq(itemPrices.mode, "pve"))).length, 1);
		} finally {
			await fixture.close();
		}
	},
);
