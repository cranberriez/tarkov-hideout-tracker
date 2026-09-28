export type LogFormat = "json" | "pretty";
type Level = "INFO" | "WARN" | "ERROR";
type Fields = Record<string, unknown>;

export interface LogRecord extends Fields {
	at: string;
	event: string;
}

interface PrettyEntry {
	level: Level;
	mode?: string;
	message: string;
	/** Extra indented lines, used for errors and warnings. */
	details?: string[];
}

const HOUR = 60 * 60 * 1000;

function number(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function text(value: unknown): string {
	return value === undefined || value === null ? "" : String(value);
}

export function formatDuration(ms: unknown): string {
	const value = number(ms);
	if (value < 1000) return `${Math.round(value)}ms`;
	if (value < 60_000) return `${(value / 1000).toFixed(1)}s`;
	if (value < HOUR)
		return `${Math.floor(value / 60_000)}m ${String(Math.round((value % 60_000) / 1000)).padStart(2, "0")}s`;
	return `${Math.floor(value / HOUR)}h ${String(Math.round((value % HOUR) / 60_000)).padStart(2, "0")}m`;
}

function interval(ms: unknown): string {
	const value = number(ms);
	return value % HOUR === 0 ? `${value / HOUR}h` : `${Math.round(value / 60_000)}m`;
}

function time(value: unknown): string {
	if (value === null || value === undefined) return "never";
	const date = new Date(typeof value === "number" ? value : String(value));
	return Number.isNaN(date.getTime()) ? text(value) : date.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

function count(value: unknown, label: string): string {
	return `${number(value).toLocaleString("en-US")} ${label}`;
}

function tally(value: unknown, labels: Record<string, string>): string {
	const counts = (value ?? {}) as Record<string, number>;
	return Object.entries(labels)
		.filter(([key]) => counts[key])
		.map(([key, label]) => `${label} ${counts[key].toLocaleString("en-US")}`)
		.join(" ");
}

function errorDetails(error: unknown): string[] {
	return text(error)
		.split(" <- caused by: ")
		.map((part, index) => (index === 0 ? part : `caused by: ${part}`));
}

function describe(record: LogRecord): PrettyEntry {
	const f = record;
	const mode = f.mode === undefined ? undefined : text(f.mode);
	switch (record.event) {
		case "worker-started": {
			const schedules = (f.schedules ?? {}) as Record<string, { pollMs: number; analysisMs: number }>;
			const season = schedules["pvp-season"];
			const mature = schedules.regular;
			return {
				level: "INFO",
				message: [
					`worker started · modes ${(f.modes as string[]).join(", ")} · state ${text(f.stateDirectory)}`,
					season && mature
						? `poll ${interval(season.pollMs)} seasonal / ${interval(mature.pollMs)} other · push ${interval(f.flushMs)} · analysis ${interval(season.analysisMs)} / ${interval(mature.analysisMs)}`
						: "",
				]
					.filter(Boolean)
					.join(" · "),
			};
		}
		case "database-ok":
			return { level: "INFO", message: `database reachable · ${text(f.target)}` };
		case "database-unreachable":
			return {
				level: "ERROR",
				message: `database unreachable · ${text(f.target)}`,
				details: [...errorDetails(f.error), ...(f.hint ? [`hint: ${text(f.hint)}`] : [])],
			};
		case "eligible-refreshed":
			return { level: "INFO", mode, message: `eligible items refreshed · ${count(f.count, "items")}` };
		case "poll":
			return {
				level: number(f.failed) > 0 ? "WARN" : "INFO",
				mode,
				message: [
					"poll",
					count(f.checked, "checked"),
					count(f.updated, "changed"),
					count(f.notModified, "unchanged"),
					count(f.failed, "failed"),
					count(f.excluded, "newly excluded"),
					formatDuration(f.durationMs),
				].join(" · "),
			};
		case "flush": {
			if (f.status === "idle") return { level: "INFO", mode, message: "push skipped · nothing changed" };
			if (f.status === "locked")
				return { level: "WARN", mode, message: "push deferred · another refresh holds the lease; retrying next push" };
			const catalog =
				f.catalogPriceStatus === "updated"
					? "catalog prices updated"
					: f.catalogPriceStatus === "failed"
						? "catalog prices FAILED"
						: "";
			const superseded = number(f.supersededCount) ? count(f.supersededCount, "superseded") : "";
			return {
				level: f.status === "succeeded" ? "INFO" : "WARN",
				mode,
				message: [
					`push ${text(f.status)}`,
					count(f.changedCount, "prices written"),
					count(f.failedCount, "failures recorded"),
					superseded,
					catalog,
					`${count(f.checkedCount, "checks")} since last push`,
					formatDuration(f.durationMs),
				]
					.filter(Boolean)
					.join(" · "),
				details: f.catalogPriceError ? [`catalog: ${text(f.catalogPriceError)}`] : undefined,
			};
		}
		case "flush-failed":
			return { level: "ERROR", mode, message: "push failed · changes stay buffered", details: errorDetails(f.error) };
		case "analysis-baseline":
			return {
				level: "INFO",
				mode,
				message: `analysis progress restored from database · ${count(f.restoredItems, "items")} · last run ${time(f.lastAnalysisAt)}`,
			};
		case "analysis": {
			const failed = (f.failed ?? []) as { itemId: string; error: string }[];
			return {
				level: f.status === "succeeded" ? "INFO" : "WARN",
				mode,
				message: [
					`analysis ${text(f.status)}`,
					count(f.analyzedCount, "observations"),
					count(f.unchangedCount, "unchanged"),
					count(f.missingCount, "uncached"),
					`trend ${tally(f.trend, { rising: "↑", falling: "↓", stable: "→", unknown: "?" }) || "-"}`,
					`confidence ${tally(f.confidence, { high: "high", medium: "med", low: "low" }) || "-"}`,
					formatDuration(number(f.completedAt) - number(f.startedAt)),
				].join(" · "),
				details: failed.map((failure) => `${failure.itemId}: ${failure.error}`),
			};
		}
		case "exclusions-cleared":
			return { level: "INFO", mode, message: `exclusions cleared · ${count(f.count, "items")} rechecked next poll` };
		case "recheck-requested":
			return { level: "INFO", message: `recheck of excluded items requested · ${(f.modes as string[]).join(", ")}` };
		case "mode-error":
			return {
				level: "ERROR",
				mode,
				message: `step failed · retrying in ${formatDuration(number(f.retryInSeconds) * 1000)}`,
				details: errorDetails(f.error),
			};
		case "mode-recovered":
			return { level: "INFO", mode, message: `recovered · failing since ${time(f.failingSince)}` };
		case "state-directory-locked": {
			const holder = (f.holder ?? {}) as Fields;
			return {
				level: "ERROR",
				message: `state directory ${text(f.stateDirectory)} is in use by another worker`,
				details: [
					`holder: host ${text(holder.hostname)}, pid ${text(holder.pid)}, last seen ${time(holder.heartbeatAt)}`,
					`hint: ${text(f.hint)}`,
				],
			};
		}
		case "state-directory-lost":
			return {
				level: "ERROR",
				message: "state directory taken over by another worker · stopping",
				details: [text(f.hint)],
			};
		case "stop-requested":
			return { level: "INFO", message: `stop requested (${text(f.signal)}) · finishing current step` };
		case "worker-stopped":
			return { level: "INFO", message: "worker stopped" };
		case "fatal":
			return {
				level: "ERROR",
				message: "fatal error · exiting",
				details: [
					...errorDetails(f.error),
					...text(f.stack)
						.split("\n")
						.slice(1)
						.map((line) => line.trim()),
				].filter(Boolean),
			};
		default: {
			const rest = Object.entries(f)
				.filter(([key]) => key !== "at" && key !== "event" && key !== "mode")
				.map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : text(value)}`);
			return { level: "INFO", mode, message: [record.event, ...rest].join(" ") };
		}
	}
}

const COLORS: Record<Level, string> = { INFO: "\x1b[32m", WARN: "\x1b[33m", ERROR: "\x1b[31m" };
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/** One readable line per event; errors and warnings add indented detail lines. */
export function formatPretty(record: LogRecord, color = false): string {
	const entry = describe(record);
	const paint = (code: string, value: string) => (color ? `${code}${value}${RESET}` : value);
	const stamp = paint(DIM, record.at.slice(0, 19).replace("T", " "));
	const level = paint(COLORS[entry.level], entry.level.padEnd(5));
	const mode = entry.mode ? `${paint("\x1b[36m", `[${entry.mode}]`.padEnd(12))} ` : "";
	const lines = [`${stamp} ${level} ${mode}${entry.message}`];
	for (const detail of entry.details ?? []) lines.push(paint(DIM, `    ↳ ${detail}`));
	return lines.join("\n");
}

let format: LogFormat = "json";

export function parseLogFormat(value: string | undefined): LogFormat {
	const normalized = value?.trim().toLowerCase() || "json";
	if (normalized !== "json" && normalized !== "pretty") throw new Error("MARKET_LOG_FORMAT must be json or pretty");
	return normalized;
}

export function setLogFormat(value: LogFormat) {
	format = value;
}

export function log(event: string, fields: Fields = {}) {
	const record: LogRecord = { at: new Date().toISOString(), event, ...fields };
	const output = format === "pretty" ? formatPretty(record, Boolean(process.stdout.isTTY)) : JSON.stringify(record);
	console.log(output);
}
