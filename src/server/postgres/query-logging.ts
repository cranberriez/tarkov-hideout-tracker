import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";

type QueryEvent = {
	sql: string;
	startedAt: number;
	durationMs: number;
	failed: boolean;
};

/** Observe driver calls without logging bound parameters, results, or error messages. */
export function observeClientQueries(client: Pick<PoolClient, "query">, observe: (event: QueryEvent) => void): void {
	const original = client.query;
	client.query = function (this: PoolClient, ...args: unknown[]) {
		const config = args[0];
		// Preserve streaming/Submittable queries. The app uses standard text/config queries.
		if (config && typeof config === "object" && "submit" in config) return Reflect.apply(original, this, args);
		const sql = typeof config === "string" ? config : (config as { text?: string } | undefined)?.text;
		if (typeof sql !== "string") return Reflect.apply(original, this, args);
		const startedAt = Date.now();
		const start = performance.now();
		let finished = false;
		const finish = (failed: boolean) => {
			if (finished) return;
			finished = true;
			// Diagnostics must never change query success/failure.
			try {
				observe({ sql, startedAt, durationMs: performance.now() - start, failed });
			} catch {}
		};
		const wrapCallback = (callback: (...values: unknown[]) => unknown) =>
			function (this: unknown, ...values: unknown[]) {
				finish(Boolean(values[0]));
				return callback.apply(this, values);
			};
		const last = args.length - 1;
		if (typeof args[last] === "function") {
			args[last] = wrapCallback(args[last] as (...values: unknown[]) => unknown);
		} else if (config && typeof config === "object" && "callback" in config && typeof config.callback === "function") {
			args[0] = { ...config, callback: wrapCallback(config.callback as (...values: unknown[]) => unknown) };
		}
		try {
			const result = Reflect.apply(original, this, args);
			if (result && typeof result.then === "function") {
				return result.then(
					(value: unknown) => {
						finish(false);
						return value;
					},
					(error: unknown) => {
						finish(true);
						throw error;
					},
				);
			}
			return result;
		} catch (error) {
			finish(true);
			throw error;
		}
	} as PoolClient["query"];
}

/** Opt-in for local dev or a local production build; never adds database traffic. */
export function enableQueryLogging(pool: Pool): void {
	const setting = process.env.PG_QUERY_LOG;
	if (setting !== "1" && setting !== "verbose") return;
	let count = 0;
	let previousEnd = 0;
	console.info("[postgres] Query logging enabled. Bound parameters/results omitted; restart to change PG_QUERY_LOG.");
	pool.on("connect", (client) => {
		observeClientQueries(client, ({ sql, startedAt, durationMs, failed }) => {
			const quietMs = previousEnd ? Math.max(0, startedAt - previousEnd) : null;
			previousEnd = Math.max(previousEnd, startedAt + durationMs);
			const tables = [
				...new Set(
					[...sql.matchAll(/\b(?:from|join|update|into)\s+("?\w+"?(?:\."?\w+"?)?)/gi)].map((match) => match[1]),
				),
			];
			const entry = {
				at: new Date(startedAt).toISOString(),
				pid: process.pid,
				count: ++count,
				query: createHash("sha256").update(sql).digest("hex").slice(0, 10),
				operation: sql.trim().split(/\s+/, 1)[0]?.toUpperCase(),
				tables,
				durationMs: Math.round(durationMs * 10) / 10,
				quietMs: quietMs === null ? null : Math.round(quietMs),
				status: failed ? "error" : "ok",
				...(setting === "verbose" ? { sql } : {}),
			};
			console.info(`[postgres] ${JSON.stringify(entry)}`);
		});
	});
}
