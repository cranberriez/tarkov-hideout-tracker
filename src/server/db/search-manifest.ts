import { gzipSync, gunzipSync } from "node:zlib";
import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { FullQuest } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
import type { Trader } from "@/types/traders";
import { buildSearchManifest } from "@/lib/search/build-manifest";
import { validateSearchManifest } from "@/lib/search/manifest";
import { getTursoClient } from "./client";
import { boundedReadCache } from "./read-cache";
import { TursoDataIntegrityError } from "./errors";

export async function readSearchManifest(mode: TarkovJsonGameMode, releaseId: string, database?: Client) {
	const read = async () => {
		const db = database ?? getTursoClient();
		const query = (names: string[]) =>
			db.execute({
				sql: `SELECT manifest_name, payload_json FROM data_manifests
                WHERE mode = ? AND release_id = ? AND manifest_name IN (${names.map(() => "?").join(",")})`,
				args: [mode, releaseId, ...names],
			});
		const stored = await query(["compact-search-v1"]);
		let payload: unknown;
		if (stored.rows.length) payload = JSON.parse(String(stored.rows[0].payload_json));
		else {
			// Transitional support for ready datasets generated before the manifest existed.
			const legacy = await query(["items", "quests", "traders"]);
			const records = Object.fromEntries(
				legacy.rows.map((row) => [String(row.manifest_name), JSON.parse(String(row.payload_json))]),
			);
			if (!records.items?.previews || !records.quests?.previews || !records.traders?.records) {
				throw new TursoDataIntegrityError("Search summaries unavailable or data revision changed");
			}
			payload = buildSearchManifest(
				mode,
				records.items.previews as ItemSummary[],
				records.quests.previews as FullQuest[],
				records.traders.records as Trader[],
			);
		}
		const manifest = validateSearchManifest(payload, mode);
		// Compressed server cache entries stay below the shared cache-size guard.
		return gzipSync(JSON.stringify({ ...manifest, releaseId })).toString("base64");
	};
	const compressed = database ? await read() : await boundedReadCache(["compact-search", "1", mode, releaseId], read);
	return JSON.parse(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8"));
}
