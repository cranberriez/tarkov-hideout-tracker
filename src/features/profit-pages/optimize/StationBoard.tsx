"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pin, SlidersHorizontal } from "lucide-react";
import type { GameMode } from "@/lib/game-mode";
import type { RecipeCalculatorInput } from "@/lib/price-calculation";
import type { ProfitStationSource, PriceChangeHandler } from "../types";
import { usePinnedCrafts } from "../usePinnedCrafts";
import { useStoredProfitValue } from "../useStoredProfitValue";
import { formatDuration, formatQuantity, formatRoundedRoubles, formatSignedRoubles } from "../utils/formatters";
import { CraftImage } from "./CraftImage";
import { StationCraftDetails } from "./StationCraftDetails";
import {
	boardCraftAvailable,
	boardMaterials,
	buildStationBoard,
	parseBoardChoices,
	rankBoardCrafts,
	selectedBoardCraft,
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
	const [openStation, setOpenStation] = useState<string | null | undefined>(undefined);
	const [detailId, setDetailId] = useState<string | null>(null);
	const [allStations, setAllStations] = useState<Record<string, boolean>>({});
	const [includeLosses, setIncludeLosses] = useState(false);
	const rows = useMemo(() => crafts.map((craft) => selectedBoardCraft(craft, choices[craft.id])), [crafts, choices]);
	const craftById = useMemo(() => Object.fromEntries(crafts.map((craft) => [craft.id, craft])), [crafts]);
	const saved = rows.filter((row) => pinnedCrafts[row.id]);
	const stationIds = [...new Set(crafts.map((craft) => craft.stationId))].sort(
		(a, b) =>
			Number((input.stationLevels?.[b] ?? 0) > 0) - Number((input.stationLevels?.[a] ?? 0) > 0) ||
			(stations[a]?.name ?? a).localeCompare(stations[b]?.name ?? b),
	);
	const initialStation = stationIds.find((id) => rows.some((row) => row.craft?.stationId === id && boardCraftAvailable(row) && (row.profit ?? 0) > 0));
	const expandedId = openStation === undefined ? (saved.length ? null : initialStation) : openStation;
	const materials = boardMaterials(saved.filter(boardCraftAvailable));
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
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap gap-1" aria-label="Recommendation order">
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
				<span className="text-xs text-muted-foreground">{saved.length ? `${saved.length} pinned · saved automatically` : "Pin crafts to keep them here"}</span>
			</div>
			<div className="divide-y divide-white/10">
				{stationIds.map((stationId) => {
					const stationRows = rows.filter((row) => row.craft?.stationId === stationId);
					const pinned = stationRows.filter((row) => pinnedCrafts[row.id]);
					const candidates = rankBoardCrafts(
						stationRows.filter((row) => !pinnedCrafts[row.id] && boardCraftAvailable(row) && (includeLosses || (row.profit ?? 0) > 0)),
						ranking,
					);
					const expanded = expandedId === stationId;
					const visible = [...pinned, ...(expanded ? candidates.slice(0, allStations[stationId] ? undefined : 4) : [])];
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
									aria-expanded={expanded}
									onClick={() => setOpenStation(expanded ? null : stationId)}
								>
									{expanded ? "Done picking" : pinned.length ? "Change crafts" : "Choose crafts"}
									{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
								</button>
							</div>
							{visible.map((row) => {
								const output = input.itemsById[row.outputItemId];
								const pinned = !!pinnedCrafts[row.id];
								const available = boardCraftAvailable(row);
								const open = detailId === row.id;
								const gross = row.grossSellValue === undefined ? row.sellValue : row.grossSellValue;
								const roi = row.cost && row.profit !== null ? (row.profit / row.cost) * 100 : null;
								return (
									<div key={row.id} className={`rounded ${pinned ? "bg-white/[0.025]" : ""}`}>
										<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-2 py-2.5 lg:grid-cols-[minmax(170px,1.15fr)_82px_minmax(200px,2fr)_108px_124px_78px]">
											<button
												type="button"
												onClick={() => onItemOpen(row.outputItemId)}
												className="flex min-w-0 items-center gap-2 text-left hover:text-tarkov-green"
											>
												<CraftImage item={output} size={36} />
												<span className="min-w-0 text-xs font-medium">
													{output?.name ?? row.outputItemId}
													<span className="ml-1 text-muted-foreground">×{formatQuantity(row.outputCount)}</span>
												</span>
											</button>
											<span className="text-xs text-muted-foreground lg:block">{formatDuration(row.durationSeconds)}</span>
											<div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 lg:col-span-1">
												{row.requiredItems.map((part) => (
													<button
														key={`${part.itemId}:${part.isTool}`}
														type="button"
														title={`${input.itemsById[part.itemId]?.name ?? part.itemId}${part.isTool ? " · reusable tool" : ""}`}
														onClick={() => onItemOpen(part.itemId)}
														className={`inline-flex items-center gap-1 text-xs hover:text-foreground ${part.isTool ? "text-muted-foreground/70" : "text-muted-foreground"}`}
													>
														<CraftImage item={input.itemsById[part.itemId]} size={22} />
														<span>
															{formatQuantity(part.quantity)}× {input.itemsById[part.itemId]?.shortName ?? input.itemsById[part.itemId]?.name ?? part.itemId}
															{part.isTool ? " · tool" : ""}
														</span>
													</button>
												))}
											</div>
											<div className="text-xs">
												<span className="block font-mono">{formatRoundedRoubles(gross === null ? null : gross / row.outputCount)}</span>
												<span className="text-[11px] text-muted-foreground">each · {row.sellSourceLabel ?? "No sale price"}</span>
											</div>
											<div
												className="text-right text-xs lg:text-left"
												title={`Inputs: ${formatRoundedRoubles(row.cost)} · Listing fee: ${formatRoundedRoubles(row.sellFee ?? null)} · Proceeds: ${formatRoundedRoubles(row.sellValue)}${roi === null ? "" : ` · Return on inputs: ${roi.toFixed(1)}%`}`}
											>
												<span
													className={`block font-mono font-medium ${!available ? "text-amber-300" : (row.profit ?? 0) > 0 ? "text-tarkov-green" : "text-red-300"}`}
												>
													{!available ? "Check details" : formatSignedRoubles(row.profit)}
												</span>
												<span className="text-[11px] text-muted-foreground">
													{available ? `${formatSignedRoubles(row.profitPerHour)} / h` : "Saved craft retained"}
												</span>
											</div>
											<div className="col-span-2 flex justify-end gap-1 lg:col-span-1">
												<button
													type="button"
													aria-label={`${pinned ? "Unpin" : "Pin"} ${output?.name ?? row.id}`}
													aria-pressed={pinned}
													title={pinned ? "Remove from board" : "Keep on board"}
													onClick={() => togglePinnedCraft(row.id)}
													className={`rounded p-2 hover:bg-white/10 ${pinned ? "text-sky-300" : "text-muted-foreground"}`}
												>
													<Pin size={15} className={pinned ? "fill-current" : ""} />
												</button>
												<button
													type="button"
													aria-label={`Details for ${output?.name ?? row.id}`}
													aria-expanded={open}
													title="Prices and routes"
													onClick={() => setDetailId(open ? null : row.id)}
													className={`rounded p-2 hover:bg-white/10 ${open ? "text-foreground bg-white/10" : "text-muted-foreground"}`}
												>
													<SlidersHorizontal size={15} />
												</button>
											</div>
										</div>
										{open && (
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
									</div>
								);
							})}
							{expanded && (
								<div className="flex flex-wrap items-center gap-4 px-2 pt-2 text-xs text-muted-foreground">
									{!candidates.length && <span>{pinned.length ? "No other matching crafts." : "No matching crafts at your current unlocks and prices."}</span>}
									{candidates.length > 4 && (
										<button
											type="button"
											className="hover:text-foreground"
											onClick={() => setAllStations((current) => ({ ...current, [stationId]: !current[stationId] }))}
										>
											{allStations[stationId] ? "Show shortlist" : `Show all ${candidates.length} alternatives`}
										</button>
									)}
									<label className="inline-flex items-center gap-1.5">
										<input type="checkbox" checked={includeLosses} onChange={(event) => setIncludeLosses(event.target.checked)} />
										Include unprofitable crafts
									</label>
								</div>
							)}
						</section>
					);
				})}
			</div>
			{!!materials.length && (
				<details className="py-2">
					<summary className="cursor-pointer text-sm font-medium">
						Materials required <span className="ml-2 text-xs font-normal text-muted-foreground">One batch of each available pinned craft</span>
					</summary>
					<div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
						{materials.map((part) => (
							<div key={`${part.itemId}:${part.isTool}:${part.sourceId ?? part.method}`} className="flex items-center gap-2 text-xs">
								<CraftImage item={input.itemsById[part.itemId]} size={26} />
								<span className="min-w-0 flex-1">
									{input.itemsById[part.itemId]?.name ?? part.itemId}
									<span className="block text-[11px] text-muted-foreground">
										{part.isTool
											? "Reusable tool"
											: part.traderOffer
												? (traders[part.traderOffer.traderId]?.name ?? "Trader")
												: part.method === "flea"
													? "Flea market"
													: "Check source"}
									</span>
								</span>
								<span className="font-mono">×{formatQuantity(part.quantity)}</span>
							</div>
						))}
					</div>
				</details>
			)}
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
