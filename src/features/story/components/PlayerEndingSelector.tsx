"use client";

import { STORY_ENDINGS } from "@/lib/data/story/endings";
import type { GameMode } from "@/lib/game-mode";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { cn } from "@/lib/utils";
import { useStoryProgress } from "../useStoryProgress";

export function PlayerEndingSelector({ gameMode }: { gameMode: GameMode }) {
	const hydrated = useUserStoreHydrated();
	const [progress, update] = useStoryProgress(gameMode);
	const targetEnding = hydrated ? progress.targetEnding : null;

	return (
		<div role="group" aria-label="Target ending" className="flex gap-1.5">
			{STORY_ENDINGS.map((ending) => {
				const selected = targetEnding === ending.id;
				return (
					<button
						key={ending.id}
						type="button"
						disabled={!hydrated}
						aria-label={ending.name}
						aria-pressed={selected}
						title={ending.name}
						onClick={() =>
							update((current) => ({
								...current,
								targetEnding: current.targetEnding === ending.id ? null : ending.id,
							}))
						}
						className={cn(
							"flex h-9 min-w-0 items-center justify-center gap-2 rounded-sm px-2 text-xs font-semibold text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50",
							selected ? "bg-highlight/10" : "bg-shadow/30 hover:bg-highlight/5",
							targetEnding && !selected ? "w-10 shrink-0" : "flex-1",
						)}
					>
						<img
							src={ending.image}
							alt=""
							className={cn(
								"max-w-none shrink-0 object-contain",
								selected ? "size-11 drop-shadow-[0_2px_3px_var(--shadow)]" : "size-7",
							)}
						/>
						{selected && <span>{ending.name}</span>}
					</button>
				);
			})}
		</div>
	);
}
