// Shared by the application and offline publisher. No Next.js or provider imports.
export const PIN_SCHEMA = `CREATE TABLE IF NOT EXISTS data_release_pins (
    mode TEXT PRIMARY KEY CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    release_id TEXT NOT NULL,
    pinned_at INTEGER NOT NULL,
    FOREIGN KEY (mode, release_id) REFERENCES data_releases (mode, release_id)
) STRICT`;

/** @param {import('@libsql/client').Client} client */
export async function ensureReleasePins(client) {
	await client.execute(PIN_SCHEMA);
}

/**
 * @param {import('@libsql/client').Client} client
 * @param {string} releaseId
 * @param {string[]} modes
 * @param {Record<string, string>} expectedReleases
 * @param {{automatic?: boolean, pin?: boolean}} options
 */
export async function activateRelease(client, releaseId, modes, expectedReleases = {}, options = {}) {
	await ensureReleasePins(client);
	const transaction = await client.transaction("write");
	const activated = [];
	const skipped = [];
	try {
		for (const mode of modes) {
			const pinned = await transaction.execute({ sql: "SELECT release_id FROM data_release_pins WHERE mode = ?", args: [mode] });
			if (options.automatic && pinned.rows.length) {
				skipped.push(mode);
				continue;
			}
			if (expectedReleases[mode]) {
				const active = await transaction.execute({ sql: "SELECT release_id FROM active_data_releases WHERE mode = ?", args: [mode] });
				if (active.rows[0]?.release_id !== expectedReleases[mode] && active.rows[0]?.release_id !== releaseId) {
					throw new Error(`${mode} active release changed during update; refusing stale activation. Regenerate or explicitly activate after review.`);
				}
			}
			const result = await transaction.execute({ sql: "SELECT status FROM data_releases WHERE mode = ? AND release_id = ?", args: [mode, releaseId] });
			if (result.rows[0]?.status !== "ready") throw new Error(`${mode}/${releaseId} is not ready`);
			const now = Date.now();
			await transaction.execute({
				sql: `INSERT INTO active_data_releases (mode, release_id, activated_at) VALUES (?, ?, ?)
                      ON CONFLICT (mode) DO UPDATE SET release_id = excluded.release_id, activated_at = excluded.activated_at`,
				args: [mode, releaseId, now],
			});
			if (options.pin) {
				await transaction.execute({
					sql: `INSERT INTO data_release_pins (mode, release_id, pinned_at) VALUES (?, ?, ?)
                          ON CONFLICT (mode) DO UPDATE SET release_id = excluded.release_id, pinned_at = excluded.pinned_at`,
					args: [mode, releaseId, now],
				});
			} else if (!options.automatic) {
				await transaction.execute({ sql: "DELETE FROM data_release_pins WHERE mode = ?", args: [mode] });
			}
			activated.push(mode);
		}
		await transaction.commit();
		return { activated, skipped };
	} catch (error) {
		await transaction.rollback();
		throw error;
	} finally {
		transaction.close();
	}
}

/** @param {import('@libsql/client').Client} client @param {string} mode */
export async function resumeReleaseUpdates(client, mode) {
	await ensureReleasePins(client);
	// Keep today's selection; the next automatic publication can advance it.
	await client.execute({ sql: "DELETE FROM data_release_pins WHERE mode = ?", args: [mode] });
}
