"use client";

import type { BaseItemRequirementsProps } from "./ItemRequirements";
import { PreviewFact } from "@/components/entities/entity-preview";
import { ItemLink } from "@/components/entities/item-link";
import Image from "next/image";
import { CircleCheckBig, Check } from "lucide-react";
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
									{req.isFir && <span className="ml-1 text-warning">FiR</span>}
									{isCompleted && <span className="ml-1 text-success">· done</span>}
								</PreviewFact>
							}
							className={`relative block w-16 h-16 bg-shadow/40 border group transition-all focus-visible:outline-2 focus-visible:outline-brand ${
								req.isFir ? "border-warning" : "border-highlight/10"
							} ${isCompleted ? "opacity-50 grayscale" : "hover:border-highlight/30"}`}
						>
							{item.iconLink && (
								<Image src={item.iconLink} alt={item.name} fill className="object-contain p-1" unoptimized />
							)}
							{req.isFir && (
								<div
									className="absolute -top-1.5 -right-1.5 bg-shadow rounded-full z-10 text-warning"
									title="Found In Raid"
								>
									<CircleCheckBig className="w-3.5 h-3.5 text-warning" />
								</div>
							)}
							{isCompleted && (
								<div className="absolute inset-0 flex items-center justify-center bg-shadow/40">
									<Check size={16} />
								</div>
							)}
							<div className="absolute bottom-0 right-0 bg-shadow/40 px-1 text-[10px] font-mono text-foreground border-t border-l border-highlight/10 text-right leading-tight">
								{isCurrency ? (
									<div
										className={
											req.isFir
												? isCompleted
													? "text-success"
													: "text-warning"
												: isCompleted
													? "text-success"
													: "text-brand"
										}
									>
										{formatNumber(req.count)}
									</div>
								) : req.isFir ? (
									<div className={isCompleted ? "text-success" : "text-warning"}>
										{formatNumber(needs.haveFirReserved)} / {formatNumber(needs.requiredFir)}
									</div>
								) : (
									<div className={isCompleted ? "text-success" : "text-brand"}>
										{formatNumber(needs.effectiveHave)}{" "}
										{owned.haveFir > 0 && <span className="text-warning">{formatNumber(owned.haveFir)}</span>}
										{` / ${formatNumber(needs.totalRequired)}`}
									</div>
								)}
							</div>
							{priceLabel && !isCurrency && (
								<div className="absolute top-0 left-0 max-w-full bg-shadow/55 px-1 text-[9px] font-mono leading-4 text-foreground">
									{priceLabel}
								</div>
							)}
						</ItemLink>
					);
				})}
		</div>
	);
}
