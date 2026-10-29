import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapExplorerClient } from "@/features/maps/explorer/MapExplorerClient";
import { isMapExplorerMapKey, MAP_EXPLORER_MAPS, parseMapVisibilityPreset } from "@/lib/cfg/map-explorer";

interface MapPageProps {
	params: Promise<{ mapKey: string }>;
	searchParams: Promise<{ preset?: string | string[] }>;
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

export default async function MapPage({ params, searchParams }: MapPageProps) {
	const [{ mapKey }, { preset }] = await Promise.all([params, searchParams]);
	if (!isMapExplorerMapKey(mapKey)) notFound();
	const initialPreset = parseMapVisibilityPreset(Array.isArray(preset) ? preset[0] : preset);
	return <MapExplorerClient key={mapKey} mapKey={mapKey} initialPreset={initialPreset} />;
}
