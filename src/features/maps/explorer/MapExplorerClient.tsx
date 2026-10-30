"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type { MapExplorerMapKey } from "@/lib/cfg/map-explorer";
import { parseMapVisibilityPreset } from "@/lib/cfg/map-explorer";

// Client-only: the map measures the DOM and reads saved preferences from localStorage on first render.
// `?preset=` is read here, in the browser, so the route stays a cached static page.
const LazyMapExplorer = dynamic(
	() =>
		import("./MapExplorer").then(({ MapExplorer }) => {
			function RoutedMapExplorer({ mapKey }: { mapKey: MapExplorerMapKey }) {
				const initialPreset = parseMapVisibilityPreset(useSearchParams().get("preset"));
				return <MapExplorer mapKey={mapKey} initialPreset={initialPreset} />;
			}
			return RoutedMapExplorer;
		}),
	{
		ssr: false,
		loading: () => <main className="flex flex-1 items-center justify-center bg-[#131416] text-sm text-muted-foreground">Loading map…</main>,
	},
);

export function MapExplorerClient({ mapKey }: { mapKey: MapExplorerMapKey }) {
	return <LazyMapExplorer mapKey={mapKey} />;
}
