const DISCOVERY_SQL = [
	// A deferred transaction containing only these fixed SELECTs is read-only.
	// Turso rejects PRAGMA query_only through its hosted SQL API.
	"BEGIN",
	"SELECT item_id, mode, first_seen_at, first_seen_patch, first_seen_release_id FROM item_catalog_history",
	"SELECT mode, baseline_release_id, initialized_at FROM catalog_tracking",
	"SELECT mode, COUNT(*) AS count FROM item_catalog_history GROUP BY mode",
	"ROLLBACK",
];

const expectedColumns = [
	["item_id", "mode", "first_seen_at", "first_seen_patch", "first_seen_release_id"],
	["mode", "baseline_release_id", "initialized_at"],
	["mode", "count"],
];

function endpointFor(databaseUrl) {
	if (typeof databaseUrl !== "string" || !databaseUrl.trim()) throw new Error("A Turso database URL is required");
	let source = databaseUrl.trim();
	if (source.startsWith("libsql://")) source = `https://${source.slice("libsql://".length)}`;
	else if (source.startsWith("turso://")) source = `https://${source.slice("turso://".length)}`;
	let parsed;
	try {
		parsed = new URL(source);
	} catch {
		throw new Error("Turso database URL is invalid");
	}
	if (
		parsed.protocol !== "https:" ||
		!parsed.hostname ||
		parsed.username ||
		parsed.password ||
		(parsed.pathname !== "/" && parsed.pathname !== "") ||
		parsed.search ||
		parsed.hash
	) {
		throw new Error("Turso database URL must be an HTTPS database base URL without credentials or extra path");
	}
	return `${parsed.origin}/v2/pipeline`;
}

function decodeValue(value, expected, nullable = false) {
	if (!value || typeof value !== "object" || typeof value.type !== "string")
		throw new Error("Malformed Turso discovery response");
	if (value.type === "null") {
		if (!nullable) throw new Error("Malformed Turso discovery response");
		return null;
	}
	if (value.type !== expected || typeof value.value !== "string") throw new Error("Malformed Turso discovery response");
	if (expected === "integer") {
		if (!/^-?(?:0|[1-9]\d*)$/.test(value.value)) throw new Error("Malformed Turso discovery integer");
		const parsed = Number(value.value);
		if (!Number.isSafeInteger(parsed)) throw new Error("Turso discovery integer is outside the safe range");
		return parsed;
	}
	return value.value;
}

function resultRows(step, columns) {
	const result = step?.response?.result;
	if (
		step?.type !== "ok" ||
		step.response?.type !== "execute" ||
		!result ||
		!Array.isArray(result.cols) ||
		!Array.isArray(result.rows)
	)
		throw new Error("Turso discovery query returned an invalid result");
	if (result.cols.length !== columns.length || result.cols.some((column, index) => column?.name !== columns[index]))
		throw new Error("Turso discovery query returned unexpected columns");
	return result.rows.map((row) => {
		if (!Array.isArray(row) || row.length !== columns.length)
			throw new Error("Turso discovery query returned a truncated row");
		return row;
	});
}

function decodeRows(rows) {
	return rows.map((row) => ({
		item_id: decodeValue(row[0], "text"),
		mode: decodeValue(row[1], "text"),
		first_seen_at: decodeValue(row[2], "integer", true),
		first_seen_patch: decodeValue(row[3], "text", true),
		first_seen_release_id: decodeValue(row[4], "text", true),
	}));
}

function decodeTracking(rows) {
	return rows.map((row) => ({
		mode: decodeValue(row[0], "text"),
		baseline_release_id: decodeValue(row[1], "text"),
		initialized_at: decodeValue(row[2], "integer"),
	}));
}

/** Read the legacy discovery ledger over Turso SQL-over-HTTP without writing. */
export async function readTursoDiscovery({ url, authToken, fetchImpl = fetch } = {}) {
	const endpoint = endpointFor(url);
	if (typeof authToken !== "string" || !authToken.trim()) throw new Error("A Turso authentication token is required");
	if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
	const requests = [...DISCOVERY_SQL.map((sql) => ({ type: "execute", stmt: { sql } })), { type: "close" }];
	let response;
	try {
		response = await fetchImpl(endpoint, {
			method: "POST",
			redirect: "error",
			signal: AbortSignal.timeout(20_000),
			headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
			body: JSON.stringify({ requests }),
		});
	} catch {
		throw new Error("Turso discovery HTTP request failed or timed out");
	}
	if (!response?.ok)
		throw new Error(
			`Turso discovery HTTP request failed (status ${Number.isInteger(response?.status) ? response.status : "unknown"})`,
		);
	let body;
	try {
		body = await response.json();
	} catch {
		throw new Error("Turso discovery response was not valid JSON");
	}
	if (!body || !Array.isArray(body.results) || body.results.length !== requests.length)
		throw new Error("Turso discovery response had missing or extra pipeline steps");
	for (let index = 0; index < body.results.length; index++) {
		const step = body.results[index];
		if (step?.type !== "ok") {
			const operation = [
				"begin snapshot",
				"read item_catalog_history",
				"read catalog_tracking",
				"verify counts",
				"end snapshot",
				"close connection",
			][index];
			const code =
				typeof step?.error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(step.error.code)
					? ` [${step.error.code}]`
					: "";
			throw new Error(`Turso discovery pipeline step ${index + 1} (${operation}) failed${code}`);
		}
		if (index === requests.length - 1 && step.response?.type !== "close")
			throw new Error("Turso discovery connection did not close cleanly");
	}
	for (const index of [0, 4]) resultRows(body.results[index], []);
	const itemRows = resultRows(body.results[1], expectedColumns[0]);
	const trackingRows = resultRows(body.results[2], expectedColumns[1]);
	const countRows = resultRows(body.results[3], expectedColumns[2]);
	const rows = decodeRows(itemRows);
	const tracking = decodeTracking(trackingRows);
	const counts = new Map(countRows.map((row) => [decodeValue(row[0], "text"), decodeValue(row[1], "integer")]));
	if (counts.size !== countRows.length) throw new Error("Turso discovery counts contain duplicate modes");
	const actualCounts = new Map();
	for (const row of rows) actualCounts.set(row.mode, (actualCounts.get(row.mode) ?? 0) + 1);
	if (counts.size !== actualCounts.size || [...actualCounts].some(([mode, count]) => counts.get(mode) !== count))
		throw new Error("Turso discovery row counts did not match the grouped count query");
	return { rows, tracking };
}
