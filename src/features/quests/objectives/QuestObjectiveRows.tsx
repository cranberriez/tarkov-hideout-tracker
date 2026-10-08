"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ItemLink } from "@/components/entities/item-link";
import { ItemImage } from "@/components/entities/item-image";
import { ItemThumbnail } from "@/components/entities/item-thumbnail";
import { Badge } from "@/components/ui/badge";
import type { FullQuestObjective, QuestObjectiveItemType, QuestObjectiveShootType } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
import { QuestObjectiveIcon } from "./QuestObjectiveIcon";
import { useQuestActions } from "../QuestActionsContext";

function isItemObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
	return (o.type === "giveItem" || o.type === "findItem" || o.type === "plantItem") && "itemIds" in o;
}

export function isQuestItemDemandObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
	return (o.type === "giveItem" || o.type === "plantItem") && "itemIds" in o;
}

function isShootObjective(o: FullQuestObjective): o is QuestObjectiveShootType {
	return o.type === "shoot" && "target" in o;
}

function getRequiredKeyGroups(
	objective: FullQuestObjective,
	itemById: Readonly<Record<string, ItemSummary>>,
): ItemSummary[][] {
	return (objective.requiredKeyIds ?? [])
		.map((group) => group.map((id) => itemById[id]).filter(Boolean))
		.filter((group) => group.length > 0);
}

export function hasRequiredKeys(objective: FullQuestObjective) {
	return (objective.requiredKeyIds ?? []).some((group) => group.length > 0);
}

function RequiredKeysList({ groups, large = false }: { groups: ItemSummary[][]; large?: boolean }) {
	if (groups.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-1.5 pt-0.5">
			<span
				className={
					large
						? "text-xs font-medium uppercase text-subtle-foreground"
						: "text-[10px] font-medium uppercase text-subtle-foreground"
				}
			>
				Required keys
			</span>
			{groups.map((group, groupIndex) => (
				<div key={`required-key-group-${groupIndex}`} className="contents">
					{groupIndex > 0 && <span className="text-[10px] text-subtle-foreground">or</span>}
					{group.map((key) => (
						<ItemLink
							key={key.id}
							item={key}
							className={`inline-flex items-stretch overflow-hidden rounded border border-highlight/10 bg-shadow/35 leading-snug text-foreground transition-colors hover:border-highlight/25 focus-visible:outline-2 focus-visible:outline-brand ${large ? "min-h-7 text-xs" : "min-h-5 text-[11px]"}`}
						>
							<ItemThumbnail item={key} size={large ? "sm" : "xs"} className="self-center" />
							<span className={`self-center ${large ? "px-2.5" : "px-2"}`}>{key.name}</span>
						</ItemLink>
					))}
				</div>
			))}
		</div>
	);
}

interface ObjectiveRowProps {
	objective: FullQuestObjective;
	itemDisplay?: "compact" | "rows";
	showItems?: boolean;
	objectiveCompletion?: {
		completed: boolean;
		onToggle: () => void;
	};
}

const WORKSPACE_ITEM_PREVIEW_LIMIT = 10;
const COMPACT_ITEM_PREVIEW_LIMIT = 15;

export function ObjectiveRow({
	objective,
	itemDisplay = "compact",
	showItems = true,
	objectiveCompletion,
}: ObjectiveRowProps) {
	const [showAllItems, setShowAllItems] = useState(false);
	const { itemById } = useQuestActions();
	const item = isItemObjective(objective) ? objective : null;
	const shoot = isShootObjective(objective) ? objective : null;
	const standardItems = item?.itemIds.map((id) => itemById[id]).filter(Boolean) ?? [];
	const questSpecificItems = item?.questSpecificItems ?? [];
	const allObjectiveItems = [...standardItems, ...questSpecificItems];
	const hasItemChoices = !!item && allObjectiveItems.length > 1;
	const isPartialItemList = !!item?.isPartial;
	const compactItems = item
		? isPartialItemList
			? standardItems.slice(0, COMPACT_ITEM_PREVIEW_LIMIT)
			: standardItems
		: [];
	const requiredKeyGroups = getRequiredKeyGroups(objective, itemById);
	const questItem =
		(objective.type === "pickupQuestItem" || objective.type === "findQuestItem") && "questItem" in objective
			? objective.questItem
			: null;
	const rowItems = item ? allObjectiveItems : questItem ? [questItem] : [];
	const visibleRowItems = showAllItems ? rowItems : rowItems.slice(0, WORKSPACE_ITEM_PREVIEW_LIMIT);
	const hiddenRowItemCount = Math.max(0, rowItems.length - WORKSPACE_ITEM_PREVIEW_LIMIT);

	return (
		<div className="flex items-start gap-2">
			<div className="flex items-start gap-1">
				<QuestObjectiveIcon type={objective.type} size={itemDisplay === "rows" ? 15 : 13} className="mt-[3px]" />
				{objective?.count &&
					(objective.type === "shoot" || objective.type === "skill" || objective.type === "playerLevel") && (
						<span>{objective.count}</span>
					)}
			</div>
			<div className="flex-1 min-w-0 space-y-1">
				<div className="flex items-start justify-between gap-3">
					<p
						className={
							objectiveCompletion?.completed
								? "text-sm leading-relaxed text-subtle-foreground line-through decoration-highlight/20"
								: itemDisplay === "rows"
									? "text-sm leading-relaxed text-foreground"
									: "text-xs leading-snug text-foreground"
						}
					>
						{objective.description}
					</p>
					{objectiveCompletion && (
						<button
							type="button"
							aria-pressed={objectiveCompletion.completed}
							aria-label={`${objectiveCompletion.completed ? "Undo completion of" : "Complete"} objective: ${objective.description}`}
							onClick={(event) => {
								event.stopPropagation();
								objectiveCompletion.onToggle();
							}}
							className={
								objectiveCompletion.completed
									? "shrink-0 border border-success/25 bg-success/8 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-success/75 transition-colors hover:border-highlight/25 hover:text-foreground"
									: "shrink-0 border border-highlight/12 bg-shadow/25 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground transition-colors hover:border-brand/40 hover:text-brand"
							}
						>
							{objectiveCompletion.completed ? "Undo" : "Complete"}
						</button>
					)}
				</div>
				{shoot && shoot.bodyParts.length > 0 && (
					<div className="flex flex-wrap gap-1">
						{shoot.bodyParts.map((part) => (
							<span
								key={part}
								className="text-[10px] text-subtle-foreground border border-highlight/10 bg-shadow/30 px-1.5 py-0.5 rounded"
							>
								{part}
							</span>
						))}
					</div>
				)}
				<RequiredKeysList groups={requiredKeyGroups} large={itemDisplay === "rows"} />
				{itemDisplay === "compact" && item && allObjectiveItems.length > 0 && (
					<div
						className={
							hasItemChoices
								? "space-y-2 rounded-md border border-highlight/12 bg-highlight/4 px-2.5 py-2.5"
								: "flex flex-wrap gap-1.5"
						}
					>
						{hasItemChoices && (
							<div className="flex items-center gap-1.5 text-[11px] text-subtle-foreground">
								<span>
									{isPartialItemList ? `${item.count} of any qualifying item` : `${item.count} of any of these`}
								</span>
								{item.foundInRaid && (
									<span className="rounded border border-fir/30 bg-fir/10 px-1.5 py-0.5 text-[9px] font-medium text-fir">
										FiR
									</span>
								)}
								{isPartialItemList && (
									<span className="rounded border border-info/30 bg-info/10 px-1.5 py-0.5 text-[9px] font-medium text-info">
										Showing {compactItems.length} of {item.totalItemCount}
									</span>
								)}
							</div>
						)}
						{(objective.type === "giveItem" || objective.type === "plantItem") && standardItems.length > 0 && (
							<div className="flex flex-wrap gap-1.5">
								{compactItems.map((itm) => (
									<ItemLink
										key={itm.id}
										item={itm}
										className="flex items-center gap-1.5 rounded border border-highlight/10 bg-shadow/40 px-2 py-1 transition-colors hover:border-highlight/25 focus-visible:outline-2 focus-visible:outline-brand"
									>
										<ItemThumbnail
											item={itm}
											size="xs"
											className={item.foundInRaid ? "rounded-sm ring-1 ring-fir" : undefined}
										/>
										<span className="text-[11px] text-foreground">{itm.name}</span>
										{!hasItemChoices && <span className="text-[11px] text-subtle-foreground">x{item.count}</span>}
										{!hasItemChoices && item.foundInRaid && (
											<Badge tone="fir" size="xs">
												FiR
											</Badge>
										)}
									</ItemLink>
								))}
							</div>
						)}
					</div>
				)}
				{itemDisplay === "rows" && showItems && rowItems.length > 0 && (
					<div className="pt-2">
						{item && hasItemChoices && (
							<div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-subtle-foreground">
								<span>{item.count} of any qualifying item</span>
								{item.foundInRaid && <span className="text-fir">Found in raid</span>}
							</div>
						)}
						<div className="flex flex-wrap gap-2.5">
							{visibleRowItems.map((rowItem) => {
								// Quest-specific pickups are display-only: no inventory, pricing, or item page.
								const isQuestSpecific = "source" in rowItem && rowItem.source === "questSpecific";
								return (
									<ItemImage
										key={rowItem.id}
										size="md"
										opensModal={!isQuestSpecific}
										item={rowItem}
										framed
										foundInRaid={item?.foundInRaid}
										quantity={hasItemChoices ? undefined : (item?.count ?? objective.count ?? 1)}
									/>
								);
							})}
							{hiddenRowItemCount > 0 && (
								<button
									type="button"
									onClick={() => setShowAllItems((expanded) => !expanded)}
									className="flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-highlight/[0.035] px-3 py-2 text-xs font-medium text-subtle-foreground transition-colors hover:bg-highlight/[0.07] hover:text-foreground"
								>
									{showAllItems ? (
										<>
											<ChevronUp size={12} />
											Show first {WORKSPACE_ITEM_PREVIEW_LIMIT} items
										</>
									) : (
										<>
											<ChevronDown size={12} />+{hiddenRowItemCount} more items
										</>
									)}
								</button>
							)}
						</div>
					</div>
				)}
			</div>
			{objective.optional && (
				<span className="mt-0.5 shrink-0 rounded bg-info/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-info/90">
					opt
				</span>
			)}
		</div>
	);
}
