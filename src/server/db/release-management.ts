import "server-only";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getTursoClient } from "./client";
import { getDevReleaseOverride } from "./dev-release-override";
import { getActiveDataReleaseId } from "./release-config";
import { parseStoredJson } from "./stored-json";

export async function getReleaseDashboard(mode: TarkovJsonGameMode, offset = 0) {
	const db = getTursoClient();
	const [active, tables, releases, override, effective] = await Promise.all([
		db.execute({ sql: "SELECT release_id, activated_at FROM active_data_releases WHERE mode = ?", args: [mode] }),
		db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'data_release_pins'"),
		db.execute({
			sql: `SELECT release_id, status, generated_at, uploaded_at, schema_version, record_counts_json
                  FROM data_releases WHERE mode = ? ORDER BY generated_at DESC, release_id DESC LIMIT 21 OFFSET ?`,
			args: [mode, offset],
		}),
		getDevReleaseOverride(mode),
		getActiveDataReleaseId(mode).then(
			(releaseId) => ({ releaseId, error: null }),
			(error) => ({ releaseId: null, error: error instanceof Error ? error.message : String(error) }),
		),
	]);
	const pin = tables.rows.length ? await db.execute({ sql: "SELECT release_id FROM data_release_pins WHERE mode = ?", args: [mode] }) : null;
	return {
		mode,
		sharedReleaseId: active.rows[0] ? String(active.rows[0].release_id) : null,
		pinned: Boolean(pin?.rows.length),
		override,
		effective,
		hasMore: releases.rows.length > 20,
		releases: releases.rows.slice(0, 20).map((row) => ({
			releaseId: String(row.release_id),
			status: String(row.status),
			generatedAt: Number(row.generated_at),
			uploadedAt: row.uploaded_at === null ? null : Number(row.uploaded_at),
			schemaVersion: Number(row.schema_version),
			counts: parseStoredJson<Record<string, number>>(row.record_counts_json, "Release record counts"),
		})),
	};
}
