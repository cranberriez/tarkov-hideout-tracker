import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";
import {
	COMPANION_APP_ID,
	COMPANION_PORTS,
	type PairRequested,
	type PairingState,
	type StatusResponse,
	type SyncResponse,
} from "./companion-contract";

/** The browser sets Origin itself; the companion allow-lists it. */
export type ClientResult<T> =
	| { kind: "ok"; data: T }
	/** Network failure, timeout, or blocked by the browser (local network access). */
	| { kind: "unreachable" }
	| { kind: "unauthorized" }
	| { kind: "bad_cursor" }
	| { kind: "error"; status: number };

const TIMEOUT_MS = 3000;
const BODY_LIMIT = 4096;

/** Raw-view body: pretty JSON with secrets redacted, truncated. */
function formatBody(body: unknown): string {
	if (body === null || body === undefined) return "";
	let text: string;
	try {
		text = JSON.stringify(body, (key, value) => (key === "token" && typeof value === "string" ? "***" : value), 2) ?? "";
	} catch {
		return "";
	}
	return text.length > BODY_LIMIT ? `${text.slice(0, BODY_LIMIT)}\n… (truncated)` : text;
}

/** Keeps only the route and `since`, so nothing sensitive reaches the raw view. */
function recordablePath(path: string): string {
	const [route, query] = path.split("?");
	const since = new URLSearchParams(query ?? "").get("since");
	return since === null ? route : `${route}?since=${since}`;
}

function describeExchange(method: string, path: string, status: number | "network error", body: unknown): string {
	if (status === "network error") return "unreachable";
	if (status === 401) return "unauthorized";
	const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
	if (typeof record.error === "string") return record.error;
	if (path.startsWith("/v1/sync") && Array.isArray(record.events)) {
		const since = new URLSearchParams(path.split("?")[1] ?? "").get("since");
		const count = record.events.length;
		return `${count} ${count === 1 ? "event" : "events"}, seq ${since}→${String(record.seq)}`;
	}
	if (path === "/v1/status") return record.paired === true ? "paired" : "not paired";
	if (path.startsWith("/v1/pair/")) return typeof record.state === "string" ? `pairing ${record.state}` : "pairing";
	if (path === "/v1/pair") return method === "POST" ? "pairing requested" : "unpaired";
	return String(status);
}
const base = (port: number) => `http://127.0.0.1:${port}`;

async function call<T>(
	port: number,
	method: string,
	path: string,
	token?: string,
	special?: (body: unknown, status: number) => ClientResult<T> | null,
): Promise<ClientResult<T>> {
	const startedAt = Date.now();
	const record = (status: number | "network error", body: unknown) =>
		useCompanionSyncStore.getState().recordExchange({
			at: startedAt,
			method,
			path: recordablePath(path),
			status,
			ms: Date.now() - startedAt,
			summary: describeExchange(method, path, status, body),
			body: formatBody(body),
		});
	let response: Response;
	try {
		response = await fetch(`${base(port)}${path}`, {
			method,
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
			signal: AbortSignal.timeout(TIMEOUT_MS),
			cache: "no-store",
		});
	} catch {
		record("network error", null);
		return { kind: "unreachable" };
	}
	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		body = null;
	}
	record(response.status, body);
	if (response.status === 401) return { kind: "unauthorized" };
	const custom = special?.(body, response.status) ?? null;
	if (custom) return custom;
	if (!response.ok) return { kind: "error", status: response.status };
	return { kind: "ok", data: body as T };
}

/** Probe the preferred port, then the documented range; the first responding Mappinator wins. */
export async function findCompanion(
	preferredPort?: number | null,
): Promise<{ port: number; status: StatusResponse } | null> {
	const ports = [...new Set([preferredPort ?? undefined, ...COMPANION_PORTS])].filter(
		(port): port is number => typeof port === "number",
	);
	for (const port of ports) {
		const result = await call<StatusResponse>(port, "GET", "/v1/status");
		if (result.kind === "ok" && result.data?.app === COMPANION_APP_ID) return { port, status: result.data };
	}
	return null;
}

export function requestPairing(port: number): Promise<ClientResult<PairRequested>> {
	return call<PairRequested>(port, "POST", "/v1/pair");
}

export function pairingState(port: number, id: string): Promise<ClientResult<PairingState>> {
	return call<PairingState>(port, "GET", `/v1/pair/${encodeURIComponent(id)}`);
}

export function sync(port: number, token: string, since: number): Promise<ClientResult<SyncResponse>> {
	return call<SyncResponse>(port, "GET", `/v1/sync?since=${since}`, token, (body, status) =>
		status === 400 && (body as { error?: string } | null)?.error === "bad_cursor" ? { kind: "bad_cursor" } : null,
	);
}

export function getStatus(port: number, token: string): Promise<ClientResult<StatusResponse>> {
	return call<StatusResponse>(port, "GET", "/v1/status", token);
}

export function unpair(port: number, token: string): Promise<ClientResult<null>> {
	return call<null>(port, "DELETE", "/v1/pair", token);
}
