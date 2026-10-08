"use client";

import type { BaseItemRequirementsProps } from "./ItemRequirements";
import { PreviewFact } from "@/components/entities/entity-preview";
import { ItemLink } from "@/components/entities/item-link";
import { ItemImage } from "@/components/entities/item-image";
import { formatNumber } from "@/lib/utils/format-number";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeNeeds } from "@/lib/utils/item-needs";
import { describeFleaPrice, formatFleaPriceState } from "@/lib/utils/market-price";

export function CompactItemRequirements({
	nextLevelData,
	hideMoney,
	pooledFirByItem,
	itemById,
}: BaseItemRequirementsProps) {
	const itemCounts = useUserStore((state) => state.itemCounts);
	return (
		<div className="flex flex-wrap gap-2">
			{nextLevelData.itemRequirements
				.filter((req) => {
					const item = itemById[req.itemId];
					if (!item) return false;
					if (!hideMoney) return true;
					const norm = item.normalizedName;
					return norm !== "roubles" && norm !== "dollars" && norm !== "euros";
				})
				.map((req) => {
					const item = itemById[req.itemId];
					if (!item) return null;
					const norm = item.normalizedName;
					const isCurrency = norm === "roubles" || norm === "dollars" || norm === "euros";
					const priceState = describeFleaPrice(item);
					const priceLabel = priceState.kind === "missing" ? null : formatFleaPriceState(priceState, { compact: true });

					const owned = itemCounts[req.itemId] ?? { have: 0, haveFir: 0 };
					const globalFirRemaining = pooledFirByItem[req.itemId] ?? 0;
					const firSurplus = Math.max(0, owned.haveFir - globalFirRemaining);
					const needs = isCurrency
						? computeNeeds({
								totalRequired: req.count,
								requiredFir: 0,
								haveNonFir: 0,
								haveFir: 0,
							})
						: req.isFir
							? computeNeeds({
									totalRequired: req.count,
									requiredFir: req.count,
									haveNonFir: 0,
									haveFir: owned.haveFir,
								})
							: computeNeeds({
									totalRequired: req.count,
									requiredFir: 0,
									haveNonFir: owned.have + firSurplus,
									haveFir: 0,
								});

					const isCompleted = !isCurrency
						? req.isFir
							? needs.isSatisfied
							: needs.isSatisfied && !needs.usesFirForNonFir
						: false;

					return (
						<ItemLink
							key={req.id}
							item={item}
							aria-label={`${formatNumber(req.count)} ${item.name}${req.isFir ? ", found in raid" : ""}${isCompleted ? ", completed" : ""}`}
							previewDetails={
								<PreviewFact label="Required">
									{formatNumber(req.count)}
									{req.isFir && <span className="ml-1 text-fir">FiR</span>}
									{isCompleted && <span className="ml-1 text-success">· done</span>}
								</PreviewFact>
							}
							className="group inline-flex self-start focus-visible:outline-2 focus-visible:outline-brand"
						>
							<ItemImage
								item={item}
								size={64}
								framed
								foundInRaid={req.isFir}
								completed={isCompleted}
								className={`p-1 ${req.isFir ? "border-fir group-hover:bg-shadow/50" : "group-hover:border-highlight/30"}`}
							>
								{priceLabel && !isCurrency && (
									<span className="absolute top-0 left-0 max-w-full bg-shadow/55 px-1 text-left font-mono text-[9px] leading-4 text-foreground">
										{priceLabel}
									</span>
								)}
								<span
									className={`absolute bottom-0 right-0 max-w-full bg-shadow/40 px-1 text-right font-mono text-[10px] leading-tight ${isCompleted ? "text-success" : req.isFir ? "text-fir" : "text-brand"}`}
								>
									{isCurrency ? (
										formatNumber(req.count)
									) : req.isFir ? (
										<>
											{formatNumber(needs.haveFirReserved)} / {formatNumber(needs.requiredFir)}
										</>
									) : (
										<>
											{formatNumber(needs.effectiveHave)}{" "}
											{owned.haveFir > 0 && <span className="text-fir">{formatNumber(owned.haveFir)}</span>}
											{` / ${formatNumber(needs.totalRequired)}`}
										</>
									)}
								</span>
							</ItemImage>
						</ItemLink>
					);
				})}
		</div>
	);
}
