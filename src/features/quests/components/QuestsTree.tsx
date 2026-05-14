"use client";

import { useState, useMemo, useRef } from "react";
import { useQuestsContext } from "../QuestsContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import { QuestCard, type QuestRef } from "../QuestCard";
import { cn } from "@/lib/utils";
import type { FullQuest } from "@/types";
import { Link2 } from "lucide-react";

function buildTraderTree(traderQuests: FullQuest[]): {
    rootIds: string[];
    childrenOf: Map<string, string[]>;
    parentOf: Map<string, string | null>;
} {
    const indexById = new Map(traderQuests.map((q, i) => [q.id, i]));
    const traderQuestIds = new Set(traderQuests.map((q) => q.id));
    const parentOf = new Map<string, string | null>();

    for (const quest of traderQuests) {
        const sameTraderPrereqs = quest.taskRequirements.filter((r) =>
            traderQuestIds.has(r.task.id),
        );
        if (sameTraderPrereqs.length === 0) {
            parentOf.set(quest.id, null);
        } else {
            // Primary parent = same-trader prereq appearing latest in sorted order (deepest chain)
            const primary = sameTraderPrereqs.reduce((best, r) =>
                (indexById.get(r.task.id) ?? 0) > (indexById.get(best.task.id) ?? 0) ? r : best,
            );
            parentOf.set(quest.id, primary.task.id);
        }
    }

    const childrenOf = new Map<string, string[]>();
    const rootIds: string[] = [];

    for (const [questId, parentId] of parentOf) {
        if (parentId === null) {
            rootIds.push(questId);
        } else {
            const arr = childrenOf.get(parentId) ?? [];
            arr.push(questId);
            childrenOf.set(parentId, arr);
        }
    }

    return { rootIds, childrenOf, parentOf };
}

function toRef(id: string, fallbackName: string, questsById: Map<string, FullQuest>): QuestRef {
    const q = questsById.get(id);
    return {
        id,
        name: q?.name ?? fallbackName,
        trader: q
            ? {
                  imageLink: q.trader.imageLink ?? null,
                  image4xLink: q.trader.image4xLink ?? null,
                  name: q.trader.name,
              }
            : { imageLink: null, image4xLink: null, name: "?" },
    };
}

function countAllDescendants(ids: string[], childrenOf: Map<string, string[]>): number {
    let total = ids.length;
    for (const id of ids) {
        const children = childrenOf.get(id) ?? [];
        if (children.length > 0) total += countAllDescendants(children, childrenOf);
    }
    return total;
}

function getIndentPx(depth: number) {
    if (depth < 8) return 24;
    if (depth < 14) return 16;
    return 12;
}

function getConnectorOffsetPx(depth: number) {
    const indent = getIndentPx(depth);
    return Math.max(12, indent - 4);
}

function LinkedQuestGroup({ questRefs }: { questRefs: QuestRef[] }) {
    return (
        <div className="-mb-2 rounded-t-md border border-white/10 border-b-0 bg-black/30 px-2.5 pt-1.5 pb-3.5">
            <div className="space-y-1">
                {questRefs.map((questRef) => (
                    <a
                        key={questRef.id}
                        href={`#quest-${questRef.id}`}
                        className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500 shrink-0">
                            <Link2 size={11} />
                            Link
                        </span>
                        {(questRef.trader.image4xLink ?? questRef.trader.imageLink) ? (
                            <img
                                src={questRef.trader.image4xLink ?? questRef.trader.imageLink ?? ""}
                                alt={questRef.trader.name}
                                className="w-4 h-4 rounded-full shrink-0 object-cover"
                            />
                        ) : (
                            <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] shrink-0">
                                {questRef.trader.name[0]}
                            </span>
                        )}
                        <span className="text-[10px] text-gray-500 shrink-0">
                            {questRef.trader.name}
                        </span>
                        <span className="min-w-0 truncate">{questRef.name}</span>
                    </a>
                ))}
            </div>
        </div>
    );
}

function CollapseHint({ count, onShow }: { count: number; onShow: () => void }) {
    return (
        <button
            onClick={onShow}
            className="w-full flex items-center gap-2 mt-1 py-1 group text-left"
        >
            <div className="h-px flex-1 bg-white/5 group-hover:bg-white/10 transition-colors" />
            <span className="text-[11px] text-gray-600 group-hover:text-gray-400 transition-colors whitespace-nowrap tracking-wide">
                {count} quest{count !== 1 ? "s" : ""} hidden &middot; SHOW
            </span>
            <div className="h-px flex-1 bg-white/5 group-hover:bg-white/10 transition-colors" />
        </button>
    );
}

// How far from the child-wrapper top the horizontal connector sits (≈ card header mid-point).
// Cards have py-2.5 (10px) + ~22px of content ≈ 42px total header. The wrapper also has mt-1
// (4px) of card-spacing built in, so the connector lands at 4 + 18 = 22px from the wrapper top.
const CONNECTOR_Y = 22;
// The bar for non-last children extends -4px above the wrapper (-top-1) to bridge the mt-1 gap
// between sibling cards so the segments look like one continuous line.
const BAR_OVERLAP = 4; // matches mt-1 (4px)

function QuestTreeNode({
    questId,
    depth,
    childrenOf,
    parentOf,
    questsById,
    leadsToByQuestId,
}: {
    questId: string;
    depth: number;
    childrenOf: Map<string, string[]>;
    parentOf: Map<string, string | null>;
    questsById: Map<string, FullQuest>;
    leadsToByQuestId: Map<string, string[]>;
}) {
    const [childrenCollapsed, setChildrenCollapsed] = useState(false);
    const [barHovered, setBarHovered] = useState(false);
    // Timer ref prevents a brief un-hover flicker when the pointer moves between segments.
    const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const quest = questsById.get(questId);
    if (!quest) return null;

    const children = childrenOf.get(questId) ?? [];
    const primaryParentId = parentOf.get(questId) ?? null;
    const linkedPrerequisites = quest.taskRequirements
        .filter((req) => req.task.id !== primaryParentId)
        .map((req) => toRef(req.task.id, req.task.name, questsById));
    const childIndent = getIndentPx(depth);
    const connectorOffset = getConnectorOffsetPx(depth);

    const onBarEnter = () => {
        clearTimeout(hoverTimer.current);
        setBarHovered(true);
    };
    const onBarLeave = () => {
        hoverTimer.current = setTimeout(() => setBarHovered(false), 30);
    };

    return (
        <div>
            {linkedPrerequisites.length > 0 && <LinkedQuestGroup questRefs={linkedPrerequisites} />}
            <QuestCard
                quest={quest}
                prerequisiteQuests={quest.taskRequirements.map((req) =>
                    toRef(req.task.id, req.task.name, questsById),
                )}
                leadsToQuests={(leadsToByQuestId.get(quest.id) ?? []).map((id) =>
                    toRef(id, id, questsById),
                )}
                attachedTop={linkedPrerequisites.length > 0}
            />

            {children.length > 0 && (
                <div className="mt-1" style={{ marginLeft: `${childIndent}px` }}>
                    {childrenCollapsed ? (
                        <CollapseHint
                            count={countAllDescendants(children, childrenOf)}
                            onShow={() => setChildrenCollapsed(false)}
                        />
                    ) : (
                        <>
                            {children.map((childId, i) => {
                                const isLast = i === children.length - 1;
                                return (
                                    <div
                                        key={childId}
                                        className="relative mt-1"
                                        style={{ paddingLeft: `${connectorOffset}px` }}
                                    >
                                        {/*
                                         * Vertical bar per child:
                                         *   Non-last — extends from -BAR_OVERLAP px (above the mt-1
                                         *   gap) all the way to bottom-0, so consecutive segments
                                         *   appear as one unbroken line.
                                         *   Last — only reaches CONNECTOR_Y so the bar terminates
                                         *   cleanly at the card connector rather than hanging through
                                         *   the child's own sub-tree.
                                         * All segments share barHovered state so they highlight
                                         * together regardless of which segment the pointer is on.
                                         */}
                                        <button
                                            onClick={() => setChildrenCollapsed(true)}
                                            onMouseEnter={onBarEnter}
                                            onMouseLeave={onBarLeave}
                                            title="Collapse"
                                            className="absolute left-0 cursor-pointer"
                                            style={
                                                isLast
                                                    ? {
                                                          top: 0,
                                                          height: `${CONNECTOR_Y}px`,
                                                          width: `${connectorOffset}px`,
                                                      }
                                                    : {
                                                          top: `-${BAR_OVERLAP}px`,
                                                          bottom: 0,
                                                          width: `${connectorOffset}px`,
                                                      }
                                            }
                                        >
                                            <div
                                                className={cn(
                                                    "absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px transition-colors",
                                                    barHovered ? "bg-white/25" : "bg-white/5",
                                                )}
                                            />
                                        </button>

                                        {/* Horizontal connector — L-bend from bar centre to card edge */}
                                        <div
                                            className={cn(
                                                "absolute h-px transition-colors",
                                                barHovered ? "bg-white/25" : "bg-white/5",
                                            )}
                                            style={{
                                                left: `${Math.floor(connectorOffset / 2)}px`,
                                                top: `${CONNECTOR_Y}px`,
                                                width: `${Math.max(8, Math.ceil(connectorOffset / 2))}px`,
                                            }}
                                        />

                                        <QuestTreeNode
                                            questId={childId}
                                            depth={depth + 1}
                                            childrenOf={childrenOf}
                                            parentOf={parentOf}
                                            questsById={questsById}
                                            leadsToByQuestId={leadsToByQuestId}
                                        />
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function TraderTreeSection({
    trader,
    traderQuests,
    allTraderQuests,
    questsById,
    leadsToByQuestId,
}: {
    trader: FullQuest["trader"];
    traderQuests: FullQuest[];
    allTraderQuests: FullQuest[];
    questsById: Map<string, FullQuest>;
    leadsToByQuestId: Map<string, string[]>;
}) {
    const { completedQuests } = useUserStore();

    const { rootIds, childrenOf, parentOf } = useMemo(
        () => buildTraderTree(traderQuests),
        [traderQuests],
    );

    const total = allTraderQuests.length;
    const completed = allTraderQuests.filter((q) => completedQuests[q.id]).length;
    const pct = total > 0 ? (completed / total) * 100 : 0;

    return (
        <div>
            <div className="flex items-center gap-3 pt-5 pb-2.5 border-b border-white/5">
                {(trader.image4xLink ?? trader.imageLink) ? (
                    <img
                        src={trader.image4xLink ?? trader.imageLink ?? ""}
                        alt={trader.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400 shrink-0">
                        {trader.name[0]}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-white tracking-wide uppercase">
                            {trader.name}
                        </span>
                        <span className="text-xs text-gray-500">
                            {completed}/{total}
                        </span>
                    </div>
                    <div className="mt-1 h-0.5 rounded-full bg-white/5 overflow-hidden w-28">
                        <div
                            className="h-full bg-tarkov-green/50 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>
            <div className="mt-1 mb-4">
                {rootIds.map((rootId) => (
                    <div key={rootId} className="mt-1">
                        <QuestTreeNode
                            questId={rootId}
                            depth={0}
                            childrenOf={childrenOf}
                            parentOf={parentOf}
                            questsById={questsById}
                            leadsToByQuestId={leadsToByQuestId}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function QuestsTree() {
    const { filteredQuests, quests, questsById, leadsToByQuestId, traders, completedCount } =
        useQuestsContext();

    const questsByTraderId = useMemo(() => {
        const map = new Map<string, FullQuest[]>();
        for (const quest of filteredQuests) {
            const arr = map.get(quest.trader.id) ?? [];
            arr.push(quest);
            map.set(quest.trader.id, arr);
        }
        return map;
    }, [filteredQuests]);

    const allQuestsByTraderId = useMemo(() => {
        const map = new Map<string, FullQuest[]>();
        for (const quest of quests) {
            const arr = map.get(quest.trader.id) ?? [];
            arr.push(quest);
            map.set(quest.trader.id, arr);
        }
        return map;
    }, [quests]);

    return (
        <>
            <div className="flex items-center gap-3 px-1 text-xs text-gray-500">
                <span>{filteredQuests.length} quests</span>
                <span className="text-gray-600">·</span>
                <span>
                    {completedCount}/{quests.length} completed
                </span>
            </div>

            {traders.map((trader) => {
                const traderQuests = questsByTraderId.get(trader.id) ?? [];
                if (traderQuests.length === 0) return null;
                return (
                    <TraderTreeSection
                        key={trader.id}
                        trader={trader}
                        traderQuests={traderQuests}
                        allTraderQuests={allQuestsByTraderId.get(trader.id) ?? []}
                        questsById={questsById}
                        leadsToByQuestId={leadsToByQuestId}
                    />
                );
            })}

            {filteredQuests.length === 0 && (
                <div className="flex items-center justify-center py-16 text-gray-600 text-sm">
                    No quests match the current filters.
                </div>
            )}
        </>
    );
}
