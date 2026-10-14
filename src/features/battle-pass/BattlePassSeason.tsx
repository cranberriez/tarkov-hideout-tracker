"use client";
import { createContext, useContext, useMemo, type ReactNode, type CSSProperties } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { getSeason, type SeasonId } from "@/lib/cfg/seasons";
import { useCurrentSeason } from "@/features/seasons/useCurrentSeason";
import { getBattlePassData, withCostSwaps, type BattlePassData } from "@/lib/battle-pass-seasons";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import { parseProgress, type Progress } from "./lib/battle-pass-model";
const BattlePassSeasonContext = createContext<BattlePassData | null>(null);
type BattlePassSave = { stored: Progress; write: ReturnType<typeof useStoredProfitValue>[1] };
const BattlePassSaveContext = createContext<BattlePassSave | null>(null);
export function useBattlePassData() {
	return useContext(BattlePassSeasonContext) ?? getBattlePassData("season-1");
}
/** The season save, read and parsed once by the provider. */
export function useBattlePassSave() {
	const save = useContext(BattlePassSaveContext);
	if (!save) throw new Error("useBattlePassSave must be used inside BattlePassSeason");
	return save;
}
/** Read the season save once; its document-type swaps apply to the data every consumer plans with. */
function useSeasonSave(seasonId: SeasonId) {
	const base = getBattlePassData(seasonId);
	const [raw, write] = useStoredProfitValue(base.storageKey);
	const stored = useMemo(() => parseProgress(raw), [raw]);
	// Keyed by content so unrelated saves (completions, balances) keep the data identity stable.
	const swapsKey = JSON.stringify(stored.costSwaps);
	const data = useMemo(() => withCostSwaps(base, JSON.parse(swapsKey)), [base, swapsKey]);
	const save = useMemo(() => ({ stored, write }), [stored, write]);
	return { data, save };
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
	const { data, save } = useSeasonSave(resolved);
	const season = getSeason(resolved);
	return (
		<BattlePassSeasonContext value={data}>
			<BattlePassSaveContext value={save}>
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
			</BattlePassSaveContext>
		</BattlePassSeasonContext>
	);
}
