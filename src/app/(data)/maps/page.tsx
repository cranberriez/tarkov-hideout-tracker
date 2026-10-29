import type { Metadata } from "next";
import { MapsIndex } from "@/features/maps/explorer/MapsIndex";
import { DEFAULT_MAP_VISIBILITY_PRESET, parseMapVisibilityPreset } from "@/lib/cfg/map-explorer";

export const metadata: Metadata = {
	title: "Maps",
	description: "Interactive Escape from Tarkov maps with extracts, spawns, bosses, loot, keys and Battle Pass documents.",
	alternates: { canonical: "/maps" },
};

export default async function MapsPage({ searchParams }: { searchParams: Promise<{ preset?: string | string[] }> }) {
	const { preset } = await searchParams;
	const selected = parseMapVisibilityPreset(Array.isArray(preset) ? preset[0] : preset) ?? DEFAULT_MAP_VISIBILITY_PRESET;
	return <MapsIndex preset={selected} />;
}
