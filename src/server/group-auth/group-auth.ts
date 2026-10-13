import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Channel signing for Mappinator groups. The desktop app talks to Apinator directly; this only signs
 * presence-channel subscriptions so the Apinator secret never leaves the server.
 */

export type GroupAuthConfig = {
	appKey: string;
	secret: string;
	cluster: string;
	/** Shared access key the app must send; empty or unset leaves the endpoint open. */
	accessKey: string | null;
};

/** Group channels only: `presence-group-` and a six character code (no 0/O/1/I/L). */
export const GROUP_CHANNEL = /^presence-group-[A-HJKMNP-Z2-9]{6}$/;
const SOCKET_ID = /^[A-Za-z0-9._-]{1,100}$/;
const USER_ID = /^[a-z0-9]{16}$/;
/** Tarkov's own name rules: 15 characters of letters, digits, `_` and `-`. */
const PLAYER_NAME = /^[A-Za-z0-9_-]{1,15}$/;

export function readGroupAuthConfig(env: Record<string, string | undefined> = process.env): GroupAuthConfig | null {
	const appKey = env.APINATOR_KEY?.trim();
	const secret = env.APINATOR_SECRET?.trim();
	const cluster = env.APINATOR_CLUSTER?.trim();
	if (!appKey || !secret || !cluster) return null;
	return { appKey, secret, cluster, accessKey: env.APINATOR_GROUP_ACCESS_KEY?.trim() || null };
}

export function accessAllowed(config: GroupAuthConfig, presented: string | null): boolean {
	if (!config.accessKey) return true;
	if (!presented) return false;
	const want = Buffer.from(config.accessKey, "utf8");
	const got = Buffer.from(presented, "utf8");
	return want.length === got.length && timingSafeEqual(want, got);
}

export type SignRequest = { socketId: unknown; channelName: unknown; userId: unknown; name: unknown };
export type SignResult = { ok: true; auth: string; channel_data: string } | { ok: false; error: string };

/** Apinator presence auth: `key:hex(hmac_sha256(secret, "socket:channel:channel_data"))`. */
export function signGroupChannel(config: GroupAuthConfig, request: SignRequest): SignResult {
	const { socketId, channelName, userId, name } = request;
	if (typeof socketId !== "string" || !SOCKET_ID.test(socketId)) return { ok: false, error: "invalid socket_id" };
	if (typeof channelName !== "string" || !GROUP_CHANNEL.test(channelName))
		return { ok: false, error: "invalid channel" };
	if (typeof userId !== "string" || !USER_ID.test(userId)) return { ok: false, error: "invalid user" };
	if (typeof name !== "string" || !PLAYER_NAME.test(name)) return { ok: false, error: "invalid name" };
	const channelData = JSON.stringify({ user_id: userId, user_info: { name } });
	const signature = createHmac("sha256", config.secret)
		.update(`${socketId}:${channelName}:${channelData}`, "utf8")
		.digest("hex");
	return { ok: true, auth: `${config.appKey}:${signature}`, channel_data: channelData };
}

/**
 * Fixed-window request counter per client. Per server instance only, so it stops a single client
 * hammering the endpoint rather than enforcing an exact global limit.
 */
export function createRateLimiter(limit: number, windowMs: number) {
	const windows = new Map<string, { start: number; count: number }>();
	return (client: string, now = Date.now()): boolean => {
		if (windows.size > 10_000) {
			for (const [key, entry] of windows) if (now - entry.start >= windowMs) windows.delete(key);
		}
		const entry = windows.get(client);
		if (!entry || now - entry.start >= windowMs) {
			windows.set(client, { start: now, count: 1 });
			return true;
		}
		entry.count += 1;
		return entry.count <= limit;
	};
}

/** Origins of the Mappinator webview: Tauri on Windows and other platforms. */
const APP_ORIGINS = new Set(["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost"]);
/** Its dev servers: 1420, and 1421-1429 for extra local instances (`npm run tauri:instance`). */
const DEV_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):142\d$/;

export function corsHeaders(origin: string | null): Record<string, string> {
	if (!origin || !(APP_ORIGINS.has(origin) || DEV_ORIGIN.test(origin))) return {};
	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, X-Group-Key, X-Group-User, X-Group-Name",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}
