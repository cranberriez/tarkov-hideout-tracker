import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import type { PriceHistoryPoint } from "@/types/prices";
import { itemModes, itemPrices, itemPriceSync, items, postgresSchema } from "../postgres/schema";
import { getStoredPricePoints, PostgresPriceRefreshStore } from "./price-store";

const require = createRequire(import.meta.url);
const { postgresFixture } = require("../../../db-scripts/lib/test-postgres.mjs") as {
	postgresFixture: () => Promise<{ pool: import("pg").Pool; close: () => Promise<void> }>;
};

const hasDisposablePostgres = Boolean(process.env.TEST_DATABASE_URL);

test(
	"PostgreSQL refresh store isolates modes, retains values on 304/failure, and skips vanished items",
	{ skip: !hasDisposablePostgres },
	async () => {
		const fixture = await postgresFixture();
		const db = drizzle(fixture.pool, { schema: postgresSchema });
		try {
			for (const [id, mode, onFleaMarket] of [
				["item-a", "regular", true],
				["item-b", "regular", false],
				["item-a", "pve", true],
			] as const) {
				await db
					.insert(items)
					.values({
						id,
						name: id,
						normalizedName: id,
					})
					.onConflictDoNothing();
				await db.insert(itemModes).values({ itemId: id, mode, onFleaMarket });
			}
			const store = new PostgresPriceRefreshStore(db);
			const now = Date.now();
			assert.equal(await store.tryAcquireLock("regular", "run-a", now + 10_000, now), true);
			assert.equal(await store.tryAcquireLock("regular", "run-b", now + 10_000, now + 1), false);
			assert.equal(await store.renewLock("regular", "run-a", now + 20_000, now + 2), true);
			await store.startRun("run-a", "regular", now + 3);
			assert.deepEqual(await store.getEligibleItemIds("regular"), ["item-a"]);

			const purchaseOffer = {
				traderId: "prapor",
				price: 10,
				priceRUB: 10,
				currency: "RUB",
				currencyItemId: "rouble",
				minTraderLevel: 1,
				taskUnlockId: "task-a",
				restockAmount: null,
				buyLimit: 4,
			};
			const catalogRecords = [
				{
					itemId: "item-a",
					marketPrice: {
						avg24hPrice: 100,
						high24hPrice: 130,
						low24hPrice: 90,
						changeLast48hPercent: -20,
						updatedAt: 700,
						sellFor: [],
					},
					traderPurchaseOffers: [purchaseOffer],
				},
			];
			await store.writeCatalogPrices("regular", "run-a", catalogRecords);
			const [initialCatalogRow] = await db.select().from(itemPrices).where(eq(itemPrices.itemId, "item-a"));
			const initialCatalogChangedAt = initialCatalogRow.lastChangedAt;
			assert.ok(initialCatalogChangedAt !== null);
			await store.writeCatalogPrices("regular", "run-a", [{ itemId: "item-a", marketPrice: { updatedAt: 800 } }]);
			const [afterMissingCatalogObservation] = await db
				.select()
				.from(itemPrices)
				.where(eq(itemPrices.itemId, "item-a"));
			assert.equal(afterMissingCatalogObservation.catalogAveragePrice, "100");
			assert.equal(afterMissingCatalogObservation.catalogReferenceUpdatedAt, 700);
			assert.equal(afterMissingCatalogObservation.lastChangedAt, initialCatalogChangedAt);
			assert.deepEqual(afterMissingCatalogObservation.traderPurchaseOffers, [purchaseOffer]);
			await store.writeCatalogPrices("regular", "run-a", [
				{
					itemId: "item-a",
					marketPrice: { avg24hPrice: 50, updatedAt: 600, sellFor: [] },
					traderPurchaseOffers: [],
				},
			]);
			const [afterOlderCatalogObservation] = await db.select().from(itemPrices).where(eq(itemPrices.itemId, "item-a"));
			assert.equal(afterOlderCatalogObservation.catalogAveragePrice, "100");
			assert.equal(afterOlderCatalogObservation.catalogReferenceUpdatedAt, 700);
			assert.equal(afterOlderCatalogObservation.lastChangedAt, initialCatalogChangedAt);
			assert.deepEqual(afterOlderCatalogObservation.traderPurchaseOffers, [purchaseOffer]);
			await fixture.pool.query("create table catalog_update_writes (item_id text)");
			await fixture.pool.query(
				"create function count_catalog_update() returns trigger language plpgsql as $$ begin insert into catalog_update_writes values (new.item_id); return new; end $$",
			);
			await fixture.pool.query(
				"create trigger count_catalog_update after update on item_prices for each row execute function count_catalog_update()",
			);
			const changedOffer = { ...purchaseOffer, buyLimit: 8 };
			const changedOffersRecord = [{ ...catalogRecords[0], traderPurchaseOffers: [changedOffer] }];
			await store.writeCatalogPrices("regular", "run-a", changedOffersRecord);
			const [afterOfferChange] = await db.select().from(itemPrices).where(eq(itemPrices.itemId, "item-a"));
			assert.ok(afterOfferChange.lastChangedAt! > initialCatalogChangedAt!);
			const offerChangedAt = afterOfferChange.lastChangedAt;
			await store.writeCatalogPrices("regular", "run-a", changedOffersRecord);
			assert.equal(
				(await fixture.pool.query("select count(*)::int as count from catalog_update_writes")).rows[0].count,
				1,
			);
			const [afterOfferNoop] = await db.select().from(itemPrices).where(eq(itemPrices.itemId, "item-a"));
			assert.equal(afterOfferNoop.lastChangedAt, offerChangedAt);
			const originalPoints: PriceHistoryPoint[] = [
				{ timestamp: 100, price: 1_000, priceMin: 900, offerCount: 2 },
				{ timestamp: 200, price: 1_100, priceMin: 950, offerCount: null },
			];
			await store.writeOutcomes("regular", "run-a", [
				{
					status: "updated",
					itemId: "item-a",
					etag: '"v1"',
					checkedAt: 500,
					points: originalPoints,
					effectivePrice: 925,
					sampleCount: 2,
					totalOfferCount: 2,
				},
			]);
			await store.writeOutcomes("regular", "run-a", [
				{
					status: "updated",
					itemId: "item-a",
					etag: '"v1"',
					checkedAt: 550,
					points: originalPoints,
					effectivePrice: 925,
					sampleCount: 2,
					totalOfferCount: 2,
				},
			]);
			await assert.rejects(
				store.writeOutcomes("regular", "run-a", [
					{
						status: "updated",
						itemId: "item-a",
						etag: '"old"',
						checkedAt: 560,
						points: [{ timestamp: 150, price: 1_050, priceMin: 950, offerCount: 2 }],
						effectivePrice: 950,
						sampleCount: 1,
						totalOfferCount: 2,
					},
				]),
				/older observations/,
			);
			await store.writeOutcomes("regular", "run-a", [
				{ status: "not-modified", itemId: "item-a", etag: null, checkedAt: 600 },
				{
					status: "updated",
					itemId: "removed-item",
					etag: null,
					checkedAt: 700,
					points: originalPoints,
					effectivePrice: 925,
					sampleCount: 2,
					totalOfferCount: 2,
				},
			]);
			await store.writeOutcomes("regular", "run-a", [
				{ status: "failed", itemId: "item-a", checkedAt: 700, error: "provider unavailable" },
			]);

			const [current] = await db.select().from(itemPrices).where(eq(itemPrices.itemId, "item-a"));
			assert.equal(current.price, 925);
			assert.equal(current.avg24hPrice, "100");
			assert.equal(current.changeLast48hPercent, "-20");
			assert.equal(current.catalogReferenceUpdatedAt, 700);
			assert.deepEqual(current.traderPurchaseOffers, [changedOffer]);
			assert.deepEqual((await getStoredPricePoints(db, "regular", "item-a")).points, originalPoints);
			assert.deepEqual(
				current.recentPoints.map((point) => point.observedAt),
				[500, 500],
			);
			assert.ok(current.lastChangedAt! > current.lastCheckedAt!);
			const [sync] = await db.select().from(itemPriceSync).where(eq(itemPriceSync.itemId, "item-a"));
			assert.equal(sync.etag, '"v1"');
			assert.equal(sync.consecutiveFailures, 1);
			assert.equal(sync.lastError, "provider unavailable");
			assert.equal(
				await db
					.select()
					.from(itemPrices)
					.where(eq(itemPrices.itemId, "removed-item"))
					.then((rows) => rows.length),
				0,
			);
			assert.deepEqual(await store.getEligibleItemIds("pve"), ["item-a"]);
			await store.releaseLock("regular", "run-a");
		} finally {
			await fixture.close();
		}
	},
);
