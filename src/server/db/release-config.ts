import { cache } from "react";
import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { TursoConfigurationError } from "./errors";
import { getDevReleaseOverride } from "./dev-release-override";

export async function validateReleaseOverride(mode: TarkovJsonGameMode, releaseId: string, db: Client): Promise<string> {
	const result = await db.execute({
		sql: "SELECT release_id FROM data_releases WHERE mode = ? AND release_id = ? AND status = 'ready'",
		args: [mode, releaseId],
	});
	if (!result.rows.length) throw new TursoConfigurationError(`Development override ${mode}/${releaseId} is not ready. Clear it on /dev.`);
	return releaseId;
}

async function readActiveRelease(mode: TarkovJsonGameMode, database?: Client): Promise<string> {
	const db = database ?? (await import("./client")).getTursoClient();
	const override = await getDevReleaseOverride(mode);
	if (override) return validateReleaseOverride(mode, override, db);
	const result = await db.execute({
		sql: `SELECT active.release_id FROM active_data_releases AS active
              JOIN data_releases AS release
                ON release.mode = active.mode AND release.release_id = active.release_id
              WHERE active.mode = ? AND release.status = 'ready'`,
		args: [mode],
	});
	const releaseId = result.rows[0]?.release_id;
	if (typeof releaseId !== "string" || !releaseId.trim()) {
		throw new TursoConfigurationError(`No ready active data release for ${mode}. Run db:activate.`);
	}
	return releaseId;
}

// Shared within a React server render; the next render observes activation.
// No cross-request TTL delays database changes or rollback.
const getRenderReleaseId = cache((mode: TarkovJsonGameMode) => readActiveRelease(mode));

export function getActiveDataReleaseId(mode: TarkovJsonGameMode, database?: Client): Promise<string> {
	// Normalize optional arguments so callers using (mode) and (mode, undefined)
	// share the same React cache entry. Injected tooling/test clients bypass it.
	return database ? readActiveRelease(mode, database) : getRenderReleaseId(mode);
}
