"use client";

import type { ItemSummary } from "@/types/items";
import type { NeedBreakdown } from "@/lib/utils/item-needs";
import { ExternalLink, PackageOpen } from "lucide-react";

interface ItemDetailHeaderProps {
	item: ItemSummary;
	headingLevel?: "h1" | "h2";
	totalRequiredCount: number;
	needsBreakdown: NeedBreakdown | null;
	hideoutRequiredCount: number;
	questRequiredCount: number;
}

export function ItemDetailHeader({
	item,
	headingLevel: Heading = "h2",
	totalRequiredCount,
	needsBreakdown,
	hideoutRequiredCount,
	questRequiredCount,
}: ItemDetailHeaderProps) {
	const imageLink = item.image512pxLink ?? item.gridImageLink ?? item.iconLink ?? item.baseImageLink;
	const categoryLabel = item.category?.normalizedName !== "item" ? item.category?.name.replace(/\s+item$/i, "") : null;

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div className="flex min-w-0 items-center gap-3 sm:gap-4">
				<div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-color bg-shadow/30 shadow-inner sm:h-20 sm:w-20">
					{imageLink ? (
						<img src={imageLink} alt={item.name} className="h-full w-full object-contain p-2" />
					) : (
						<PackageOpen className="h-7 w-7 text-muted-foreground" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					{categoryLabel && (
						<div className="mb-1.5 flex flex-wrap gap-1.5">
							<span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-hover">
								{categoryLabel}
							</span>
						</div>
					)}
					<Heading className="text-xl font-semibold leading-tight text-foreground">{item.name}</Heading>
					<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
						{item.wikiLink && (
							<a
								href={item.wikiLink}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 transition-colors hover:text-brand"
							>
								Wiki <ExternalLink size={10} />
							</a>
						)}
						{item.link && (
							<a
								href={item.link}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 transition-colors hover:text-brand"
							>
								Tarkov.dev <ExternalLink size={10} />
							</a>
						)}
					</div>
				</div>
			</div>
			{totalRequiredCount > 0 && (
				<dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1 lg:w-auto lg:min-w-[500px] lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none lg:gap-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border-color lg:bg-shadow/20">
					<SummaryValue label="Required" value={totalRequiredCount} />
					<SummaryValue label="Need" value={needsBreakdown?.neededNonFir ?? 0} accent="green" />
					<SummaryValue label="Need FiR" value={needsBreakdown?.neededFir ?? 0} accent="orange" />
					{hideoutRequiredCount > 0 && <SummaryValue label="Hideout" value={hideoutRequiredCount} />}
					{questRequiredCount > 0 && <SummaryValue label="Quests" value={questRequiredCount} />}
				</dl>
			)}
		</div>
	);
}

function SummaryValue({ label, value, accent }: { label: string; value: number; accent?: "green" | "orange" }) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-1 lg:block lg:border-r lg:border-border-color lg:px-3 lg:py-2.5 lg:last:border-r-0">
			<dt className="text-[11px] text-muted-foreground lg:text-[10px] lg:font-medium lg:uppercase lg:tracking-[0.12em]">{label}</dt>
			<dd
				className={`font-mono text-xs font-semibold lg:mt-0.5 lg:text-base ${
					accent === "green" ? "text-brand" : accent === "orange" ? "text-fir" : "text-foreground"
				}`}
			>
				{value}
			</dd>
		</div>
	);
}
