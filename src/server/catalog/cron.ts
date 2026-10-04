import { NextRequest, NextResponse } from "next/server";

async function updateCatalog() {
	const { refreshCatalog } = await import("./refresh-catalog");
	return refreshCatalog();
}

export async function runCatalogCron(request: NextRequest, update = updateCatalog) {
	const secret = process.env.CRON_SECRET?.trim();
	if (!secret) {
		return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
	}
	if (request.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	try {
		const result = await update();
		return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		console.error("Scheduled catalog update failed", error);
		return NextResponse.json({ error: "Scheduled catalog update failed" }, { status: 500 });
	}
}
