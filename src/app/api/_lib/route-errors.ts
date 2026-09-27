import { NextResponse } from "next/server";
import {
	DatabaseConfigurationError,
	DatabaseRecordNotFoundError,
	DatabaseTransientReadError,
} from "@/server/db/errors";
import { CacheControl } from "@/app/api/_lib/cache-control";

export function itemDatabaseErrorResponse(error: unknown, unavailableMessage: string) {
	const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
	if (
		error instanceof DatabaseTransientReadError ||
		code.startsWith("08") ||
		["57P01", "57P02", "57P03", "53300", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH"].includes(code)
	) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : unavailableMessage },
			{ status: 503, headers: { "Cache-Control": CacheControl.privateNoStore } },
		);
	}
	if (error instanceof DatabaseRecordNotFoundError) {
		return NextResponse.json(
			{ error: "Item data was not found" },
			{ status: 404, headers: { "Cache-Control": CacheControl.privateNoStore } },
		);
	}

	console.error(unavailableMessage, error);
	return NextResponse.json(
		{ error: unavailableMessage },
		{
			status: error instanceof DatabaseConfigurationError ? 503 : 502,
			headers: { "Cache-Control": CacheControl.privateNoStore },
		},
	);
}
