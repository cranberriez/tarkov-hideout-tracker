// Long-running observer for trader restock (resetTime) cadence.
// Polls only around known reset times, records every change to a JSON log so a
// crash/restart resumes with full history.
//
// Usage: node scripts/track-trader-resets.mjs [--mode pvp-season] [--out trader-reset-log.json]
//        [--grace 2] [--retry 5] [--max-wait 60] [--once]   (durations in minutes)
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const TARKOV_JSON_BASE_URL = "https://json.tarkov.dev";
const USER_AGENT = "TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)";
const MIN_WAIT_MS = 60_000;
const MINUTE_MS = 60_000;

const { values: args } = parseArgs({
	options: {
		mode: { type: "string", default: "pvp-season" },
		out: { type: "string", default: "trader-reset-log.json" },
		grace: { type: "string", default: "2" },
		retry: { type: "string", default: "5" },
		"max-wait": { type: "string", default: "60" },
		once: { type: "boolean", default: false },
	},
});

const url = `${TARKOV_JSON_BASE_URL}/${args.mode}/traders`;
const outPath = resolve(args.out);
const graceMs = Number(args.grace) * MINUTE_MS;
const retryMs = Number(args.retry) * MINUTE_MS;
const maxWaitMs = Number(args["max-wait"]) * MINUTE_MS;

function formatDuration(ms) {
	const sign = ms < 0 ? "-" : "";
	let s = Math.round(Math.abs(ms) / 1000);
	const h = Math.floor(s / 3600);
	s -= h * 3600;
	const m = Math.floor(s / 60);
	s -= m * 60;
	return `${sign}${h ? `${h}h` : ""}${h || m ? `${String(m).padStart(h ? 2 : 1, "0")}m` : ""}${String(s).padStart(h || m ? 2 : 1, "0")}s`;
}

function formatTime(iso) {
	return iso ? new Date(iso).toLocaleTimeString() : "-";
}

async function loadState() {
	try {
		const state = JSON.parse(await readFile(outPath, "utf8"));
		if (state.url !== url) throw new Error(`${outPath} was recorded for ${state.url}, not ${url}. Use --out.`);
		return state;
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		return { version: 1, url, etag: null, polls: [], traders: {} };
	}
}

async function saveState(state) {
	const tmp = `${outPath}.tmp`;
	await writeFile(tmp, `${JSON.stringify(state, null, "\t")}\n`);
	await rename(tmp, outPath);
}

async function fetchTraders(etag) {
	const headers = { "User-Agent": USER_AGENT };
	if (etag) headers["If-None-Match"] = etag;
	const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
	const meta = {
		status: response.status,
		etag: response.headers.get("etag"),
		lastModified: response.headers.get("last-modified"),
	};
	if (response.status === 304) return { ...meta, traders: null };
	if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
	const body = await response.json();
	const traders = Object.values(body?.data ?? {}).filter(
		(t) => t && typeof t.id === "string" && typeof t.resetTime === "string" && !Number.isNaN(Date.parse(t.resetTime)),
	);
	if (traders.length === 0) throw new Error("Response contained no traders with a valid resetTime");
	return { ...meta, traders };
}

function applySnapshot(state, traders, fetchedAt, dataAsOf) {
	const changes = [];
	for (const trader of traders) {
		const name = trader.normalizedName || trader.id;
		const known = state.traders[trader.id];
		if (!known) {
			state.traders[trader.id] = { name, resetTime: trader.resetTime, firstSeenAt: fetchedAt, history: [] };
			continue;
		}
		if (known.resetTime === trader.resetTime) continue;

		const previous = Date.parse(known.resetTime);
		const next = Date.parse(trader.resetTime);
		const dataAsOfMs = dataAsOf ? Date.parse(dataAsOf) : Date.parse(fetchedAt);
		const entry = {
			previousResetTime: known.resetTime,
			resetTime: trader.resetTime,
			cycleMs: next - previous,
			cycle: formatDuration(next - previous),
			detectedAt: fetchedAt,
			dataAsOf,
			// How long after the old reset the snapshot carried the new value (includes snapshot lag).
			publishedAfterResetMs: dataAsOfMs - previous,
			// True when the time moved before the old reset was reached, i.e. a schedule shift rather than a restock.
			changedBeforeReset: dataAsOfMs < previous,
		};
		known.history.push(entry);
		known.resetTime = trader.resetTime;
		changes.push({ name, ...entry });
	}
	return changes;
}

function printChanges(changes) {
	for (const c of changes) {
		const note = c.changedBeforeReset ? "  ** changed BEFORE old reset (shift?)" : "";
		console.log(
			`  ${c.name.padEnd(14)} ${formatTime(c.previousResetTime)} -> ${formatTime(c.resetTime)}  cycle ${c.cycle.padStart(9)}  published +${formatDuration(c.publishedAfterResetMs)}${note}`,
		);
	}
}

function printTable(state, now) {
	const rows = Object.values(state.traders).sort((a, b) => Date.parse(a.resetTime) - Date.parse(b.resetTime));
	console.log(`  ${"trader".padEnd(14)} ${"resets at".padEnd(12)} ${"in".padStart(9)}  ${"last cycle".padStart(10)}  cycles seen`);
	for (const t of rows) {
		const last = t.history.at(-1);
		const until = Date.parse(t.resetTime) - now;
		const pending = until <= 0 ? "  (awaiting new time)" : "";
		console.log(
			`  ${t.name.padEnd(14)} ${formatTime(t.resetTime).padEnd(12)} ${formatDuration(until).padStart(9)}  ${(last?.cycle ?? "-").padStart(10)}  ${t.history.length}${pending}`,
		);
	}
}

function nextWaitMs(state, now) {
	const resets = Object.values(state.traders).map((t) => Date.parse(t.resetTime));
	// A passed reset whose new time hasn't been published yet: retry on the slower cadence.
	if (resets.some((r) => r <= now)) return Math.min(retryMs, maxWaitMs);
	const soonest = Math.min(...resets);
	return Math.max(MIN_WAIT_MS, Math.min(soonest + graceMs - now, maxWaitMs));
}

async function poll(state) {
	const fetchedAt = new Date().toISOString();
	try {
		const result = await fetchTraders(state.etag);
		const dataAsOf = result.lastModified ? new Date(result.lastModified).toISOString() : null;
		state.polls.push({ fetchedAt, status: result.status, dataAsOf });
		console.log(`\n[${new Date(fetchedAt).toLocaleString()}] HTTP ${result.status}, data as of ${formatTime(dataAsOf)}`);
		if (result.traders) {
			state.etag = result.etag;
			const changes = applySnapshot(state, result.traders, fetchedAt, dataAsOf);
			if (changes.length) {
				console.log("Changes:");
				printChanges(changes);
			}
		}
	} catch (error) {
		state.polls.push({ fetchedAt, error: String(error?.message ?? error) });
		console.error(`\n[${new Date(fetchedAt).toLocaleString()}] Poll failed: ${error?.message ?? error}`);
	}
	await saveState(state);
}

async function main() {
	const state = await loadState();
	console.log(`Tracking ${url}\nLog: ${outPath}`);
	for (;;) {
		await poll(state);
		const now = Date.now();
		if (Object.keys(state.traders).length) printTable(state, now);
		if (args.once) return;
		const wait = Object.keys(state.traders).length ? nextWaitMs(state, now) : retryMs;
		console.log(`Next check in ${formatDuration(wait)} (${new Date(now + wait).toLocaleTimeString()})`);
		await new Promise((r) => setTimeout(r, wait));
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
