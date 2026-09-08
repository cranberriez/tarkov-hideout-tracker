import { cache } from "react";
import type { Client } from "@libsql/client";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { TursoConfigurationError } from "./errors";

async function readActiveRelease(mode: TarkovJsonGameMode, database?: Client): Promise<string> {
	const db = database ?? (await import("./client")).getTursoClient();
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
