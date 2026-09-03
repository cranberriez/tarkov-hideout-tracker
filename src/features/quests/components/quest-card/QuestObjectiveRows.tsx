"use client";

import { useState } from "react";
import {
    ChevronDown,
    ChevronUp,
    Package,
} from "lucide-react";
import type { FullQuestObjective, QuestObjectiveItemType, QuestObjectiveShootType } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
import { QuestObjectiveIcon } from "../QuestObjectiveIcon";
import { useQuestsContext } from "../../QuestsContext";

function isItemObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
    return (
        (o.type === "giveItem" || o.type === "findItem" || o.type === "plantItem") &&
        "itemIds" in o
    );
}

export function isQuestItemDemandObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
    return (
        (o.type === "giveItem" || o.type === "plantItem") &&
        "itemIds" in o
    );
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
            <span className={large ? "text-xs font-medium uppercase text-gray-600" : "text-[10px] font-medium uppercase text-gray-600"}>
                Required keys
            </span>
            {groups.map((group, groupIndex) => (
                <div
                    key={`required-key-group-${groupIndex}`}
                    className="contents"
                >
                    {groupIndex > 0 && (
                        <span className="text-[10px] text-gray-600">or</span>
                    )}
                    {group.map((key) => (
                        <span
                            key={key.id}
                            className={`inline-flex items-stretch overflow-hidden rounded border border-white/10 bg-black/35 leading-snug text-gray-200 ${large ? "min-h-7 text-xs" : "min-h-5 text-[11px]"}`}
                        >
                            {(key.iconLink ?? key.gridImageLink) && (
                                <img
                                    src={key.iconLink ?? key.gridImageLink ?? ""}
                                    alt=""
                                    className={large ? "h-7 w-7 shrink-0 self-center object-contain" : "h-5 w-5 shrink-0 self-center object-contain"}
                                />
                            )}
                            <span className={`self-center ${large ? "px-2.5" : "px-2"}`}>{key.name}</span>
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

interface ObjectiveRowProps {
    objective: FullQuestObjective;
    onItemClick?: (itemId: string) => void;
    itemDisplay?: "compact" | "rows";
    showItems?: boolean;
    objectiveCompletion?: {
        completed: boolean;
        onToggle: () => void;
    };
}

const WORKSPACE_ITEM_PREVIEW_LIMIT = 10;
const COMPACT_ITEM_PREVIEW_LIMIT = 15;

export function ObjectiveRow({ objective, onItemClick, itemDisplay = "compact", showItems = true, objectiveCompletion }: ObjectiveRowProps) {
    const [showAllItems, setShowAllItems] = useState(false);
    const { itemById } = useQuestsContext();
    const item = isItemObjective(objective) ? objective : null;
    const shoot = isShootObjective(objective) ? objective : null;
    const standardItems = item?.itemIds.map((id) => itemById[id]).filter(Boolean) ?? [];
    const questSpecificItems = item?.questSpecificItems ?? [];
    const allObjectiveItems = [...standardItems, ...questSpecificItems];
    const hasItemChoices = !!item && allObjectiveItems.length > 1;
    const isPartialItemList = !!item?.isPartial;
    const compactItems = item
        ? (isPartialItemList ? standardItems.slice(0, COMPACT_ITEM_PREVIEW_LIMIT) : standardItems)
        : [];
    const requiredKeyGroups = getRequiredKeyGroups(objective, itemById);
    const questItem = (objective.type === "pickupQuestItem" || objective.type === "findQuestItem") && "questItem" in objective
        ? objective.questItem
        : null;
    const rowItems = item ? allObjectiveItems : (questItem ? [questItem] : []);
    const visibleRowItems = showAllItems ? rowItems : rowItems.slice(0, WORKSPACE_ITEM_PREVIEW_LIMIT);
    const hiddenRowItemCount = Math.max(0, rowItems.length - WORKSPACE_ITEM_PREVIEW_LIMIT);

    return (
        <div className="flex items-start gap-2">
            <div className="flex items-start gap-1">
                <QuestObjectiveIcon type={objective.type} size={itemDisplay === "rows" ? 15 : 13} className="mt-[3px]" />
                {objective?.count &&
                    (objective.type === "shoot" ||
                        objective.type === "skill" ||
                        objective.type === "playerLevel") && <span>{objective.count}</span>}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-3">
                    <p className={objectiveCompletion?.completed
                        ? "text-sm leading-relaxed text-gray-500 line-through decoration-white/20"
                        : itemDisplay === "rows"
                          ? "text-sm leading-relaxed text-gray-200"
                          : "text-xs leading-snug text-gray-300"
                    }>{objective.description}</p>
                    {objectiveCompletion && (
                        <button
                            type="button"
                            aria-pressed={objectiveCompletion.completed}
                            aria-label={`${objectiveCompletion.completed ? "Undo completion of" : "Complete"} objective: ${objective.description}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                objectiveCompletion.onToggle();
                            }}
                            className={objectiveCompletion.completed
                                ? "shrink-0 border border-tarkov-green/25 bg-tarkov-green/8 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-tarkov-green/75 transition-colors hover:border-white/25 hover:text-white"
                                : "shrink-0 border border-white/12 bg-black/25 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-gray-500 transition-colors hover:border-tarkov-green/40 hover:text-tarkov-green"
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
                                className="text-[10px] text-gray-500 border border-white/10 bg-black/30 px-1.5 py-0.5 rounded"
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
                                ? "space-y-2 rounded-md border border-white/12 bg-white/4 px-2.5 py-2.5"
                                : "flex flex-wrap gap-1.5"
                        }
                    >
                        {hasItemChoices && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                <span>
                                    {isPartialItemList
                                        ? `${item.count} of any qualifying item`
                                        : `${item.count} of any of these`}
                                </span>
                                {item.foundInRaid && (
                                    <span className="rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">
                                        FiR
                                    </span>
                                )}
                                {isPartialItemList && (
                                    <span className="rounded border border-blue-400/30 bg-blue-400/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-300">
                                        Showing {compactItems.length} of {item.totalItemCount}
                                    </span>
                                )}
                            </div>
                        )}
                        {(objective.type === "giveItem" || objective.type === "plantItem") && standardItems.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {compactItems.map((itm) => (
                                    <div
                                        key={itm.id}
                                        className={`flex items-center gap-1.5 rounded border border-white/10 bg-black/40 px-2 py-1 ${onItemClick ? "cursor-pointer hover:border-white/25 transition-colors" : ""}`}
                                        onClick={
                                            onItemClick
                                                ? (e) => {
                                                      e.stopPropagation();
                                                      onItemClick(itm.id);
                                                  }
                                                : undefined
                                        }
                                    >
                                        {(itm.iconLink ?? itm.gridImageLink) && (
                                            <span
                                                className={`flex h-6 w-6 items-center justify-center rounded-sm bg-black/35 ${
                                                    item.foundInRaid ? "ring-1 ring-orange-500" : ""
                                                }`}
                                            >
                                                <img
                                                    src={itm.iconLink ?? itm.gridImageLink ?? ""}
                                                    alt={itm.name}
                                                    className="h-5 w-5 object-contain"
                                                />
                                            </span>
                                        )}
                                        <span className="text-[11px] text-gray-200">
                                            {itm.name}
                                        </span>
                                        {!hasItemChoices && (
                                            <span className="text-[11px] text-gray-500">
                                                x{item.count}
                                            </span>
                                        )}
                                        {!hasItemChoices && item.foundInRaid && (
                                            <span className="text-[9px] text-orange-400 font-medium">
                                                FiR
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {itemDisplay === "rows" && showItems && rowItems.length > 0 && (
                    <div className="pt-2">
                        {item && hasItemChoices && (
                            <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span>{item.count} of any qualifying item</span>
                                {item.foundInRaid && <span className="text-orange-400">Found in raid</span>}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2.5">
                            {visibleRowItems.map((rowItem) => {
                                const content = (
                                    <>
                                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center border bg-black/35 ${item?.foundInRaid ? "border-orange-500/65" : "border-white/15"}`}>
                                            {(rowItem.iconLink ?? rowItem.gridImageLink) ? <img src={rowItem.iconLink ?? rowItem.gridImageLink ?? ""} alt="" className="h-11 w-11 object-contain" /> : <Package size={17} className="text-gray-700" />}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col justify-center px-2.5">
                                            <span className="truncate text-xs text-gray-100">{rowItem.name}</span>
                                            {item?.foundInRaid && <span className="mt-0.5 text-[9px] font-semibold uppercase text-orange-400">FiR</span>}
                                        </span>
                                        {!hasItemChoices && <span className="shrink-0 pr-2.5 text-xs text-gray-500">x{item?.count ?? objective.count ?? 1}</span>}
                                    </>
                                );
                                const isQuestSpecific = "source" in rowItem && rowItem.source === "questSpecific";
                                return onItemClick && !isQuestSpecific ? (
                                    <button key={rowItem.id} type="button" onClick={(event) => { event.stopPropagation(); onItemClick(rowItem.id); }} className="flex min-w-[13rem] max-w-xs flex-[1_1_14rem] items-center border border-white/10 bg-black/20 text-left transition-colors hover:border-white/25 hover:bg-white/4">
                                        {content}
                                    </button>
                                ) : (
                                    <div key={rowItem.id} className="flex min-w-[13rem] max-w-xs flex-[1_1_14rem] items-center border border-white/10 bg-black/20">{content}</div>
                                );
                            })}
                            {hiddenRowItemCount > 0 && (
                                <button type="button" onClick={() => setShowAllItems((expanded) => !expanded)} className="flex min-h-11 min-w-[13rem] flex-[1_1_14rem] items-center justify-center gap-1.5 rounded-md bg-white/[0.035] px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-white/[0.07] hover:text-gray-300">
                                    {showAllItems ? <><ChevronUp size={12} />Show first {WORKSPACE_ITEM_PREVIEW_LIMIT} items</> : <><ChevronDown size={12} />+{hiddenRowItemCount} more items</>}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {objective.optional && (
                <span className="mt-0.5 shrink-0 rounded bg-sky-400/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300/90">
                    opt
                </span>
            )}
        </div>
    );
}

