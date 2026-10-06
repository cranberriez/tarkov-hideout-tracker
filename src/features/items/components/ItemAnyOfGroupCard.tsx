"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { ItemSize } from "@/lib/stores/useUserStore";
import type { ItemSummary } from "@/types/items";
import type { DerivedQuestAnyOfGroup } from "@/lib/quests/quest-item-index";
import { cn } from "@/lib/utils";
import { ItemLink } from "@/components/entities/item-link";
import { QuestLink } from "@/components/entities/quest-link";
import { itemImageUrl } from "@/lib/utils/item-images";

const MAX_PREVIEW_ITEMS = 3;

type AnyOfGroupItem = ItemSummary;

interface ItemAnyOfGroupCardProps {
	group: DerivedQuestAnyOfGroup;
	items: ItemSummary[];
	expanded: boolean;
	size: ItemSize;
	onToggleExpanded: () => void;
}

interface ItemPreviewStackProps {
	items: AnyOfGroupItem[];
	previewIndex: number;
	expanded: boolean;
	isIconMode: boolean;
	isFirRequired: boolean;
}

interface GroupHeaderProps {
	group: DerivedQuestAnyOfGroup;
	expanded: boolean;
	isIconMode: boolean;
	showToggle?: boolean;
}

interface GroupItemsGridProps {
	items: AnyOfGroupItem[];
	isFirRequired: boolean;
	previewItems: boolean;
}

function ItemImage({ item, className }: { item: AnyOfGroupItem; className: string }) {
	return <img src={itemImageUrl(item)} alt={item.name} className={cn("object-contain", className)} />;
}

function ItemPreviewStack({ items, previewIndex, expanded, isIconMode, isFirRequired }: ItemPreviewStackProps) {
	return (
		<div className={cn("relative flex shrink-0 items-center justify-center", isIconMode ? "h-12 w-16" : "h-10 w-14")}>
			{items.map((item, index) => {
				const isActive = expanded || index === previewIndex;
				const layerClass = isActive ? "z-40" : index === 0 ? "z-10" : index === 1 ? "z-20" : "z-30";

				return (
					<div
						key={item.id}
						className={cn(
							"absolute flex items-center justify-center rounded border bg-shadow/40 transition-all duration-200",
							isFirRequired ? "border-fir/35" : "border-highlight/10",
							isIconMode ? "size-12" : "size-10",
							layerClass,
							index === 0 && "-translate-x-2 rotate-[-4deg]",
							index === 1 && "translate-x-0",
							index === 2 && "translate-x-2 rotate-[4deg]",
							isActive ? "opacity-100" : "opacity-35",
						)}
					>
						<ItemImage item={item} className={isIconMode ? "size-11" : "size-9"} />
					</div>
				);
			})}
		</div>
	);
}

function GroupHeader({ group, expanded, isIconMode, showToggle = true }: GroupHeaderProps) {
	return (
		<div className="min-w-0 flex-1">
			<div className="flex items-start justify-between gap-2">
				<div className="flex flex-col min-w-0 flex-1">
					<h3
						className={cn(
							"leading-tight font-bold text-balance line-clamp-2 text-foreground",
							isIconMode ? "line-clamp-2 text-xs" : "text-sm",
						)}
						title={group.questName}
					>
						{group.questName}
					</h3>

					<QuestLink
						questId={group.questId}
						name={group.questName}
						className="inline-flex w-fit items-center gap-1 text-xs text-subtle-foreground transition-colors hover:text-brand"
						onClick={(e) => e.stopPropagation()}
					>
						Quest
						<ExternalLink size={12} />
					</QuestLink>
				</div>

				{showToggle && (
					<span className="shrink-0 text-subtle-foreground">
						{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
					</span>
				)}
			</div>
		</div>
	);
}

function RequirementSummary({
	group,
	isFirRequired,
	stacked = false,
}: {
	group: DerivedQuestAnyOfGroup;
	isFirRequired: boolean;
	stacked?: boolean;
}) {
	return (
		<span className={cn("flex shrink-0 font-medium items-center gap-2", stacked ? "flex-col items-start gap-1" : "")}>
			<p className="flex items-center gap-2">
				<span className="text-foreground tabular-nums">{group.requiredCount}x</span>
				{isFirRequired && <span className="text-fir">FiR</span>}
			</p>
			{group.isPartial && (
				<span className="rounded border border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-medium text-info">
					Partial
				</span>
			)}
		</span>
	);
}

function ObjectiveLabelRow({
	group,
	isIconMode,
	isFirRequired,
}: {
	group: DerivedQuestAnyOfGroup;
	isIconMode: boolean;
	isFirRequired: boolean;
}) {
	return (
		<div
			className={cn(
				"flex w-full items-start justify-between gap-3 text-pretty text-muted-foreground",
				isIconMode ? "text-[11px] leading-snug" : "text-xs",
			)}
		>
			<RequirementSummary group={group} isFirRequired={isFirRequired} />
			<span className="min-w-0 flex-1">{group.objectiveLabel}</span>
		</div>
	);
}

function GroupItemsGrid({ items, isFirRequired, previewItems }: GroupItemsGridProps) {
	return (
		<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{items.map((item) => (
				<ItemLink
					key={item.id}
					item={item}
					preview={previewItems}
					className="flex items-center gap-3 rounded-md border border-highlight/10 bg-shadow/20 p-2 text-left transition-colors hover:border-info focus-visible:outline-2 focus-visible:outline-brand"
				>
					<div
						className={cn(
							"flex size-10 shrink-0 items-center justify-center rounded border bg-shadow/40",
							isFirRequired ? "border-fir/35" : "border-highlight/10",
						)}
					>
						<ItemImage item={item} className="size-8" />
					</div>

					<div className="min-w-0">
						<div className="line-clamp-2 text-sm text-foreground">{item.name}</div>
					</div>
				</ItemLink>
			))}
		</div>
	);
}

export function ItemAnyOfGroupCard({ group, items, expanded, size, onToggleExpanded }: ItemAnyOfGroupCardProps) {
	const previewItems = useMemo(() => items.slice(0, MAX_PREVIEW_ITEMS), [items]);
	const [previewIndex, setPreviewIndex] = useState(0);
	const isIconMode = size === "Icon";
	const isFirRequired = group.requiredFirCount > 0;

	useEffect(() => {
		if (previewItems.length <= 1 || expanded) return;
		const interval = window.setInterval(() => {
			setPreviewIndex((current) => (current + 1) % previewItems.length);
		}, 1600);
		return () => window.clearInterval(interval);
	}, [expanded, previewItems.length]);

	return (
		<div
			className={cn(
				"rounded-lg border bg-card p-3 transition-colors",
				expanded ? "col-span-full border-info/40" : "hover:border-info",
			)}
		>
			<button
				type="button"
				onClick={onToggleExpanded}
				className={cn(
					"flex w-full flex-col gap-2 text-left",
					expanded ? "" : "h-full justify-between",
					isIconMode ? "" : "gap-2.5",
				)}
			>
				{isIconMode ? (
					<>
						<div className="flex w-full items-start gap-3">
							<ItemPreviewStack
								items={previewItems}
								previewIndex={previewIndex}
								expanded={expanded}
								isIconMode
								isFirRequired={isFirRequired}
							/>
							<div className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
								<RequirementSummary group={group} isFirRequired={isFirRequired} stacked />
							</div>
							<span className="shrink-0 text-subtle-foreground">
								{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
							</span>
						</div>

						<GroupHeader group={group} expanded={expanded} isIconMode showToggle={false} />
					</>
				) : (
					<>
						<div className="flex w-full items-start gap-3">
							<ItemPreviewStack
								items={previewItems}
								previewIndex={previewIndex}
								expanded={expanded}
								isIconMode={false}
								isFirRequired={isFirRequired}
							/>

							<GroupHeader group={group} expanded={expanded} isIconMode={false} />
						</div>

						<ObjectiveLabelRow group={group} isIconMode={false} isFirRequired={isFirRequired} />
					</>
				)}
			</button>

			{expanded && (
				<div className="mt-4 space-y-3 border-t border-highlight/8 pt-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="text-xs text-muted-foreground text-pretty">
							{group.isPartial
								? `Showing ${items.length} of ${group.totalItemCount} qualifying items.`
								: "Any one of these items will satisfy the quest objective."}
						</div>
					</div>

					<GroupItemsGrid items={items} isFirRequired={isFirRequired} previewItems={size === "Expanded"} />
				</div>
			)}
		</div>
	);
}
