import "server-only";

import { eq, max } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import type {
	CompletedItemsConversionData,
	DataStatusPayload,
	LegacyConversionStation,
	LegacyProfileConversionData,
} from "@/types/contracts";
import type { ItemIdentity } from "@/types/items";
import { catalogStatus, itemPrices, itemPriceSync } from "@/server/postgres/schema";
import { getPostgresDb } from "@/server/postgres/connection";
import { getCatalogVersion } from "./postgres-read";
import { getCachedItemsByIds, getCachedStations } from "./catalog-cache";
import { DatabaseConfigurationError } from "./errors";

function timestamp(value: unknown): number | null {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}
function domainStatus(freshness: Record<string, unknown>, key: string, label: string): DataStatusPayload["quests"] {
	const updatedAt = timestamp(freshness[key]);
	return {
		available: updatedAt !== null,
		updatedAt,
		diagnostics: updatedAt !== null ? { provider: "json" } : null,
		error: updatedAt !== null ? null : `${label} update time is unavailable.`,
	};
}

export async function getLegacyProfileConversionView(mode: TarkovDataMode): Promise<LegacyProfileConversionData> {
	try {
		const stations = await getCachedStations(mode, await getCatalogVersion(mode));
		return {
			stations: stations.data.map((station): LegacyConversionStation => ({
				id: station.id,
				name: station.name,
				maxLevel: station.levels.reduce((maxLevel, level) => Math.max(maxLevel, level.level), 0),
			})),
			freshness: { stationsUpdatedAt: stations.updatedAt },
			errors: { stations: null },
		};
	} catch {
		return {
			stations: [],
			freshness: { stationsUpdatedAt: null },
			errors: { stations: "Hideout station details could not be loaded." },
		};
	}
}

export async function getCompletedItemsConversionView(mode: TarkovDataMode): Promise<CompletedItemsConversionData> {
	const contentVersion = await getCatalogVersion(mode);
	let stations: Awaited<ReturnType<typeof getCachedStations>>;
	try {
		stations = await getCachedStations(mode, contentVersion);
	} catch {
		return {
			stations: [],
			items: [],
			unresolvedItemIds: [],
			freshness: { stationsUpdatedAt: null, itemsUpdatedAt: null },
			errors: { stations: "Hideout station data could not be loaded.", items: null },
		};
	}
	const uniqueIds = [
		...new Set(
			stations.data.flatMap((station) =>
				station.levels.flatMap((level) => level.itemRequirements.map((requirement) => requirement.itemId)),
			),
		),
	];
	try {
		const result = await getCachedItemsByIds(mode, contentVersion, uniqueIds);
		const items = Object.values(result.data).map(({ id, name, normalizedName }): ItemIdentity => ({
			id,
			name,
			normalizedName,
		}));
		return {
			stations: stations.data.map((station) => ({
				id: station.id,
				levels: station.levels.map((level) => ({
					level: level.level,
					itemRequirements: level.itemRequirements.map(({ id, itemId, count, isFir }) => ({
						id,
						itemId,
						count,
						isFir,
					})),
				})),
			})),
			items,
			unresolvedItemIds: uniqueIds.filter((id) => !result.data[id]),
			freshness: { stationsUpdatedAt: stations.updatedAt, itemsUpdatedAt: result.updatedAt },
			errors: { stations: null, items: null },
		};
	} catch {
		return {
			stations: stations.data.map((station) => ({
				id: station.id,
				levels: station.levels.map((level) => ({
					level: level.level,
					itemRequirements: level.itemRequirements.map(({ id, itemId, count, isFir }) => ({
						id,
						itemId,
						count,
						isFir,
					})),
				})),
			})),
			items: [],
			unresolvedItemIds: uniqueIds,
			freshness: { stationsUpdatedAt: stations.updatedAt, itemsUpdatedAt: null },
			errors: { stations: null, items: "Hideout item names could not be loaded." },
		};
	}
}

export async function getDataStatusView(mode: TarkovDataMode): Promise<DataStatusPayload> {
	const db = getPostgresDb();
	const [catalog] = await db.select().from(catalogStatus).where(eq(catalogStatus.mode, mode)).limit(1);
	if (!catalog || catalog.contentVersion <= 0)
		throw new DatabaseConfigurationError(`PostgreSQL catalog is not ready for ${mode}. Run db:update.`);
	let priceStatus: DataStatusPayload["prices"];
	try {
		const [prices] = await db
			.select({ changedAt: max(itemPrices.lastChangedAt) })
			.from(itemPrices)
			.where(eq(itemPrices.mode, mode));
		const [checks] = await db
			.select({ checkedAt: max(itemPriceSync.lastCheckedAt) })
			.from(itemPriceSync)
			.where(eq(itemPriceSync.mode, mode));
		priceStatus = { changedAt: timestamp(prices?.changedAt), checkedAt: timestamp(checks?.checkedAt), error: null };
	} catch {
		priceStatus = { changedAt: null, checkedAt: null, error: "Price update status could not be loaded." };
	}
	const freshness = (catalog.sourceFreshness ?? {}) as Record<string, unknown>;
	return {
		mode,
		releaseId: String(catalog.contentVersion),
		prices: priceStatus,
		quests: domainStatus(freshness, "quests", "Quest dataset"),
		crafts: domainStatus(freshness, "crafts", "Craft recipes"),
		barters: domainStatus(freshness, "barters", "Barter recipes"),
		stations: domainStatus(freshness, "stations", "Hideout station"),
		items: domainStatus(freshness, "items", "Item catalog"),
	};
}
