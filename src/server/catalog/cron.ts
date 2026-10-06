import { NextRequest, NextResponse } from "next/server";

async function updateCatalog() {
	const { refreshCatalog } = await import("./refresh-catalog");
	return refreshCatalog();
}

async function invalidateCatalog() {
	const { invalidateCatalogVersion } = await import("../db/postgres-read");
	await invalidateCatalogVersion();
}

export async function runCatalogCron(request: NextRequest, update = updateCatalog, invalidate = invalidateCatalog) {
	const secret = process.env.CRON_SECRET?.trim();
	if (!secret) {
		return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
	}
	if (request.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	try {
		const result = await update();
		// Version-keyed caches only need the current version identity to move forward.
		if (result.changed) await invalidate();
		return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		console.error("Scheduled catalog update failed", error);
		return NextResponse.json({ error: "Scheduled catalog update failed" }, { status: 500 });
	}
}
