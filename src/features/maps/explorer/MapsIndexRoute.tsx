"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_MAP_VISIBILITY_PRESET, parseMapVisibilityPreset } from "@/lib/cfg/map-explorer";
import type { GameMode } from "@/lib/game-mode";
import { MapsIndex } from "./MapsIndex";

/** Reads `?preset=` in the browser so the maps index stays a cached static page. */
export function MapsIndexRoute({ mode }: { mode: GameMode }) {
	const preset = parseMapVisibilityPreset(useSearchParams().get("preset")) ?? DEFAULT_MAP_VISIBILITY_PRESET;
	return <MapsIndex mode={mode} preset={preset} />;
}
