import { NextRequest } from "next/server";
import { runCatalogCron } from "@/server/catalog/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET(request: NextRequest) {
	return runCatalogCron(request);
}
