import { NextResponse } from "next/server";
import { getHideoutStations } from "@/app/server/services/hideout";

export async function GET() {
    try {
        const stations = await getHideoutStations();
        return NextResponse.json({
            data: { stations },
            updatedAt: Date.now(),
        });
    } catch (error) {
        console.error("/api/hideout/stations unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
