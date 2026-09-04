import { NextRequest } from "next/server";
import { runPriceCron } from "@/server/prices/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET(request: NextRequest) {
    return runPriceCron(request, ["regular", "pve"]);
}
