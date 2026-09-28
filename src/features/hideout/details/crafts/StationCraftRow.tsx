"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { QuestLink } from "@/components/entities/quest-link";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import type { RecipeEvaluation } from "@/lib/price-calculation";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/format-time";
import { formatCompactRoubles } from "@/lib/utils/market-price";
import type { ProfitPageData } from "@/types/contracts";
import type { ItemSummary } from "@/types/items";
import type { CraftRecord } from "@/types/recipes";
import { CraftItem } from "./CraftItem";
import type { CraftLock } from "./station-crafts-model";
import type { CraftProfitStatus } from "./useStationCraftEvaluations";

function signedRoubles(value: number) {
	const sign = value > 0 ? "+" : value < 0 ? "−" : "";
	return `${sign}${formatCompactRoubles(Math.abs(value))} ₽`;
}

/** Label-over-value column; fixed widths keep Time, Profit and Per hour aligned across rows. */
function Metric({
	label,
	children,
	className,
	title,
}: {
	label: string;
	children: ReactNode;
	className?: string;
	title?: string;
}) {
	return (
		<span className="flex w-20 flex-col items-end gap-0.5" title={title}>
			<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
			<span className={cn("font-mono text-sm font-semibold leading-none", className)}>{children}</span>
		</span>
	);
}

function profitMetric(label: string, value: number | null | undefined, status: CraftProfitStatus, reason: string | null) {
	return (
		<Metric
			label={label}
			title={value == null && status !== "loading" ? (reason ?? "Some prices are missing.") : undefined}
			className={
				value == null
					? "text-muted-foreground"
					: value > 0
						? "text-success"
						: value < 0
							? "text-danger"
							: "text-foreground"
			}
		>
			{status === "loading" ? "…" : value == null ? "—" : signedRoubles(value)}
		</Metric>
	);
}

export function StationCraftRow({
	craft,
	evaluation,
	itemsById,
	lock,
	status,
	unavailableReason,
	taskUnlocksById,
}: {
	craft: CraftRecord;
	evaluation: RecipeEvaluation | undefined;
	itemsById: Readonly<Record<string, ItemSummary>>;
	lock: CraftLock;
	status: CraftProfitStatus;
	unavailableReason: string | null;
	taskUnlocksById: ProfitPageData["taskUnlocksById"];
}) {
	return (
		<li className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0 xl:flex-row xl:items-center xl:gap-6 xl:py-0">
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
				<div className="flex flex-wrap items-center gap-2">
					{craft.requiredItems.map((requirement) => (
						<CraftItem key={`${craft.id}-${requirement.itemId}`} amount={requirement} item={itemsById[requirement.itemId]} />
					))}
				</div>
				<ArrowRight size={16} aria-hidden="true" className="text-muted-foreground" />
				<CraftItem
					amount={{ itemId: craft.productItemId, count: craft.productCount }}
					item={itemsById[craft.productItemId]}
					showName
				/>
			</div>
			<div className="flex items-center gap-3">
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 xl:w-32 xl:flex-none">
					{lock?.kind === "station" && (
						<Badge size="xs" tone="neutral">
							Needs L{lock.level}
						</Badge>
					)}
					{lock?.kind === "quest" && (
						<Badge size="xs" tone="warning" className="max-w-full truncate">
							<QuestLink questId={lock.questId} name={taskUnlocksById[lock.questId]?.name ?? "Quest unlock"} />
						</Badge>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Metric label="Time" className="text-foreground">
						{formatDuration(evaluation?.durationSeconds ?? craft.duration)}
					</Metric>
					{profitMetric("Profit", evaluation?.profit, status, unavailableReason)}
					{profitMetric("Per hour", evaluation?.profitPerHour, status, unavailableReason)}
					<Link
						href={`/items/crafting-profits?recipe=${encodeURIComponent(craft.id)}`}
						className={buttonClassName({ variant: "ghost", size: "sm", iconOnly: true })}
						aria-label="Open in Crafting Profits"
						title="Open in Crafting Profits"
					>
						<ExternalLink size={14} />
					</Link>
				</div>
			</div>
		</li>
	);
}
