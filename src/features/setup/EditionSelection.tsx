"use client";

import { GameEdition } from "@/lib/stores/useUserStore";

interface EditionSelectionProps {
	selected: GameEdition | null;
	onSelect: (edition: GameEdition) => void;
}

const EDITIONS: GameEdition[] = ["Standard", "Left Behind", "Prepare for Escape", "Edge of Darkness", "Unheard"];

export function EditionSelection({ selected, onSelect }: EditionSelectionProps) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col">
				<h3 className="text-base font-medium text-foreground">Game edition</h3>
				<p className="text-xs text-subtle-foreground mt-1">Sets your starting Stash and Cultist Circle levels.</p>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
				{EDITIONS.map((edition, index) => {
					const isSelected = selected === edition;

					// Layout logic: First 3 items span 2 cols (3x2=6), last 2 items span 3 cols (2x3=6)
					const colSpan = index < 3 ? "sm:col-span-2" : "sm:col-span-3";

					const baseClassName = `${colSpan} px-3 py-2 rounded-md border text-center transition-all duration-300 relative overflow-hidden group ${
						isSelected
							? "border-brand bg-brand/10 text-brand shadow-[0_0_15px_color-mix(in_oklab,var(--brand)_10%,transparent)]"
							: "bg-card border-border text-muted-foreground hover:border-brand/50 hover:text-foreground hover:bg-highlight/5"
					}`;
					return (
						<button key={edition} onClick={() => onSelect(edition)} className={baseClassName}>
							<div className="font-bold text-sm sm:text-base relative z-10">{edition}</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
