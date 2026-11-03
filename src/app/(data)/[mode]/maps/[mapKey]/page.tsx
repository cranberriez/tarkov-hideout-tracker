import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapExplorerClient } from "@/features/maps/explorer/MapExplorerClient";
import { isMapExplorerMapKey, MAP_EXPLORER_MAPS } from "@/lib/cfg/map-explorer";

interface MapPageProps {
	params: Promise<{ mode: string; mapKey: string }>;
}

export function generateStaticParams() {
	return MAP_EXPLORER_MAPS.map((map) => ({ mapKey: map.key }));
}

export async function generateMetadata({ params }: MapPageProps): Promise<Metadata> {
	const { mapKey } = await params;
	const map = MAP_EXPLORER_MAPS.find((candidate) => candidate.key === mapKey);
	if (!map) return {};
	return {
		title: `${map.name} Map`,
		description: `Interactive ${map.name} map for Escape from Tarkov: extracts, spawns, bosses, loot, keys and Battle Pass documents by floor.`,
	};
}

/** Static per mode and map; `?preset=` is applied in the browser. */
export default async function MapPage({ params }: MapPageProps) {
	const { mapKey } = await params;
	if (!isMapExplorerMapKey(mapKey)) notFound();
	return <MapExplorerClient key={mapKey} mapKey={mapKey} />;
}
