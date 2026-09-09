import "server-only";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getTursoClient } from "./client";
import { parseStoredJson } from "./stored-json";

export async function getReleaseDashboard(mode: TarkovJsonGameMode) {
	const result = await getTursoClient().execute({
		sql: `SELECT release.release_id, release.status, release.generated_at, release.uploaded_at,
                     release.schema_version, release.record_counts_json, active.activated_at
              FROM active_data_releases AS active
              JOIN data_releases AS release ON release.mode = active.mode AND release.release_id = active.release_id
              WHERE active.mode = ?`,
		args: [mode],
	});
	const row = result.rows[0];
	return row
		? {
				mode,
				releaseId: String(row.release_id),
				status: String(row.status),
				generatedAt: Number(row.generated_at),
				uploadedAt: row.uploaded_at === null ? null : Number(row.uploaded_at),
				activatedAt: Number(row.activated_at),
				schemaVersion: Number(row.schema_version),
				counts: parseStoredJson<Record<string, number>>(row.record_counts_json, "Current record counts"),
			}
		: null;
}
