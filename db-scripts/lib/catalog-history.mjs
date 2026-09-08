// This release is a one-time historical boundary, never a runtime release pin.
export const BASELINE_RELEASE_ID = "20260904T211847Z";
export const BASELINE_PATCH = "pre-1.1.5";
export const CURRENT_GAME_PATCH = "1.1.5.0";

export function assertGamePatch(value) {
	if (typeof value !== "string" || !/^\d+\.\d+\.\d+\.\d+$/.test(value)) {
		throw new Error("--patch must be a four-part game version, such as 1.1.5.0");
	}
	return value;
}

export async function getBaselineIds(client, mode, baselineReleaseId = BASELINE_RELEASE_ID) {
	const result = await client.execute({
		sql: `SELECT entity.entity_id FROM data_entities AS entity
              JOIN data_releases AS release USING (mode, release_id)
              WHERE entity.mode = ? AND entity.release_id = ?
                AND entity.entity_type = 'item' AND release.status = 'ready'`,
		args: [mode, baselineReleaseId],
	});
	if (!result.rows.length) {
		throw new Error(`Missing ready item baseline ${mode}/${baselineReleaseId}; refusing to classify the whole catalog as new.`);
	}
	return result.rows.map((row) => String(row.entity_id));
}

export async function initializeCatalogHistory(client, modes, baselineReleaseId = BASELINE_RELEASE_ID) {
	// All requested modes initialize atomically. Never replace an established baseline.
	const transaction = await client.transaction("write");
	try {
		for (const mode of modes) {
			const existing = await transaction.execute({
				sql: "SELECT baseline_release_id FROM catalog_tracking WHERE mode = ?",
				args: [mode],
			});
			if (existing.rows.length) continue;
			await getBaselineIds(transaction, mode, baselineReleaseId);
			await transaction.execute({
				sql: `INSERT INTO item_catalog_history (mode, item_id, first_seen_at, first_seen_patch, first_seen_release_id)
                      SELECT mode, entity_id, NULL, ?, release_id FROM data_entities
                      WHERE mode = ? AND release_id = ? AND entity_type = 'item'
                      ON CONFLICT (mode, item_id) DO NOTHING`,
				args: [BASELINE_PATCH, mode, baselineReleaseId],
			});
			await transaction.execute({
				sql: "INSERT INTO catalog_tracking (mode, baseline_release_id, initialized_at) VALUES (?, ?, ?)",
				args: [mode, baselineReleaseId, Date.now()],
			});
		}
		await transaction.commit();
	} catch (error) {
		await transaction.rollback();
		throw error;
	} finally {
		transaction.close();
	}
}

export async function getKnownItemIds(client, mode) {
	const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'catalog_tracking'");
	if (tables.rows.length) {
		const initialized = await client.execute({ sql: "SELECT mode FROM catalog_tracking WHERE mode = ?", args: [mode] });
		if (initialized.rows.length) {
			const result = await client.execute({ sql: "SELECT item_id FROM item_catalog_history WHERE mode = ?", args: [mode] });
			if (!result.rows.length) throw new Error(`Catalog history for ${mode} is empty`);
			return new Set(result.rows.map((row) => String(row.item_id)));
		}
	}
	// Read-only checks can run before the additive migration.
	return new Set(await getBaselineIds(client, mode));
}

export function newCatalogItems(items, knownIds) {
	return items.filter((item) => !knownIds.has(item.id)).map(({ id, name }) => ({ id, name }));
}

export function catalogPublicationStatements(mode, releaseId, patch, now) {
	assertGamePatch(patch);
	return [
		{
			sql: `INSERT INTO item_catalog_history (mode, item_id, first_seen_at, first_seen_patch, first_seen_release_id)
                  SELECT mode, entity_id, ?, ?, release_id FROM data_entities
                  WHERE mode = ? AND release_id = ? AND entity_type = 'item'
                  ON CONFLICT (mode, item_id) DO NOTHING`,
			args: [now, patch, mode, releaseId],
		},
		{
			sql: "UPDATE data_releases SET status = 'ready', uploaded_at = COALESCE(uploaded_at, ?) WHERE mode = ? AND release_id = ?",
			args: [now, mode, releaseId],
		},
	];
}
