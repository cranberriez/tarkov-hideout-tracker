"use client";

import { ArrowRight, Check, ChevronDown, CornerDownRight } from "lucide-react";
import { useState } from "react";
import type { ItemSummary } from "@/types/items";
import type { ProfitStationSource } from "../types";
import { formatDuration, formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import { routeChipClasses } from "../components/RouteIcon";
import { collapsedStationPlans, craftWindowProfitHour, type CraftPlan } from "./craft-plans";
import { CraftImage } from "./CraftImage";
import { CraftFleaPrice } from "./CraftFleaPrice";
import { CraftSalePrice } from "./CraftSalePrice";

export function CraftRecommendations({
	groups,
	stationIds,
	stations,
	items,
	selected,
	slots,
	target,
	cadence,
	readyAt,
	continuousRates,
	onSelect,
	onInspect,
	compact,
}: {
	compact: boolean;
	groups: Map<string, CraftPlan[]>;
	stationIds: string[];
	stations: Record<string, ProfitStationSource>;
	items: Readonly<Record<string, ItemSummary>>;
	selected: CraftPlan[];
	slots: number;
	target: number;
	cadence: number;
	continuousRates?: Record<string, number>;
	readyAt: Record<string, number>;
	onSelect: (stationId: string, planId: string) => void;
	onInspect: (planId: string) => void;
}) {
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const orderedStationIds = [...stationIds].sort((a, b) => Number(!!groups.get(b)?.length) - Number(!!groups.get(a)?.length));
	return (
		<div className={`grid items-start gap-4 ${compact ? "lg:grid-cols-2 2xl:grid-cols-4" : "xl:grid-cols-2"}`}>
			{orderedStationIds.map((stationId) => {
				const all = groups.get(stationId) ?? [];
				const current = selected.filter((plan) => plan.stationId === stationId);
				const shown = expanded[stationId] ? all : collapsedStationPlans(all, current);
				const station = stations[stationId];
				return (
					<section key={stationId} aria-label={station?.name ?? stationId} className="min-w-0 rounded-xl bg-white/[0.025] p-3">
						<div className="mb-2 flex items-center gap-2">
							<CraftImage src={station?.imageLink} size={30} />
							<h3 className="flex-1 text-sm font-semibold">{station?.name ?? stationId}</h3>
							<span className="text-xs text-muted-foreground">
								{current.length}/{slots} selected
							</span>
						</div>
						{!shown.length && <p className="text-sm text-muted-foreground">No available profitable crafts</p>}
						<div className={`grid gap-2 ${shown.length > 1 ? "sm:grid-cols-2" : ""}`}>
							{shown.map((plan) => {
								const active = current.some((choice) => choice.id === plan.id);
								const window = active ? cadence : Math.max(target, plan.duration);
								const difference = plan.duration - target;
								const queued = active && (readyAt[plan.id] ?? 0) > plan.duration + 1;
								return (
									<article
										key={plan.id}
										className={`flex min-w-0 flex-col overflow-hidden rounded-lg transition-colors ${active ? "bg-tarkov-green/[0.08]" : "hover:bg-white/5"}`}
									>
										<button
											type="button"
											aria-pressed={active}
											aria-label={`Choose ${plan.name}`}
											onClick={() => onSelect(stationId, plan.id)}
											className={`flex flex-1 flex-col text-left ${compact ? "p-2" : "p-3"}`}
										>
											<div className="flex w-full items-center gap-2">
												<CraftImage item={items[plan.itemId]} size={compact ? 32 : 56} className="shrink-0" />
												<span className="min-w-0 flex-1 text-xs font-medium leading-snug">
													{plan.name}
													{plan.count > 1 && <span className="ml-1 text-muted-foreground">×{plan.count}</span>}
												</span>
												<span
													className={`flex h-4 w-4 shrink-0 items-center justify-center self-start rounded-full border ${active ? "border-tarkov-green bg-tarkov-green text-black" : "border-white/20"}`}
												>
													{active && <Check size={10} aria-hidden="true" />}
												</span>
											</div>
											<span className="mt-2 block w-full">
												<CraftSalePrice plan={plan} compact={compact} />
											</span>
											<span className="mt-2 flex w-full flex-wrap items-baseline justify-between gap-1">
												{!compact && <span className="font-mono text-xs text-muted-foreground">{formatDuration(plan.duration)}</span>}
												<span className="text-sm font-medium text-tarkov-green">
													<span className="mr-1 text-xs font-normal text-muted-foreground">Profit</span>
													<span className="font-mono">+{formatRoundedRoubles(plan.profit)}</span>
												</span>
											</span>
											{!compact && (
												<>
													<span className="mt-1 text-xs text-muted-foreground">
														{formatRoundedRoubles(
															continuousRates
																? active
																	? (continuousRates[plan.id] ?? 0)
																	: craftWindowProfitHour(plan.profit, plan.duration, 0)
																: craftWindowProfitHour(plan.profit, plan.duration, window),
														)}
														/h · {continuousRates ? (active ? "day average" : "standalone") : active ? "your run" : "with wait"}
													</span>
													<span className={`mt-1 text-xs ${queued || difference > 0 ? "text-amber-200/80" : "text-muted-foreground"}`}>
														{queued
															? `Ready in ${formatDuration(readyAt[plan.id])} · shared station`
															: continuousRates
																? "Restart when ready"
																: Math.abs(difference) < 30
																	? "Right on time"
																	: `${formatDuration(Math.abs(difference))} ${difference > 0 ? "longer" : "to spare"}`}
													</span>
												</>
											)}
										</button>
										<button
											type="button"
											onClick={() => onInspect(plan.id)}
											aria-label={`View ingredients and acquisition chain for ${plan.name}`}
											aria-haspopup="dialog"
											className={`flex flex-col text-left text-xs hover:bg-white/5 ${compact ? "gap-1 px-2 pb-2" : "gap-2 px-3 py-2.5"}`}
										>
											<span className="flex w-full items-center gap-1.5 font-medium">
												<CornerDownRight size={14} className="text-muted-foreground" aria-hidden="true" />
												Required items
												<ArrowRight size={13} className="ml-auto text-muted-foreground" aria-hidden="true" />
											</span>
											<span className={compact ? "flex flex-wrap gap-1.5" : "contents"}>
												{[...plan.requiredItems]
													.sort((a, b) => Number(!!a.isTool) - Number(!!b.isTool))
													.map((part, index) => (
														<span
															key={index}
															title={`${items[part.itemId]?.name ?? part.itemId} ×${formatQuantity(part.quantity)}${part.isTool ? " · Owned tool" : ""}`}
															className={`flex items-center gap-1 ${compact ? "" : "w-full"} ${part.isTool ? "opacity-60" : ""}`}
														>
															<CraftImage item={items[part.itemId]} size={26} />
															<span className="min-w-0 flex-1 break-words text-muted-foreground">
																<span className={compact ? "sr-only" : ""}>{items[part.itemId]?.name ?? part.itemId}</span>{" "}
																<span className="whitespace-nowrap">×{formatQuantity(part.quantity)}</span>
																{!compact && <CraftFleaPrice part={part} />}
															</span>
															{!compact && (
																<span
																	className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${part.isTool ? "bg-white/10 text-muted-foreground" : routeChipClasses(part.method)}`}
																>
																	{part.isTool
																		? "Owned tool"
																		: part.method === "flea"
																			? "Flea"
																			: part.method === "trader"
																				? "Trader"
																				: part.method === "barter"
																					? "Barter"
																					: "Craft"}
																</span>
															)}
														</span>
													))}
											</span>
											{!compact && <span className="text-tarkov-green">View acquisition chain</span>}
										</button>
									</article>
								);
							})}
						</div>
						{all.length > 2 && (
							<button
								type="button"
								className="mt-3 flex w-full items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
								onClick={() => setExpanded((previous) => ({ ...previous, [stationId]: !previous[stationId] }))}
							>
								{expanded[stationId] ? "Show less" : `${all.length - 2} more ${all.length === 3 ? "craft" : "crafts"}`}
								<ChevronDown size={13} className={expanded[stationId] ? "rotate-180" : ""} aria-hidden="true" />
							</button>
						)}
					</section>
				);
			})}
		</div>
	);
}
