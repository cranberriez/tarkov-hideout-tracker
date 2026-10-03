"use client";

import type { BaseItemRequirementsProps } from "./ItemRequirements";
import { ItemLink } from "@/components/entities/item-link";
import Image from "next/image";
import { CircleCheckBig, Check } from "lucide-react";
import { formatNumber } from "@/lib/utils/format-number";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeNeeds } from "@/lib/utils/item-needs";
import { describeFleaPrice, formatFleaPriceState } from "@/lib/utils/market-price";

export function ExpandedItemRequirements({
	nextLevelData,
	hideMoney,
	pooledFirByItem,
	itemById,
}: BaseItemRequirementsProps) {
	const itemCounts = useUserStore((state) => state.itemCounts);
	return (
		<div className="flex flex-col gap-1.5">
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
					const priceLabel = formatFleaPriceState(describeFleaPrice(item), { compact: true });

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
							className={`flex items-center gap-3 rounded-sm p-1 transition-colors focus-visible:outline-2 focus-visible:outline-brand ${
								isCompleted ? "opacity-60 hover:bg-shadow/20" : "bg-shadow/40 hover:bg-shadow/60"
							}`}
						>
							<div className={`relative w-10 h-10 shrink-0 ${req.isFir ? "ring-1 ring-fir" : ""}`}>
								{item.iconLink && (
									<Image
										src={item.iconLink}
										alt={item.name}
										fill
										className={`object-contain ${isCompleted ? "grayscale" : ""}`}
										unoptimized
									/>
								)}
								{isCompleted && (
									<div className="absolute inset-0 flex items-center justify-center text-success">
										<Check size={24} strokeWidth={2} />
									</div>
								)}
							</div>
							<div className="flex-1 min-w-0 flex items-center justify-between gap-2">
								<div className="flex flex-col items-start gap-0.5 min-w-0">
									<div className={`text-xs truncate ${isCompleted ? "text-subtle-foreground" : "text-foreground"}`}>
										<span
											className={`font-bold mr-2 font-mono ${
												isCompleted ? "text-subtle-foreground" : "text-foreground"
											}`}
										>
											{item.shortName || item.name}
										</span>
									</div>
									<div className="flex flex-wrap items-baseline gap-x-2 text-[10px] font-mono text-muted-foreground">
										{isCurrency ? (
											<span className="text-brand">{formatNumber(req.count)}</span>
										) : req.isFir ? (
											<span className={isCompleted ? "text-success" : "text-fir"}>
												FiR {formatNumber(needs.haveFirReserved)} / {formatNumber(needs.requiredFir)}
											</span>
										) : (
											<span className={isCompleted ? "text-success" : "text-brand"}>
												{formatNumber(needs.effectiveHave)}
												{owned.haveFir > 0 && (
													<span className="text-fir">{` (${formatNumber(owned.haveFir)})`}</span>
												)}
												{` / ${formatNumber(needs.totalRequired)}`}
											</span>
										)}
										{!isCurrency && <span className="text-subtle-foreground">{priceLabel} ea</span>}
									</div>
								</div>
								{req.isFir && !isCompleted && (
									<div className="shrink-0 text-fir" title="Found In Raid">
										<CircleCheckBig className="w-4 h-4" />
									</div>
								)}
							</div>
						</ItemLink>
					);
				})}
		</div>
	);
}
