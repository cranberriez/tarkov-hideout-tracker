"use client";

import { useCallback, useMemo } from "react";
import type { GameMode } from "@/lib/game-mode";
import { useStoredProfitValue } from "../profit-pages/useStoredProfitValue";
import { parseStoryProgress, serializeStoryProgress, type StoryProgress } from "./story-progress";

/** Story progress for the active profile, in its own mode-scoped key (`PVP`, `PVE`, `KORD`). */
export function useStoryProgress(gameMode: GameMode) {
	const [raw, write] = useStoredProfitValue(`tarkov-story-progress-v1:${gameMode}`);
	const progress = useMemo(() => parseStoryProgress(raw), [raw]);
	const update = useCallback(
		(transform: (current: StoryProgress) => StoryProgress) =>
			write((current) => serializeStoryProgress(transform(parseStoryProgress(current)))),
		[write],
	);
	return [progress, update] as const;
}
