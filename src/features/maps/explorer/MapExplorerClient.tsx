"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { MapExplorer } from "./MapExplorer";

// Client-only: the map measures the DOM and reads saved preferences from localStorage on first render.
const LazyMapExplorer = dynamic(() => import("./MapExplorer").then((module) => module.MapExplorer), {
	ssr: false,
	loading: () => <main className="flex flex-1 items-center justify-center bg-[#131416] text-sm text-muted-foreground">Loading map…</main>,
});

export function MapExplorerClient(props: ComponentProps<typeof MapExplorer>) {
	return <LazyMapExplorer {...props} />;
}
