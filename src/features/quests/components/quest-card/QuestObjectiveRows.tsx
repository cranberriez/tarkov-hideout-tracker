"use client";

import { useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Crosshair,
    DoorOpen,
    Hammer,
    MapPin,
    Package,
    Search,
    Zap,
} from "lucide-react";
import type {
    FullQuestObjective,
    QuestItem,
    QuestObjectiveItemType,
    QuestObjectiveShootType,
} from "@/types";

function isItemObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
    return (
        (o.type === "giveItem" || o.type === "findItem" || o.type === "plantItem") &&
        "items" in o
    );
}

export function isQuestItemDemandObjective(o: FullQuestObjective): o is QuestObjectiveItemType {
    return (
        (o.type === "giveItem" || o.type === "plantItem") &&
        "items" in o
    );
}

function isShootObjective(o: FullQuestObjective): o is QuestObjectiveShootType {
    return o.type === "shoot" && "target" in o;
}

function getRequiredKeyGroups(objective: FullQuestObjective): QuestItem[][] {
    return (objective.requiredKeys ?? [])
        .map((group) => group.filter((key) => key?.id && key.name))
        .filter((group) => group.length > 0);
}

export function hasRequiredKeys(objective: FullQuestObjective) {
    return getRequiredKeyGroups(objective).length > 0;
}

function ObjectiveIcon({ type, size = 13 }: { type: string; size?: number }) {
    const cls = "shrink-0 mt-0.5";
    switch (type) {
        case "giveItem":
        case "plantItem":
            return <Package size={size} className={`${cls} text-tarkov-green/60`} />;
        case "findItem":
            return <Search size={size} className={`${cls} text-blue-400/60`} />;
        case "shoot":
            return <Crosshair size={size} className={`${cls} text-red-400/60`} />;
        case "extract":
            return <DoorOpen size={size} className={`${cls} text-yellow-400/60`} />;
        case "visit":
        case "mark":
        case "locate":
            return <MapPin size={size} className={`${cls} text-purple-400/60`} />;
        case "buildItem":
            return <Hammer size={size} className={`${cls} text-orange-400/60`} />;
        case "skill":
        case "playerLevel":
            return <Zap size={size} className={`${cls} text-cyan-400/60`} />;
        default:
            return <ChevronRight size={size} className={`${cls} text-gray-600`} />;
    }
}

function RequiredKeysList({ groups, large = false }: { groups: QuestItem[][]; large?: boolean }) {
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
                            className={`inline-flex items-center rounded border border-white/10 bg-black/35 leading-snug text-gray-200 ${large ? "min-h-9 gap-2 px-3 py-1.5 text-xs" : "min-h-7 gap-1.5 px-2 py-1 text-[11px]"}`}
                        >
                            {(key.iconLink ?? key.gridImageLink) && (
                                <img
                                    src={key.iconLink ?? key.gridImageLink ?? ""}
                                    alt=""
                                    className={large ? "h-7 w-7 shrink-0 object-contain" : "h-5 w-5 shrink-0 object-contain"}
                                />
                            )}
                            {key.name}
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
}

const WORKSPACE_ITEM_PREVIEW_LIMIT = 10;
const COMPACT_ITEM_PREVIEW_LIMIT = 15;

export function ObjectiveRow({ objective, onItemClick, itemDisplay = "compact", showItems = true }: ObjectiveRowProps) {
    const [showAllItems, setShowAllItems] = useState(false);
    const item = isItemObjective(objective) ? objective : null;
    const shoot = isShootObjective(objective) ? objective : null;
    const hasItemChoices = !!item && item.items.length > 1;
    const isPartialItemList = !!item?.isPartial;
    const compactItems = item
        ? (isPartialItemList ? item.items.slice(0, COMPACT_ITEM_PREVIEW_LIMIT) : item.items)
        : [];
    const requiredKeyGroups = getRequiredKeyGroups(objective);
    const questItem = (objective.type === "pickupQuestItem" || objective.type === "findQuestItem") && "questItem" in objective
        ? objective.questItem
        : null;
    const rowItems = item?.items ?? (questItem ? [questItem] : []);
    const visibleRowItems = showAllItems ? rowItems : rowItems.slice(0, WORKSPACE_ITEM_PREVIEW_LIMIT);
    const hiddenRowItemCount = Math.max(0, rowItems.length - WORKSPACE_ITEM_PREVIEW_LIMIT);

    return (
        <div className={`flex items-start gap-2 ${objective.optional ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-1">
                <ObjectiveIcon type={objective.type} size={itemDisplay === "rows" ? 15 : 13} />
                {objective?.count &&
                    (objective.type === "shoot" ||
                        objective.type === "skill" ||
                        objective.type === "playerLevel") && <span>{objective.count}</span>}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
                <p className={itemDisplay === "rows" ? "text-sm leading-relaxed text-gray-200" : "text-xs leading-snug text-gray-300"}>{objective.description}</p>
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
                {itemDisplay === "compact" && item && item.items.length > 0 && (
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
                        {(objective.type === "giveItem" || objective.type === "plantItem") && (
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
                        <div className="overflow-hidden rounded-sm border border-white/10 bg-black/20">
                            {visibleRowItems.map((rowItem) => {
                                const content = (
                                    <>
                                        <span className={`flex h-13 w-13 shrink-0 items-center justify-center bg-black/35 ${item?.foundInRaid ? "ring-1 ring-inset ring-orange-500/55" : ""}`}>
                                            {(rowItem.iconLink ?? rowItem.gridImageLink) ? <img src={rowItem.iconLink ?? rowItem.gridImageLink ?? ""} alt="" className="h-11 w-11 object-contain" /> : <Package size={17} className="text-gray-700" />}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-sm text-gray-100">{rowItem.name}</span>
                                        {!hasItemChoices && <span className="shrink-0 text-xs text-gray-500">x{item?.count ?? objective.count ?? 1}</span>}
                                        {item?.foundInRaid && <span className="shrink-0 text-[10px] font-semibold uppercase text-orange-400">FiR</span>}
                                    </>
                                );
                                return onItemClick ? (
                                    <button key={rowItem.id} type="button" onClick={(event) => { event.stopPropagation(); onItemClick(rowItem.id); }} className="flex w-full items-center gap-3.5 border-b border-white/7 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-white/4">
                                        {content}
                                    </button>
                                ) : (
                                    <div key={rowItem.id} className="flex items-center gap-3.5 border-b border-white/7 px-3.5 py-2.5 last:border-b-0">{content}</div>
                                );
                            })}
                            {hiddenRowItemCount > 0 && (
                                <button type="button" onClick={() => setShowAllItems((expanded) => !expanded)} className="flex w-full items-center justify-center gap-1.5 border-t border-white/7 px-3 py-3 text-xs font-medium text-gray-500 transition-colors hover:bg-white/4 hover:text-gray-300">
                                    {showAllItems ? <><ChevronUp size={12} />Show first {WORKSPACE_ITEM_PREVIEW_LIMIT} items</> : <><ChevronDown size={12} />+{hiddenRowItemCount} more items</>}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {objective.optional && (
                <span className="text-[9px] text-gray-600 border border-white/5 px-1 py-0.5 rounded mt-0.5 shrink-0">
                    opt
                </span>
            )}
        </div>
    );
}

