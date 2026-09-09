"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GameMode } from "@/lib/game-mode";
import type { RecipeCalculatorInput } from "@/lib/price-calculation";
import type { ProfitStationSource, PriceChangeHandler } from "../types";
import { usePinnedCrafts } from "../usePinnedCrafts";
import { useStoredProfitValue } from "../useStoredProfitValue";
import { StationCraftRow } from "./StationCraftRow";
import { CraftImage } from "./CraftImage";
import { StationCraftDetails } from "./StationCraftDetails";
import {
	boardCraftPlacements,
	buildStationBoard,
	parseBoardChoices,
	selectedBoardCraft,
	visibleBoardCrafts,
	type BoardChoice,
	type BoardRanking,
} from "./station-board";

const rankings: { id: BoardRanking; label: string; hint: string }[] = [
	{ id: "profit-hour", label: "Profit / hour", hint: "Assumes you restart crafts when they finish" },
	{ id: "easy", label: "Easy inputs", hint: "Fewer purchases and intermediate steps" },
	{ id: "duration", label: "Long runs", hint: "Longer profitable crafts for time away" },
	{ id: "profit", label: "Batch profit", hint: "Highest estimated profit from one batch" },
];

export function StationBoard({
	input,
	gameMode,
	stations,
	traders,
	onItemOpen,
	onPriceChange,
}: {
	input: RecipeCalculatorInput;
	gameMode: GameMode;
	stations: Record<string, ProfitStationSource>;
	traders: Record<string, { name: string }>;
	onItemOpen: (id: string) => void;
	onPriceChange: PriceChangeHandler;
}) {
	const { pinnedCrafts, togglePinnedCraft } = usePinnedCrafts(gameMode);
	const [rawChoices, updateChoices] = useStoredProfitValue(`tarkov-craft-board-v1:${gameMode}`);
	const choices = useMemo(() => parseBoardChoices(rawChoices), [rawChoices]);
	const crafts = useMemo(() => buildStationBoard(input), [input]);
	const [ranking, setRanking] = useState<BoardRanking>("profit-hour");
	const [detailId, setDetailId] = useState<string | null>(null);
	const [hiddenStations, setHiddenStations] = useState<Record<string, boolean>>({});
	const [includeLosses, setIncludeLosses] = useState(false);
	const rows = useMemo(() => crafts.map((craft) => selectedBoardCraft(craft, choices[craft.id])), [crafts, choices]);
	const [baselineRows] = useState(() => crafts.map((craft) => selectedBoardCraft(craft, choices[craft.id])));
	const craftById = useMemo(() => Object.fromEntries(crafts.map((craft) => [craft.id, craft])), [crafts]);
	const stationIds = [...new Set(crafts.map((craft) => craft.stationId))].sort(
		(a, b) =>
			Number((input.stationLevels?.[b] ?? 0) > 0) - Number((input.stationLevels?.[a] ?? 0) > 0) ||
			(stations[a]?.name ?? a).localeCompare(stations[b]?.name ?? b),
	);
	function saveChoice(id: string, choice: BoardChoice) {
		updateChoices((raw) => JSON.stringify({ ...parseBoardChoices(raw), [id]: choice }));
	}
	const unknownPins = Object.keys(pinnedCrafts).filter((id) => !craftById[id]);
	return (
		<section aria-label="Craft station board" className="space-y-4">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold">Craft Planner</h1>
					<p className="mt-1 text-sm text-muted-foreground">Choose your crafts. Keep your routine in view.</p>
				</div>
				<Link href="/items/crafting-profits" className="text-xs text-muted-foreground hover:text-foreground">
					All craft profits →
				</Link>
			</header>
			<div className="flex flex-wrap items-center justify-end gap-4">
				<div className="flex flex-wrap justify-end gap-1" aria-label="Recommendation order">
					{rankings.map((option) => (
						<button
							key={option.id}
							type="button"
							aria-pressed={ranking === option.id}
							title={option.hint}
							onClick={() => setRanking(option.id)}
							className={`rounded px-3 py-1.5 text-xs transition ${ranking === option.id ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5"}`}
						>
							{option.label}
						</button>
					))}
				</div>
				<label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
					<input type="checkbox" checked={includeLosses} onChange={(event) => setIncludeLosses(event.target.checked)} />
					Include unprofitable crafts
				</label>
			</div>
			<div className="divide-y divide-white/10">
				{stationIds.map((stationId) => {
					const stationRows = rows.filter((row) => row.craft?.stationId === stationId);
					const pinned = stationRows.filter((row) => pinnedCrafts[row.id]);
					const baselineStationRows = baselineRows.filter((row) => row.craft?.stationId === stationId);
					const placements = boardCraftPlacements(baselineStationRows, ranking);
					const hidden = !!hiddenStations[stationId];
					const visible = visibleBoardCrafts({
						rows: stationRows,
						baselineRows: baselineStationRows,
						ranking,
						includeLosses,
						pinnedCrafts,
						hideUnpinned: hidden,
					});
					return (
						<section key={stationId} id={stationId} aria-label={stations[stationId]?.name ?? stationId} className="py-3">
							<div className="flex items-center gap-2 pb-2">
								<CraftImage src={stations[stationId]?.imageLink ?? undefined} size={26} />
								<h2 className="text-sm font-medium">{stations[stationId]?.name ?? stationId}</h2>
								<span className="text-xs text-muted-foreground">Lv. {input.stationLevels?.[stationId] ?? 0}</span>
								{!!pinned.length && <span className="text-xs text-sky-300">{pinned.length} pinned</span>}
								<button
									type="button"
									className="ml-auto inline-flex items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground"
									aria-expanded={!hidden}
									onClick={() => setHiddenStations((current) => ({ ...current, [stationId]: !hidden }))}
								>
									{hidden ? "Show crafts" : "Hide unpinned"}
									{hidden ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
								</button>
							</div>

							<div>
								{visible.map((row) => (
									<StationCraftRow
										key={row.id}
										row={row}
										itemsById={input.itemsById}
										pinned={!!pinnedCrafts[row.id]}
										open={detailId === row.id}
										placement={placements[row.id]}
										onItemOpen={onItemOpen}
										onTogglePinned={() => togglePinnedCraft(row.id)}
										onToggleDetails={() => setDetailId(detailId === row.id ? null : row.id)}
									>
										{detailId === row.id && (
											<StationCraftDetails
												craft={craftById[row.id]}
												row={row}
												choice={choices[row.id]}
												input={input}
												traders={traders}
												stations={stations}
												onChoice={(choice) => saveChoice(row.id, choice)}
												onPriceChange={onPriceChange}
												onItemOpen={onItemOpen}
											/>
										)}
									</StationCraftRow>
								))}
								{!hidden && !visible.length && (
									<p className="px-2 pt-2 text-xs text-muted-foreground">No matching crafts at your current unlocks and prices.</p>
								)}
							</div>
						</section>
					);
				})}
			</div>
			{!!unknownPins.length && (
				<details className="text-xs text-muted-foreground">
					<summary>{unknownPins.length} saved crafts are absent from this catalog</summary>
					{unknownPins.map((id) => (
						<div key={id} className="flex gap-3 py-1">
							<span>{id}</span>
							<button type="button" onClick={() => togglePinnedCraft(id)} className="underline">
								Unpin
							</button>
						</div>
					))}
				</details>
			)}
		</section>
	);
}
