"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSeason, SEASONS } from "@/lib/cfg/seasons";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCurrentSeason } from "./useCurrentSeason";

export function SeasonCharacterBanner() {
	const current = useCurrentSeason();
	const mode = useUserStore((state) => state.gameMode);
	const selectedId = useUserStore((state) => state.selectedSeasonId);
	const exists = useUserStore((state) => !!state.seasonalProfiles[current.id]);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const isPast =
		SEASONS.findIndex((season) => season.id === selectedId) < SEASONS.findIndex((season) => season.id === current.id);
	if (mode !== "KORD" || !isPast) return null;
	return (
		<aside aria-label="Past seasonal character" className="border-b border-warning/25 bg-warning/10">
			<div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
				<p>
					You are playing an old seasonal character: <strong>{getSeason(selectedId).title}</strong>. Your progress stays
					editable and saved separately.
				</p>
				<button
					type="button"
					className="rounded border border-warning/35 px-3 py-1.5 font-semibold text-warning hover:bg-warning/10"
					onClick={() => {
						try {
							useUserStore.getState().activateSeason(current.id);
							setError(null);
							router.refresh();
						} catch (cause) {
							setError(
								cause instanceof Error ? cause.message : "The new character could not be saved. Please try again.",
							);
						}
					}}
				>
					{exists ? "Switch to" : "Activate"} {current.name}
				</button>
				{error && (
					<p role="alert" className="w-full text-danger">
						{error}
					</p>
				)}
			</div>
		</aside>
	);
}
