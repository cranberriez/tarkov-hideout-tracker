import "server-only";

import { gzipSync, gunzipSync } from "node:zlib";
import { and, asc, eq, sql } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import type { Trader } from "@/types/traders";
import { buildSearchManifest } from "@/lib/search/build-manifest";
import { QUEST_PREPARATION_REVISION } from "@/lib/quests/quest-preparation";
import { validateSearchManifest } from "@/lib/search/manifest";
import { DatabaseTransientReadError } from "./errors";
import { boundedReadCache } from "./read-cache";
import { getCatalogVersion, withStableCatalogRead } from "./postgres-read";
import { getPostgresDb, type PostgresDatabase } from "@/server/postgres/connection";
import { items, itemModes, quests, questModes, traders, traderModes } from "@/server/postgres/schema";

async function build(mode: TarkovDataMode, contentVersion: string, database: PostgresDatabase) {
	const { data } = await withStableCatalogRead(
		mode,
		async (db) => {
			const itemRows = await db
				.select({
					id: items.id,
					name: sql`case when ${itemModes.displayOverride} is null then ${items.name} else ${itemModes.displayOverride}->>'name' end`.as(
						"name",
					),
					normalizedName:
						sql`case when ${itemModes.displayOverride} is null then ${items.normalizedName} else ${itemModes.displayOverride}->>'normalizedName' end`.as(
							"normalized_name",
						),
					shortName:
						sql`case when ${itemModes.displayOverride} is null then ${items.shortName} else ${itemModes.displayOverride}->>'shortName' end`.as(
							"short_name",
						),
					iconLink:
						sql`case when ${itemModes.displayOverride} is null then ${items.iconLink} else ${itemModes.displayOverride}->>'iconLink' end`.as(
							"icon_link",
						),
					categoryId: sql<string | null>`${itemModes.category}->>'id'`.as("category_id"),
					itemTypes: itemModes.itemTypes,
				})
				.from(items)
				.innerJoin(itemModes, and(eq(itemModes.itemId, items.id), eq(itemModes.mode, mode)))
				.orderBy(asc(items.normalizedName), asc(items.id));
			const traderRows = await db
				.select({
					id: traders.id,
					name: sql`case when ${traderModes.displayOverride} is null then ${traders.name} else ${traderModes.displayOverride}->>'name' end`.as(
						"name",
					),
					imageLink:
						sql`case when ${traderModes.displayOverride} is null then ${traders.imageLink} else ${traderModes.displayOverride}->>'imageLink' end`.as(
							"image_link",
						),
				})
				.from(traders)
				.innerJoin(traderModes, and(eq(traderModes.traderId, traders.id), eq(traderModes.mode, mode)))
				.orderBy(asc(traders.normalizedName), asc(traders.id));
			const questRows = await db
				.select({
					id: quests.id,
					name: sql`case when ${questModes.displayOverride} is null then ${quests.name} else ${questModes.displayOverride}->>'name' end`.as(
						"name",
					),
					normalizedName:
						sql`case when ${questModes.displayOverride} is null then ${quests.normalizedName} else ${questModes.displayOverride}->>'normalizedName' end`.as(
							"normalized_name",
						),
					lightkeeperRequired: questModes.lightkeeperRequired,
					traderId: questModes.traderId,
					traderName:
						sql`case when ${traderModes.displayOverride} is null then ${traders.name} else ${traderModes.displayOverride}->>'name' end`.as(
							"trader_name",
						),
					traderNormalizedName:
						sql`case when ${traderModes.displayOverride} is null then ${traders.normalizedName} else ${traderModes.displayOverride}->>'normalizedName' end`.as(
							"trader_normalized_name",
						),
				})
				.from(quests)
				.innerJoin(questModes, and(eq(questModes.questId, quests.id), eq(questModes.mode, mode)))
				.innerJoin(traders, eq(traders.id, questModes.traderId))
				.innerJoin(traderModes, and(eq(traderModes.traderId, questModes.traderId), eq(traderModes.mode, mode)))
				.orderBy(asc(quests.normalizedName), asc(quests.id));
			const compactQuests = questRows.map((quest) => ({
				id: quest.id,
				name: quest.name,
				normalizedName: quest.normalizedName,
				trader: { id: quest.traderId ?? "", name: quest.traderName, normalizedName: quest.traderNormalizedName },
				lightkeeperRequired: quest.lightkeeperRequired,
			})) as never;
			const compactItems = itemRows.map(({ categoryId, itemTypes, ...item }) => ({
				...item,
				itemTypes: itemTypes ?? undefined,
				shortName: item.shortName ?? undefined,
				iconLink: item.iconLink ?? undefined,
				category: categoryId ? { id: categoryId, name: "", normalizedName: "" } : undefined,
			})) as never;
			const compactTraders = traderRows.map((trader) => ({
				id: trader.id,
				name: trader.name as string,
				normalizedName: "",
				imageLink: typeof trader.imageLink === "string" ? trader.imageLink : undefined,
			})) as Trader[];
			return validateSearchManifest(buildSearchManifest(mode, compactItems, compactQuests, compactTraders), mode);
		},
		database,
		contentVersion,
	);
	return gzipSync(JSON.stringify({ ...data, releaseId: contentVersion })).toString("base64");
}

export async function readSearchManifest(mode: TarkovDataMode, contentVersion: string, database?: PostgresDatabase) {
	if (!database) {
		// Cached per version; a build verifies its own version before it can be stored.
		if ((await getCatalogVersion(mode)) !== contentVersion)
			throw new DatabaseTransientReadError("Search revision changed");
		const compressed = await boundedReadCache(
			["compact-search", "5", QUEST_PREPARATION_REVISION, mode, contentVersion],
			() => build(mode, contentVersion, getPostgresDb()),
		);
		return JSON.parse(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8"));
	}
	if ((await getCatalogVersion(mode, database)) !== contentVersion)
		throw new DatabaseTransientReadError("Search revision changed");
	const compressed = await build(mode, contentVersion, database);
	if ((await getCatalogVersion(mode, database)) !== contentVersion)
		throw new DatabaseTransientReadError("Search revision changed");
	return JSON.parse(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8"));
}
