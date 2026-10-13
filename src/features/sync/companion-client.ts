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
const base = (port: number) => `http://127.0.0.1:${port}`;

async function call<T>(
	port: number,
	method: string,
	path: string,
	token?: string,
	special?: (body: unknown, status: number) => ClientResult<T> | null,
): Promise<ClientResult<T>> {
	let response: Response;
	try {
		response = await fetch(`${base(port)}${path}`, {
			method,
			headers: token ? { Authorization: `Bearer ${token}` } : undefined,
			signal: AbortSignal.timeout(TIMEOUT_MS),
			cache: "no-store",
		});
	} catch {
		return { kind: "unreachable" };
	}
	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		body = null;
	}
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

export function unpair(port: number, token: string): Promise<ClientResult<null>> {
	return call<null>(port, "DELETE", "/v1/pair", token);
}
