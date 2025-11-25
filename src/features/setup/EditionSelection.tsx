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
				<h3 className="text-lg font-medium text-white">What edition of the game do you have?</h3>
				<p className="text-xs text-gray-500 mt-1">This will modify some base hideout station levels.</p>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
				{EDITIONS.map((edition, index) => {
					const isSelected = selected === edition;

					// Layout logic: First 3 items span 2 cols (3x2=6), last 2 items span 3 cols (2x3=6)
					const colSpan = index < 3 ? "sm:col-span-2" : "sm:col-span-3";

					let baseClassName = `${colSpan} px-3 py-2 rounded-md border text-center transition-all duration-300 relative overflow-hidden group `;

					if (edition === "Edge of Darkness") {
						const activeClass = isSelected
							? "shadow-[0_0_30px_rgba(249,115,22,0.5)] border-orange-500 bg-orange-500/20 text-orange-50 "
							: "shadow-[0_0_15px_rgba(249,115,22,0.15)] border-orange-500/30 bg-orange-500/5 text-orange-200/80 hover:shadow-[0_0_25px_rgba(249,115,22,0.4)] hover:border-orange-500/80 hover:bg-orange-500/10 hover:text-orange-100 ";
						baseClassName += activeClass;
					} else if (edition === "Unheard") {
						const activeClass = isSelected
							? "shadow-[0_0_30px_rgba(20,184,166,0.5)] border-teal-500 bg-teal-500/20 text-teal-50 "
							: "shadow-[0_0_15px_rgba(20,184,166,0.15)] border-teal-500/30 bg-teal-500/5 text-teal-200/80 hover:shadow-[0_0_25px_rgba(20,184,166,0.4)] hover:border-teal-500/80 hover:bg-teal-500/10 hover:text-teal-100 ";
						baseClassName += activeClass;
					} else {
						if (isSelected) {
							baseClassName +=
								"bg-white/10 border-white text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] ";
						} else {
							baseClassName +=
								"bg-card border-border-color text-gray-400 hover:border-gray-500 hover:text-gray-200 hover:bg-white/5 ";
						}
					}

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
