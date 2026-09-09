"use client";

import { GAME_MODES, type GameMode } from "@/lib/stores/useUserStore";

interface GameModeSelectionProps {
	selected: GameMode;
	onSelect: (mode: GameMode) => void;
}

export function GameModeSelection({ selected, onSelect }: GameModeSelectionProps) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col">
				<h3 className="text-base font-medium text-foreground">Game mode</h3>
				<p className="text-xs text-subtle-foreground mt-1">Progress is tracked separately for each mode.</p>
			</div>
			<div className="flex flex-col sm:flex-row gap-3">
				{GAME_MODES.map((mode) => {
					const isSelected = selected === mode;
					return (
						<button
							key={mode}
							onClick={() => onSelect(mode)}
							className={`
                                flex-1 px-3 py-2.5 rounded-md border transition-all duration-200 font-semibold text-center text-sm
                                ${
									isSelected
										? "bg-highlight/10 border-highlight text-foreground shadow-[0_0_15px_color-mix(in_oklab,_var(--highlight)_10%,_transparent)]"
										: "bg-card border-border-color text-muted-foreground hover:border-border hover:text-foreground hover:bg-highlight/5"
								}
                            `}
						>
							{mode}
						</button>
					);
				})}
			</div>
		</div>
	);
}
