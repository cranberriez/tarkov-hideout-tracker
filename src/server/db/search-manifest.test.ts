import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import { createJiti } from "jiti";
import path from "node:path";
import {
	postgresSchema,
	items,
	itemModes,
	itemDiscovery,
	traders,
	traderModes,
	stations,
	stationModes,
	stationLevels,
	stationItemRequirements,
	quests,
	questModes,
	crafts,
	barters,
	itemDetails,
	catalogStatus,
	itemPrices,
} from "../postgres/schema";
import { DatabaseTransientReadError } from "./errors";

const require = createRequire(import.meta.url);
const jiti = createJiti(import.meta.url, {
	alias: {
		"@": path.join(process.cwd(), "src"),
		"server-only": path.join(path.dirname(require.resolve("server-only")), "empty.js"),
	},
});
const { postgresFixture } = require("../../../db-scripts/lib/test-postgres.mjs") as {
	postgresFixture: () => Promise<{ pool: import("pg").Pool; close: () => Promise<void> }>;
};
const { getItemsByIds, getQuests, getRecipes, getStations, getTraders } =
	await jiti.import<typeof import("./domain-data")>("./domain-data.ts");
const { readSearchManifest } = await jiti.import<typeof import("./search-manifest")>("./search-manifest.ts");
const { searchItems } = await jiti.import<typeof import("../queries/searchItems")>("../queries/searchItems.ts");
const { getItemUsageView } = await jiti.import<typeof import("./item-views")>("./item-views.ts");

const modeList = ["regular", "pve", "pvp-season"] as const;
const modeNames = { regular: "Standard", pve: "PvE Name", "pvp-season": "Season Name" };

test(
	"PostgreSQL runtime readers preserve mode data, identities, current offers, and versioned search",
	{
		skip: !process.env.TEST_DATABASE_URL,
	},
	async () => {
		const fixture = await postgresFixture();
		const db = drizzle(fixture.pool, { schema: postgresSchema });
		const g = globalThis as typeof globalThis & { __tarkovPostgresDb?: typeof db };
		const oldDb = g.__tarkovPostgresDb;
		g.__tarkovPostgresDb = db;
		try {
			await db
				.insert(items)
				.values({ id: "item-stable-1", name: "Standard", normalizedName: "standard", shortName: "Standard" });
			await db.insert(itemModes).values(
				modeList.map((mode) => ({
					itemId: "item-stable-1",
					mode,
					onFleaMarket: true,
					displayOverride:
						mode === "regular"
							? null
							: {
									name: modeNames[mode],
									normalizedName: modeNames[mode].toLowerCase().replaceAll(" ", "-"),
									shortName: null,
									iconLink: null,
									gridImageLink: null,
									image512pxLink: null,
									baseImageLink: null,
									link: null,
									wikiLink: null,
								},
				})),
			);
			await db.insert(itemDiscovery).values(
				modeList.map((mode, index) => ({
					itemId: "item-stable-1",
					mode,
					firstSeenAt: index === 1 ? 1_700_000_000_000 : null,
					firstSeenPatch: index === 0 ? "pre-1.1.5" : index === 1 ? "1.1.5.0" : null,
					legacyFirstSeenReleaseId: index === 0 ? "legacy-release" : null,
				})),
			);
			await db.insert(traders).values({ id: "trader-prapor", name: "Prapor", normalizedName: "prapor" });
			await db.insert(traderModes).values(modeList.map((mode) => ({ traderId: "trader-prapor", mode })));
			await db.insert(stations).values({
				id: "station-workbench",
				name: "Workbench",
				normalizedName: "workbench",
				imageLink: "/workbench.png",
			});
			await db.insert(stationModes).values(modeList.map((mode) => ({ stationId: "station-workbench", mode })));
			await db.insert(stationLevels).values(
				modeList.map((mode, index) => ({
					stationId: "station-workbench",
					mode,
					level: 1,
					levelId: `level-workbench-${index}`,
					constructionTime: "10",
					stationRequirements: [],
					skillRequirements: [],
					traderRequirements: [],
				})),
			);
			await db.insert(stationItemRequirements).values(
				modeList.map((mode, index) => ({
					stationId: "station-workbench",
					mode,
					level: 1,
					requirementId: "requirement-stable-1",
					itemId: "item-stable-1",
					quantity: String(index + 1),
					foundInRaid: index === 2,
					isTool: false,
				})),
			);
			await db.insert(quests).values({
				id: "quest-stable-1",
				name: "A Test Quest",
				normalizedName: "a test quest",
				wikiLink: "https://example.test/quest",
			});
			await db.insert(questModes).values(
				modeList.map((mode, index) => ({
					questId: "quest-stable-1",
					mode,
					traderId: "trader-prapor",
					minPlayerLevel: 1,
					experience: 100,
					removed: false,
					objectives: [
						{
							id: "objective-1",
							type: "playerLevel",
							description: `level ${index}`,
							optional: false,
							playerLevel: index + 1,
						},
					],
					taskRequirements: [],
					failConditions: [],
					traderRequirements: [],
					otherRequirements: [],
					rewardGroups: {},
				})),
			);
			await db.insert(crafts).values(
				modeList.map((mode) => ({
					id: "craft-stable-1",
					mode,
					productItemId: "item-stable-1",
					productCount: "1",
					stationId: "station-workbench",
					level: 1,
					duration: "20",
					requiredItems: [],
					requiredQuestItems: [],
					gameEditions: [],
				})),
			);
			await db.insert(barters).values(
				modeList.map((mode) => ({
					id: "barter-stable-1",
					mode,
					offeredItemId: "item-stable-1",
					offeredCount: "1",
					traderId: "trader-prapor",
					minTraderLevel: 1,
					requiredItems: [],
				})),
			);
			await db.insert(itemPrices).values(
				modeList.map((mode) => ({
					itemId: "item-stable-1",
					mode,
					traderPurchaseOffers: [
						{
							traderId: "trader-prapor",
							price: 2,
							priceRUB: 2,
							currency: "RUB",
							currencyItemId: "rouble",
							minTraderLevel: 1,
							taskUnlockId: "quest-stable-1",
						},
					],
					traderSellOffers: [],
					recentPoints: [],
				})),
			);
			const relationPayload = {
				item: null,
				relatedItems: [],
				unresolvedItemIds: [],
				hideoutRequirements: [],
				questItemIndex: [],
				questRewardIndex: [],
				questAnyOfGroups: [],
				questAvailabilityQuests: [],
				freshness: { itemsUpdatedAt: null, stationsUpdatedAt: null, questsUpdatedAt: null, pricesUpdatedAt: null },
			};
			const usagePayload = {
				barters: [],
				crafts: [],
				items: [{ id: "item-stable-1", name: "Standard", normalizedName: "standard" }],
				itemIds: ["item-stable-1"],
				unresolvedItemIds: [],
				tradersById: {},
				taskUnlocksById: {},
				stationsById: {},
			};
			const acquisitionPayload = {
				rootItemId: "item-stable-1",
				barters: [],
				crafts: [],
				itemIds: ["item-stable-1"],
				truncated: false,
				items: usagePayload.items,
				unresolvedItemIds: [],
				freshness: { bartersUpdatedAt: 1, craftsUpdatedAt: 1, itemsUpdatedAt: 1, pricesUpdatedAt: null },
				errors: { barters: null, crafts: null, items: null, prices: null },
			};
			await db.insert(itemDetails).values(
				modeList.map((mode) => ({
					itemId: "item-stable-1",
					mode,
					relations: relationPayload,
					usage: usagePayload,
					acquisition: acquisitionPayload,
				})),
			);
			await db.insert(catalogStatus).values(
				modeList.map((mode) => ({
					mode,
					contentVersion: 10,
					checkedAt: 2_000,
					updatedAt: 1_500,
					sourceFreshness: {
						items: 1_100,
						stations: 1_200,
						quests: 1_300,
						traders: 1_300,
						skills: 1_200,
						crafts: 1_300,
						barters: 1_300,
					},
					discoveryInitialized: true,
				})),
			);

			for (const mode of modeList) {
				const itemResult = await getItemsByIds(mode, ["item-stable-1", "missing"], db as never, "10");
				assert.deepEqual(Object.keys(itemResult.data), ["item-stable-1"]);
				assert.equal(itemResult.data["item-stable-1"].id, "item-stable-1");
				assert.equal(itemResult.data["item-stable-1"].name, modeNames[mode]);
				if (mode === "pvp-season") {
					assert.equal(itemResult.data["item-stable-1"].firstSeenAt, null);
					assert.equal(itemResult.data["item-stable-1"].firstSeenPatch, undefined);
				}
				assert.equal(itemResult.data["item-stable-1"].buyFromTrader?.[0]?.taskUnlockId, "quest-stable-1");
				assert.equal(itemResult.updatedAt, 1_100);
				const stationResult = await getStations(mode, db as never, "10");
				assert.equal(stationResult.data[0].levels[0].itemRequirements[0].id, "requirement-stable-1");
				assert.equal(stationResult.data[0].levels[0].itemRequirements[0].count, modeList.indexOf(mode) + 1);
				assert.equal(stationResult.data[0].levels[0].itemRequirements[0].isFir, mode === "pvp-season");
				assert.equal(
					(await getQuests(mode, db as never, "10")).data[0].objectives[0].description,
					`level ${modeList.indexOf(mode)}`,
				);
				assert.equal((await getTraders(mode, db as never, "10")).data[0].id, "trader-prapor");
				const recipes = await getRecipes(mode, db as never, "10");
				assert.equal(recipes.crafts.data[0].id, "craft-stable-1");
				assert.equal(recipes.barters.data[0].id, "barter-stable-1");
				const manifest = (await readSearchManifest(mode, "10", db as never)) as {
					releaseId: string;
					items: Array<{ id: string; n: string }>;
					quests: Array<{ id: string }>;
				};
				assert.equal(manifest.releaseId, "10");
				assert.equal(manifest.items[0].id, "item-stable-1");
				assert.equal(manifest.items[0].n, modeNames[mode]);
				assert.equal(manifest.quests[0].id, "quest-stable-1");
			}
			const usage = await getItemUsageView("regular", "item-stable-1", false);
			assert.equal(usage.items[0].marketPrice, null, "prices=none leaves market hydration deferred");
			assert.equal(
				usage.items[0].buyFromTrader?.[0]?.traderId,
				"trader-prapor",
				"offers remain current in unpriced DTOs",
			);
			assert.equal(usage.tradersById["trader-prapor"].name, "Prapor");
			assert.equal(usage.taskUnlocksById["quest-stable-1"].name, "A Test Quest");
			await db.insert(traders).values({ id: "trader-new", name: "New Seller", normalizedName: "new-seller" });
			await db.insert(traderModes).values({ traderId: "trader-new", mode: "regular" });
			await db.insert(quests).values({ id: "quest-new", name: "New Unlock", normalizedName: "new-unlock" });
			await db.insert(questModes).values({
				questId: "quest-new",
				mode: "regular",
				traderId: "trader-new",
				experience: 1,
				removed: false,
				objectives: [],
				taskRequirements: [],
				failConditions: [],
				traderRequirements: [],
				otherRequirements: [],
				rewardGroups: {},
			});
			await db
				.update(itemPrices)
				.set({
					traderPurchaseOffers: [
						{
							traderId: "trader-new",
							price: 3,
							priceRUB: 3,
							currency: "RUB",
							currencyItemId: "rouble",
							minTraderLevel: 1,
							taskUnlockId: "quest-new",
						},
					],
				})
				.where(and(eq(itemPrices.itemId, "item-stable-1"), eq(itemPrices.mode, "regular")));
			const refreshedUsage = await getItemUsageView("regular", "item-stable-1", false);
			assert.equal(
				refreshedUsage.items[0].buyFromTrader?.[0]?.price,
				3,
				"offer changes arrive without changing catalog contentVersion",
			);
			assert.equal(refreshedUsage.tradersById["trader-new"].name, "New Seller");
			assert.equal(refreshedUsage.taskUnlocksById["quest-new"].name, "New Unlock");
			assert.equal(
				(await db.select().from(catalogStatus).where(eq(catalogStatus.mode, "regular")))[0].contentVersion,
				10,
			);
			const found = await searchItems("season name", "pvp-season", 10, db as never);
			assert.equal(found.items[0].name, "Season Name");
			await db.update(catalogStatus).set({ contentVersion: 11 }).where(eq(catalogStatus.mode, "regular"));
			await assert.rejects(readSearchManifest("regular", "10", db as never), DatabaseTransientReadError);
			await assert.rejects(
				(async () => {
					const { withStableCatalogRead } = await jiti.import<typeof import("./postgres-read")>("./postgres-read.ts");
					return withStableCatalogRead(
						"regular",
						async () => {
							await db.update(catalogStatus).set({ contentVersion: 12 }).where(eq(catalogStatus.mode, "regular"));
							return true;
						},
						db as never,
						"11",
					);
				})(),
				DatabaseTransientReadError,
			);
		} finally {
			if (oldDb) g.__tarkovPostgresDb = oldDb;
			else delete g.__tarkovPostgresDb;
			await fixture.close();
		}
	},
);
