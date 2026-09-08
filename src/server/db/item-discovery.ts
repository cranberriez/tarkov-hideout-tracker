import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { ItemSummary } from "@/types/items";
import { canonicalIds, mapBatches } from "./read-cache";
import { TursoDataIntegrityError } from "./errors";

type ItemDiscovery = Pick<ItemSummary, "firstSeenAt" | "firstSeenPatch" | "firstSeenReleaseId">;

export async function getItemDiscovery(mode: TarkovJsonGameMode, ids: readonly string[], database: Client): Promise<Record<string, ItemDiscovery>> {
	if (!ids.length) return {};
	const results = await mapBatches(canonicalIds(ids), async (batch) => {
		const result = await database.execute({
			sql: `SELECT item_id, first_seen_at, first_seen_patch, first_seen_release_id
                  FROM item_catalog_history WHERE mode = ?
                  AND item_id IN (SELECT value FROM json_each(?))`,
			args: [mode, JSON.stringify(batch)],
		});
		return result.rows.map((row) => {
			const timestamp = row.first_seen_at === null ? null : Number(row.first_seen_at);
			if (
				typeof row.item_id !== "string" ||
				typeof row.first_seen_patch !== "string" ||
				typeof row.first_seen_release_id !== "string" ||
				(row.first_seen_patch === "pre-1.1.5" ? timestamp !== null : timestamp === null || !Number.isFinite(timestamp) || timestamp <= 0)
			) {
				throw new TursoDataIntegrityError("Invalid item discovery metadata");
			}
			return [
				row.item_id,
				{
					firstSeenAt: timestamp,
					firstSeenPatch: row.first_seen_patch,
					firstSeenReleaseId: row.first_seen_release_id,
				},
			] as const;
		});
	});
	return Object.fromEntries(results.flat());
}
