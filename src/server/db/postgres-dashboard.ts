import "server-only";

import { count, eq } from "drizzle-orm";
import type { TarkovDataMode } from "@/types/common";
import { getPostgresDb } from "@/server/postgres/connection";
import {
	barters,
	catalogStatus,
	crafts,
	itemDetails,
	itemModes,
	questModes,
	stationModes,
} from "@/server/postgres/schema";
import { DatabaseConfigurationError } from "./errors";

export async function getCatalogDashboard(mode: TarkovDataMode) {
	const db = getPostgresDb();
	const [status] = await db.select().from(catalogStatus).where(eq(catalogStatus.mode, mode)).limit(1);
	if (!status || status.contentVersion <= 0)
		throw new DatabaseConfigurationError(`No current catalog exists for ${mode}. Run db:update.`);
	const [items, stations, quests, craftRows, barterRows, detailRows] = await Promise.all([
		db.select({ count: count() }).from(itemModes).where(eq(itemModes.mode, mode)),
		db.select({ count: count() }).from(stationModes).where(eq(stationModes.mode, mode)),
		db.select({ count: count() }).from(questModes).where(eq(questModes.mode, mode)),
		db.select({ count: count() }).from(crafts).where(eq(crafts.mode, mode)),
		db.select({ count: count() }).from(barters).where(eq(barters.mode, mode)),
		db.select({ count: count() }).from(itemDetails).where(eq(itemDetails.mode, mode)),
	]);
	return {
		contentVersion: String(status.contentVersion),
		status: status.updatedAt ? "Ready" : "Checked",
		discoveryInitialized: status.discoveryInitialized,
		checkedAt: status.checkedAt,
		updatedAt: status.updatedAt,
		counts: {
			items: items[0]?.count ?? 0,
			stations: stations[0]?.count ?? 0,
			quests: quests[0]?.count ?? 0,
			crafts: craftRows[0]?.count ?? 0,
			barters: barterRows[0]?.count ?? 0,
			itemDetails: detailRows[0]?.count ?? 0,
		},
	};
}
