import { planDiscoveryReconciliation, reconcileDiscovery, validateDiscoveryExport } from "./discovery.mjs";

export const MODES = ["regular", "pve", "pvp-season"];
const LOCK_KEY = "7416203911027441";
const CHUNK = 200;
const JSON_COLUMNS = new Set([
	"category",
	"display_override",
	"station_requirements",
	"skill_requirements",
	"trader_requirements",
	"bonuses",
	"map",
	"objectives",
	"task_requirements",
	"fail_conditions",
	"other_requirements",
	"required_prestige",
	"reward_groups",
	"required_items",
	"required_quest_items",
	"game_editions",
	"relations",
	"usage",
	"acquisition",
]);

function json(value) {
	return JSON.stringify(value ?? null);
}
function distinctDisplay(value, primary, keys) {
	const changed = keys.some(
		([column]) => JSON.stringify(value[column] ?? null) !== JSON.stringify(primary[column] ?? null),
	);
	return changed ? Object.fromEntries(keys.map(([column, property]) => [property, value[column] ?? null])) : null;
}
function rowsFor(table, mode, data) {
	const itemRows = data.items.map((item) => ({
		id: item.id,
		name: item.name,
		normalized_name: item.normalizedName,
		short_name: item.shortName ?? null,
		icon_link: item.iconLink ?? null,
		grid_image_link: item.gridImageLink ?? null,
		image_512px_link: item.image512pxLink ?? null,
		base_image_link: item.baseImageLink ?? null,
		link: item.link ?? null,
		wiki_link: item.wikiLink ?? null,
	}));
	const itemModeRows = data.items.map((item) => ({
		item_id: item.id,
		mode,
		on_flea_market: item.onFleaMarket ?? null,
		min_level_for_flea: item.minLevelForFlea ?? null,
		resource_units: item.resourceUnits ?? null,
		category: json(item.category),
		display_override: null,
		source_updated_at: null,
	}));
	const traderRows = data.traders.map((x) => ({
		id: x.id,
		name: x.name,
		normalized_name: x.normalizedName,
		image_link: x.imageLink ?? null,
		image_4x_link: x.image4xLink ?? null,
	}));
	const traderModeRows = data.traders.map((x) => ({ trader_id: x.id, mode, display_override: null }));
	const stationRows = data.stations.map((x) => ({
		id: x.id,
		name: x.name,
		normalized_name: x.normalizedName,
		image_link: x.imageLink ?? null,
	}));
	const stationModeRows = data.stations.map((x) => ({
		station_id: x.id,
		mode,
		display_override: null,
		source_updated_at: null,
	}));
	const levelRows = [],
		requirementRows = [];
	for (const station of data.stations)
		for (const level of station.levels) {
			levelRows.push({
				station_id: station.id,
				mode,
				level: level.level,
				level_id: level.id,
				construction_time: level.constructionTime,
				station_requirements: json(level.stationLevelRequirements),
				skill_requirements: json(level.skillRequirements),
				trader_requirements: json(level.traderRequirements),
				bonuses: json(level.bonuses ?? []),
			});
			for (const requirement of level.itemRequirements)
				requirementRows.push({
					station_id: station.id,
					mode,
					level: level.level,
					requirement_id: requirement.id,
					item_id: requirement.itemId,
					quantity: requirement.count,
					found_in_raid: requirement.isFir,
					is_tool: requirement.isTool,
				});
		}
	const skillRows = data.skills.map((x) => ({ id: x.id, name: x.name, image_link: x.imageLink ?? null }));
	const skillModeRows = data.skills.map((x) => ({ skill_id: x.id, mode, display_override: null }));
	const questRows = data.quests.map((x) => ({
		id: x.id,
		name: x.name,
		normalized_name: x.normalizedName,
		wiki_link: x.wikiLink ?? null,
		task_image_link: x.taskImageLink ?? null,
	}));
	const questModeRows = data.quests.map((x) => ({
		quest_id: x.id,
		mode,
		trader_id: x.trader?.id ?? null,
		min_player_level: x.minPlayerLevel ?? null,
		experience: x.experience ?? 0,
		faction_name: x.factionName ?? null,
		kappa_required: x.kappaRequired ?? null,
		lightkeeper_required: x.lightkeeperRequired ?? null,
		removed: x.removed ?? false,
		map: json(x.map),
		display_override: null,
		source_updated_at: null,
		objectives: json(x.objectives),
		task_requirements: json(x.taskRequirements),
		fail_conditions: json(x.failConditions),
		trader_requirements: json(x.traderRequirements),
		other_requirements: json(x.otherRequirements),
		required_prestige: json(x.requiredPrestige),
		reward_groups: json({
			finishItemRewards: x.finishItemRewards,
			finishTraderStandingRewards: x.finishTraderStandingRewards,
			failureTraderStandingRewards: x.failureTraderStandingRewards,
		}),
	}));
	const craftRows = data.crafts.map((x) => ({
		id: x.id,
		mode,
		product_item_id: x.productItemId,
		product_count: x.productCount,
		station_id: x.stationId,
		level: x.level,
		duration: x.duration,
		task_unlock_id: x.taskUnlockId ?? null,
		required_items: json(x.requiredItems),
		required_quest_items: json(x.requiredQuestItems),
		game_editions: json(x.gameEditions),
	}));
	const barterRows = data.barters.map((x) => ({
		id: x.id,
		mode,
		offered_item_id: x.offeredItemId,
		offered_count: x.offeredCount,
		trader_id: x.traderId,
		min_trader_level: x.minTraderLevel,
		task_unlock_id: x.taskUnlockId ?? null,
		buy_limit: x.buyLimit ?? null,
		required_items: json(x.requiredItems),
	}));
	const detailRows = (data.itemDetails ?? []).map((x) => ({
		item_id: x.itemId,
		mode,
		relations: json(x.relations),
		usage: json(x.usage),
		acquisition: json(x.acquisition),
	}));
	return {
		items: itemRows,
		item_modes: itemModeRows,
		traders: traderRows,
		trader_modes: traderModeRows,
		stations: stationRows,
		station_modes: stationModeRows,
		station_levels: levelRows,
		station_item_requirements: requirementRows,
		skills: skillRows,
		skill_modes: skillModeRows,
		quests: questRows,
		quest_modes: questModeRows,
		crafts: craftRows,
		barters: barterRows,
		item_details: detailRows,
	};
}

function validateModeData(mode, data) {
	for (const key of ["items", "stations", "quests", "traders", "skills", "barters", "crafts"]) {
		if (!Array.isArray(data[key]) || data[key].length === 0)
			throw new Error(`${mode} ${key} input is empty or malformed`);
		const ids = data[key].map((row) => row?.id);
		if (ids.some((id) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) {
			throw new Error(`${mode} ${key} input contains an invalid or duplicate stable ID`);
		}
	}
	if (data.items.some((item) => !item.name || !item.normalizedName))
		throw new Error(`${mode} item input is missing required presentation fields`);
	if (data.stations.some((station) => !Array.isArray(station.levels)))
		throw new Error(`${mode} station input is malformed`);
	const itemIds = new Set(data.items.map((item) => item.id));
	if (
		!Array.isArray(data.itemDetails) ||
		data.itemDetails.length !== data.items.length ||
		new Set(data.itemDetails.map((detail) => detail?.itemId)).size !== itemIds.size ||
		data.itemDetails.some((detail) => {
			if (
				typeof detail?.itemId !== "string" ||
				!itemIds.has(detail.itemId) ||
				!detail.relations ||
				!detail.usage ||
				!detail.acquisition
			)
				return true;
			if (detail.relations.item?.id !== detail.itemId || detail.acquisition.rootItemId !== detail.itemId) return true;
			if (Object.values(detail.relations.errors ?? {}).some(Boolean)) return true;
			if (
				["bartersError", "craftsError", "presentationError", "itemsError", "pricesError"].some(
					(key) => detail.usage[key],
				)
			)
				return true;
			return Object.values(detail.acquisition.errors ?? {}).some(Boolean);
		})
	) {
		throw new Error(`${mode} item detail projections are incomplete`);
	}
	for (const recipe of [...data.crafts, ...data.barters]) {
		if (!Array.isArray(recipe.requiredItems)) throw new Error(`${mode} recipe ${recipe.id} has malformed requirements`);
	}
}

function rowKey(rows, fields) {
	return rows.map((row) => fields.map((f) => row[f]));
}
async function pruneIds(client, table, keyColumn, mode, keep) {
	const result = await client.query(`DELETE FROM ${table} WHERE mode=$1 AND NOT (${keyColumn}=ANY($2::text[]))`, [
		mode,
		keep,
	]);
	return result.rowCount ?? 0;
}
async function pruneKeys(client, table, keyFields, mode, keepRows) {
	if (!keepRows.length) {
		const result = await client.query(`DELETE FROM ${table} WHERE mode=$1`, [mode]);
		return result.rowCount ?? 0;
	}
	const values = rowKey(keepRows, keyFields);
	const predicate = keyFields
		.map((field, i) => `${field === "level" ? "t.level::text" : `t.${field}`}=v.k${i}`)
		.join(" AND ");
	const params = [mode, ...keyFields.map((_, col) => values.map((row) => String(row[col])))];
	const aliases = keyFields.map((_, i) => `k${i}`).join(",");
	const from = `UNNEST(${keyFields.map((_, i) => `$${i + 2}::text[]`).join(",")}) AS v(${aliases})`;
	const result = await client.query(
		`DELETE FROM ${table} t WHERE t.mode=$1 AND NOT EXISTS (SELECT 1 FROM ${from} WHERE ${predicate})`,
		params,
	);
	return result.rowCount ?? 0;
}

async function upsertRows(client, table, rows, keys) {
	if (!rows.length) return 0;
	const columns = Object.keys(rows[0]);
	let affected = 0;
	for (let start = 0; start < rows.length; start += CHUNK) {
		const chunk = rows.slice(start, start + CHUNK);
		const params = [],
			tuples = chunk.map(
				(row) =>
					`(${columns
						.map((column) => {
							const value = row[column];
							params.push(JSON_COLUMNS.has(column) && value !== null ? JSON.stringify(value) : value);
							return `$${params.length}`;
						})
						.join(",")})`,
			);
		const updates = columns.filter((column) => !keys.includes(column));
		const conflict = `(${keys.join(",")})`;
		const set = updates.map((column) => `${column}=EXCLUDED.${column}`).join(",");
		const differs = updates.map((column) => `${table}.${column} IS DISTINCT FROM EXCLUDED.${column}`).join(" OR ");
		const query = `INSERT INTO ${table}(${columns.join(",")}) VALUES ${tuples.join(",")}
			ON CONFLICT ${conflict} DO ${updates.length ? `UPDATE SET ${set} WHERE ${differs}` : "NOTHING"}`;
		try {
			affected += (await client.query(query, params)).rowCount ?? 0;
		} catch (error) {
			throw new Error(
				`PostgreSQL catalog upsert failed for ${table}: ${error instanceof Error ? error.message : String(error)}`,
				{ cause: error },
			);
		}
	}
	return affected;
}

function jsonifyRow(row) {
	return Object.fromEntries(
		Object.entries(row).map(([key, value]) => {
			if (
				typeof value !== "string" ||
				value === "" ||
				![
					"category",
					"station_requirements",
					"skill_requirements",
					"trader_requirements",
					"bonuses",
					"map",
					"objectives",
					"task_requirements",
					"fail_conditions",
					"other_requirements",
					"required_prestige",
					"reward_groups",
					"required_items",
					"required_quest_items",
					"game_editions",
					"relations",
					"usage",
					"acquisition",
				].includes(key)
			)
				return [key, value];
			try {
				return [key, JSON.parse(value)];
			} catch {
				return [key, value];
			}
		}),
	);
}

export function prepareCatalogRows(mode, data) {
	validateModeData(mode, data);
	return Object.fromEntries(
		Object.entries(rowsFor("", mode, data)).map(([table, rows]) => [table, rows.map(jsonifyRow)]),
	);
}

export async function readCatalogBaseline(pool) {
	const result = await pool.query("SELECT mode, content_version FROM catalog_status ORDER BY mode");
	const current = new Map(result.rows.map((row) => [row.mode, String(row.content_version)]));
	return Object.fromEntries(MODES.map((mode) => [mode, current.get(mode) ?? "0"]));
}

/**
 * @param {import("pg").Pool} pool
 * @param {Record<string, object>} modesData
 * @param {number} now
 * @param {{ dryRun?: boolean, baseline?: Record<string, string>, discoveryDocument?: object }} options
 */
export async function applyCatalogUpdate(
	pool,
	modesData,
	now = Date.now(),
	{ dryRun = false, baseline, discoveryDocument } = {},
) {
	const modes = Object.keys(modesData);
	if (modes.length !== MODES.length || MODES.some((mode) => !modes.includes(mode))) {
		throw new Error("Catalog updates require complete regular, pve, and pvp-season input");
	}
	const verifiedDiscovery = discoveryDocument ? validateDiscoveryExport(discoveryDocument) : undefined;
	const prepared = Object.fromEntries(MODES.map((mode) => [mode, prepareCatalogRows(mode, modesData[mode])]));
	const counts = Object.fromEntries(
		MODES.map((mode) => [
			mode,
			Object.fromEntries(Object.entries(prepared[mode]).map(([table, rows]) => [table, rows.length])),
		]),
	);
	if (dryRun) {
		const newItems = {};
		const discoveryPlan = verifiedDiscovery ? await planDiscoveryReconciliation(pool, verifiedDiscovery) : undefined;
		const statuses = await pool.query("SELECT mode, discovery_initialized FROM catalog_status");
		const initialized = new Map(statuses.rows.map((row) => [row.mode, row.discovery_initialized === true]));
		const imported = new Set((discoveryPlan?.verified.rows ?? []).map((row) => `${row.mode}:${row.item_id}`));
		for (const mode of MODES) {
			const ids = prepared[mode].item_modes.map((row) => row.item_id);
			const existing = await pool.query(
				"SELECT item_id FROM item_discovery WHERE mode=$1 AND item_id=ANY($2::text[])",
				[mode, ids],
			);
			const seen = new Set(existing.rows.map((row) => row.item_id));
			newItems[mode] =
				!verifiedDiscovery && !initialized.get(mode)
					? []
					: ids.filter((id) => !seen.has(id) && !imported.has(`${mode}:${id}`));
		}
		return { changed: false, dryRun: true, counts, newItems };
	}
	const identitySpecs = [
		{
			table: "items",
			variant: "item_modes",
			key: "item_id",
			keys: [
				["name", "name"],
				["normalized_name", "normalizedName"],
				["short_name", "shortName"],
				["icon_link", "iconLink"],
				["grid_image_link", "gridImageLink"],
				["image_512px_link", "image512pxLink"],
				["base_image_link", "baseImageLink"],
				["link", "link"],
				["wiki_link", "wikiLink"],
			],
		},
		{
			table: "traders",
			variant: "trader_modes",
			key: "trader_id",
			keys: [
				["name", "name"],
				["normalized_name", "normalizedName"],
				["image_link", "imageLink"],
				["image_4x_link", "image4xLink"],
			],
		},
		{
			table: "stations",
			variant: "station_modes",
			key: "station_id",
			keys: [
				["name", "name"],
				["normalized_name", "normalizedName"],
				["image_link", "imageLink"],
			],
		},
		{
			table: "skills",
			variant: "skill_modes",
			key: "skill_id",
			keys: [
				["name", "name"],
				["image_link", "imageLink"],
			],
		},
		{
			table: "quests",
			variant: "quest_modes",
			key: "quest_id",
			keys: [
				["name", "name"],
				["normalized_name", "normalizedName"],
				["wiki_link", "wikiLink"],
				["task_image_link", "taskImageLink"],
			],
		},
	];
	const modeIdentities = Object.fromEntries(
		MODES.map((mode) => [
			mode,
			Object.fromEntries(
				identitySpecs.map((spec) => [spec.table, new Map(prepared[mode][spec.table].map((row) => [row.id, row]))]),
			),
		]),
	);
	for (const spec of identitySpecs) {
		const canonical = new Map();
		for (const mode of MODES)
			for (const row of prepared[mode][spec.table]) if (!canonical.has(row.id)) canonical.set(row.id, row);
		for (const mode of MODES) {
			const variants = prepared[mode][spec.variant];
			for (const variant of variants) {
				const local = modeIdentities[mode][spec.table].get(variant[spec.key]);
				const shared = canonical.get(variant[spec.key]);
				variant.display_override = distinctDisplay(local, shared, spec.keys);
			}
		}
		for (const mode of MODES) prepared[mode][spec.table] = [];
		prepared[MODES[0]][spec.table] = [...canonical.values()];
	}
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [LOCK_KEY]);
		const gate = await client.query(
			"SELECT mode, content_version, discovery_initialized FROM catalog_status ORDER BY mode",
		);
		const currentVersions = new Map(gate.rows.map((row) => [row.mode, String(row.content_version)]));
		if (baseline && MODES.some((mode) => (baseline[mode] ?? "0") !== (currentVersions.get(mode) ?? "0"))) {
			throw new Error(
				"Catalog changed while upstream data was being prepared; retry the update against the current content",
			);
		}
		const wasInitialized = new Map(gate.rows.map((row) => [row.mode, row.discovery_initialized === true]));
		let discoveryImportChangedModes = [];
		if (verifiedDiscovery) {
			const reconciliation = await reconcileDiscovery(client, verifiedDiscovery);
			discoveryImportChangedModes = reconciliation.changedModes;
		} else
			for (const mode of MODES)
				await client.query(
					"INSERT INTO catalog_status (mode, discovery_initialized) VALUES ($1, false) ON CONFLICT (mode) DO NOTHING",
					[mode],
				);
		let changed = discoveryImportChangedModes.length > 0;
		let sharedChanged = false;
		const changedByMode = Object.fromEntries(MODES.map((mode) => [mode, discoveryImportChangedModes.includes(mode)]));
		for (const [table, keys] of identitySpecs.map((spec) => [spec.table, ["id"]])) {
			if (await upsertRows(client, table, prepared[MODES[0]][table], keys)) {
				changed = true;
				sharedChanged = true;
			}
		}
		for (const mode of MODES) {
			const rows = prepared[mode];
			const updates = [
				["item_modes", ["item_id", "mode"]],
				["trader_modes", ["trader_id", "mode"]],
				["station_modes", ["station_id", "mode"]],
				["station_levels", ["station_id", "mode", "level"]],
				["station_item_requirements", ["station_id", "mode", "level", "requirement_id"]],
				["skill_modes", ["skill_id", "mode"]],
				["quest_modes", ["quest_id", "mode"]],
				["crafts", ["id", "mode"]],
				["barters", ["id", "mode"]],
				["item_details", ["item_id", "mode"]],
			];
			for (const [table, keys] of updates)
				if (await upsertRows(client, table, rows[table], keys)) {
					changed = true;
					changedByMode[mode] = true;
				}
			const keep = [
				["item_modes", "item_id", "item_modes"],
				["quest_modes", "quest_id", "quest_modes"],
				["trader_modes", "trader_id", "trader_modes"],
				["station_modes", "station_id", "station_modes"],
				["skill_modes", "skill_id", "skill_modes"],
				["crafts", "id", "crafts"],
				["barters", "id", "barters"],
				["item_details", "item_id", "item_details"],
			];
			for (const [table, key, source] of keep)
				if (
					await pruneIds(
						client,
						table,
						key,
						mode,
						rows[source].map((row) => row[key]),
					)
				) {
					changed = true;
					changedByMode[mode] = true;
				}
			if (await pruneKeys(client, "station_levels", ["station_id", "level"], mode, rows.station_levels)) {
				changed = true;
				changedByMode[mode] = true;
			}
			if (
				await pruneKeys(
					client,
					"station_item_requirements",
					["station_id", "level", "requirement_id"],
					mode,
					rows.station_item_requirements,
				)
			) {
				changed = true;
				changedByMode[mode] = true;
			}
			const items = rows.item_modes.map((row) => row.item_id);
			const initialized = verifiedDiscovery || wasInitialized.get(mode);
			const discovery = initialized
				? await client.query(
						`INSERT INTO item_discovery(item_id,mode,first_seen_at,first_seen_patch)
					SELECT item_id,$1,$2,NULL FROM UNNEST($3::text[]) AS item_id
					ON CONFLICT(item_id,mode) DO NOTHING`,
						[mode, now, items],
					)
				: await client.query(
						`INSERT INTO item_discovery(item_id,mode,first_seen_at,first_seen_patch,legacy_first_seen_release_id)
					SELECT item_id,$1,NULL,NULL,NULL FROM UNNEST($2::text[]) AS item_id
					ON CONFLICT(item_id,mode) DO NOTHING`,
						[mode, items],
					);
			await client.query(
				"UPDATE catalog_status SET discovery_initialized=true WHERE mode=$1 AND NOT discovery_initialized",
				[mode],
			);
			if (discovery.rowCount) {
				changed = true;
				changedByMode[mode] = true;
			}
		}
		for (const mode of MODES) {
			const modeChanged = changedByMode[mode] || sharedChanged;
			const freshness = modesData[mode].freshness ?? {};
			const status = await client.query(
				`UPDATE catalog_status SET
				content_version=content_version + CASE WHEN $2 THEN 1 ELSE 0 END,
				checked_at=$3, updated_at=CASE WHEN $2 THEN $3 ELSE updated_at END,
				source_freshness=$4::jsonb
				WHERE mode=$1`,
				[mode, modeChanged, now, json(freshness)],
			);
			if (!status.rowCount) throw new Error(`Missing catalog status row for ${mode}`);
		}
		const identityCleanup = ["items", "traders", "stations", "skills", "quests"];
		for (const table of identityCleanup)
			await client.query(
				`DELETE FROM ${table} WHERE NOT EXISTS (SELECT 1 FROM ${table === "items" ? "item_modes" : table === "traders" ? "trader_modes" : table === "stations" ? "station_modes" : table === "skills" ? "skill_modes" : "quest_modes"} m WHERE m.${table === "items" ? "item_id" : table === "traders" ? "trader_id" : table === "stations" ? "station_id" : table === "skills" ? "skill_id" : "quest_id"}=${table}.id)`,
			);
		await client.query("COMMIT");
		return { changed, dryRun: false, counts };
	} catch (error) {
		await client.query("ROLLBACK").catch(() => {});
		throw error;
	} finally {
		client.release();
	}
}
