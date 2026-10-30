import type { Metadata } from "next";
import { Suspense } from "react";
import { MapsIndex } from "@/features/maps/explorer/MapsIndex";
import { MapsIndexRoute } from "@/features/maps/explorer/MapsIndexRoute";
import { DEFAULT_MAP_VISIBILITY_PRESET } from "@/lib/cfg/map-explorer";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Maps",
		description: "Interactive Escape from Tarkov maps with extracts, spawns, bosses, loot, keys and Battle Pass documents.",
		alternates: modeCanonical(gameMode, "/maps"),
	};
}

/** Static per mode; the `?preset=` selection is applied in the browser. */
export default async function MapsPage({ params }: { params: ModeRouteParams }) {
	const { gameMode } = await readRouteGameMode(params);
	return (
		<Suspense fallback={<MapsIndex mode={gameMode} preset={DEFAULT_MAP_VISIBILITY_PRESET} />}>
			<MapsIndexRoute mode={gameMode} />
		</Suspense>
	);
}
