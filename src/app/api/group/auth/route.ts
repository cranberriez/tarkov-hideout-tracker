import { NextRequest, NextResponse } from "next/server";
import { isSyncEnabled } from "@/server/sync-enabled";
import {
	accessAllowed,
	corsHeaders,
	createRateLimiter,
	readGroupAuthConfig,
	signGroupChannel,
} from "@/server/group-auth/group-auth";

/**
 * Mappinator group auth. GET checks the access key and returns the public Apinator app key and cluster;
 * POST signs one presence-channel subscription (the Apinator client's `authEndpoint`).
 */

export const dynamic = "force-dynamic";

const allow = createRateLimiter(60, 60_000);

function clientOf(request: NextRequest): string {
	return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function reply(request: NextRequest, body: unknown, status = 200) {
	return NextResponse.json(body, {
		status,
		headers: { ...corsHeaders(request.headers.get("origin")), "Cache-Control": "no-store" },
	});
}

/** Shared checks; a response when the request can't go on. */
function gate(request: NextRequest) {
	if (!isSyncEnabled()) return { response: reply(request, { error: "not-found" }, 404) };
	if (!allow(clientOf(request))) return { response: reply(request, { error: "rate-limited" }, 429) };
	const config = readGroupAuthConfig();
	if (!config) return { response: reply(request, { error: "unavailable" }, 503) };
	if (!accessAllowed(config, request.headers.get("x-group-key"))) {
		return { response: reply(request, { error: "access-key" }, 401) };
	}
	return { config };
}

export function OPTIONS(request: NextRequest) {
	if (!isSyncEnabled()) return reply(request, { error: "not-found" }, 404);
	return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export function GET(request: NextRequest) {
	const { response, config } = gate(request);
	if (response) return response;
	return reply(request, { appKey: config.appKey, cluster: config.cluster });
}

export async function POST(request: NextRequest) {
	const { response, config } = gate(request);
	if (response) return response;
	let body: { socket_id?: unknown; channel_name?: unknown };
	try {
		body = await request.json();
	} catch {
		return reply(request, { error: "invalid body" }, 400);
	}
	const signed = signGroupChannel(config, {
		socketId: body?.socket_id,
		channelName: body?.channel_name,
		userId: request.headers.get("x-group-user"),
		name: request.headers.get("x-group-name"),
	});
	if (!signed.ok) return reply(request, { error: signed.error }, 400);
	return reply(request, { auth: signed.auth, channel_data: signed.channel_data });
}
