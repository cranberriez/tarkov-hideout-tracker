"use client";
import { createContext, useContext, type ReactNode, type CSSProperties } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { getSeason, type SeasonId } from "@/lib/cfg/seasons";
import { useCurrentSeason } from "@/features/seasons/useCurrentSeason";
import { getBattlePassData } from "@/lib/battle-pass-seasons";
const BattlePassSeasonContext = createContext<SeasonId>("season-1");
export function useBattlePassData() {
	return getBattlePassData(useContext(BattlePassSeasonContext));
}
export function BattlePassSeason({
	seasonId,
	children,
	showHeader = true,
	showNotice = showHeader,
}: {
	seasonId?: SeasonId;
	children: ReactNode;
	showHeader?: boolean;
	showNotice?: boolean;
}) {
	const mode = useUserStore((state) => state.gameMode);
	const selected = useUserStore((state) => state.selectedSeasonId);
	const current = useCurrentSeason();
	const resolved = seasonId ?? (mode === "KORD" ? selected : current.id);
	const data = getBattlePassData(resolved);
	const season = getSeason(resolved);
	return (
		<BattlePassSeasonContext value={resolved}>
			<div key={resolved} style={{ "--season-color": season.color } as CSSProperties}>
				{showHeader && (
					<div className="container mx-auto flex flex-wrap items-center gap-3 px-4 pt-4 text-sm">
						<strong style={{ color: season.color }}>{season.title} Battle Pass</strong>
						<a href="/battle-pass?season=season-1" className="underline">
							KORD
						</a>
						<a href="/battle-pass?season=season-2" className="underline">
							Test
						</a>
						{showNotice && data.notice && <p className="text-muted-foreground">{data.notice}</p>}
					</div>
				)}
				{!showHeader && showNotice && data.notice && (
					<p className="container mx-auto px-4 pt-4 text-sm text-muted-foreground">{data.notice}</p>
				)}
				{children}
			</div>
		</BattlePassSeasonContext>
	);
}
