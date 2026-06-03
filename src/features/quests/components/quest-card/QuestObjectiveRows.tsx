"use client";

import {
    ChevronRight,
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

function ObjectiveIcon({ type }: { type: string }) {
    const cls = "shrink-0 mt-0.5";
    switch (type) {
        case "giveItem":
        case "plantItem":
            return <Package size={13} className={`${cls} text-tarkov-green/60`} />;
        case "findItem":
            return <Search size={13} className={`${cls} text-blue-400/60`} />;
        case "shoot":
            return <Crosshair size={13} className={`${cls} text-red-400/60`} />;
        case "extract":
            return <DoorOpen size={13} className={`${cls} text-yellow-400/60`} />;
        case "visit":
        case "mark":
        case "locate":
            return <MapPin size={13} className={`${cls} text-purple-400/60`} />;
        case "buildItem":
            return <Hammer size={13} className={`${cls} text-orange-400/60`} />;
        case "skill":
        case "playerLevel":
            return <Zap size={13} className={`${cls} text-cyan-400/60`} />;
        default:
            return <ChevronRight size={13} className={`${cls} text-gray-600`} />;
    }
}

function RequiredKeysList({ groups }: { groups: QuestItem[][] }) {
    if (groups.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-medium uppercase text-gray-600">
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
                            className="inline-flex min-h-7 items-center gap-1.5 rounded border border-white/10 bg-black/35 px-2 py-1 text-[11px] leading-snug text-gray-200"
                        >
                            {(key.iconLink ?? key.gridImageLink) && (
                                <img
                                    src={key.iconLink ?? key.gridImageLink ?? ""}
                                    alt=""
                                    className="h-5 w-5 shrink-0 object-contain"
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
}

export function ObjectiveRow({ objective, onItemClick }: ObjectiveRowProps) {
    const item = isItemObjective(objective) ? objective : null;
    const shoot = isShootObjective(objective) ? objective : null;
    const hasItemChoices = !!item && item.items.length > 1;
    const isPartialItemList = !!item?.isPartial;
    const requiredKeyGroups = getRequiredKeyGroups(objective);

    return (
        <div className={`flex items-start gap-2 ${objective.optional ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-1">
                <ObjectiveIcon type={objective.type} />
                {objective?.count &&
                    (objective.type === "shoot" ||
                        objective.type === "skill" ||
                        objective.type === "playerLevel") && <span>{objective.count}</span>}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-gray-300 leading-snug">{objective.description}</p>
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
                <RequiredKeysList groups={requiredKeyGroups} />
                {item && item.items.length > 0 && (
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
                                        Showing {item.items.length} of {item.totalItemCount}
                                    </span>
                                )}
                            </div>
                        )}
                        {(objective.type === "giveItem" || objective.type === "plantItem") && (
                            <div className="flex flex-wrap gap-1.5">
                                {item.items.map((itm) => (
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
            </div>
            {objective.optional && (
                <span className="text-[9px] text-gray-600 border border-white/5 px-1 py-0.5 rounded mt-0.5 shrink-0">
                    opt
                </span>
            )}
        </div>
    );
}

