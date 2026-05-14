"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, ChevronDown, Circle, Lock } from "lucide-react";
import { useQuestsContext } from "../QuestsContext";
import { useUserStore } from "@/lib/stores/useUserStore";
import { QuestCard, type QuestRef } from "../QuestCard";
import { cn } from "@/lib/utils";
import type { FullQuest } from "@/types";
import { isQuestAvailableForProfile } from "../quest-sync";
import {
    partitionLinkedPrerequisites,
    shouldFoldLinkedPrerequisites,
    type LinkedPrerequisiteStatus,
} from "./quest-tree-prerequisites";

const QUEST_HIGHLIGHT_DURATION_MS = 30_000;
const QUEST_SCROLL_TOP_OFFSET_VH = 0.3;

function scrollToQuest(questId: string) {
    const target = document.getElementById(`quest-${questId}`);
    if (!target) return;

    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    const offset = window.innerHeight * QUEST_SCROLL_TOP_OFFSET_VH;
    const top = Math.max(0, targetTop - offset);

    window.history.replaceState(null, "", `#quest-${questId}`);
    window.scrollTo({ top, behavior: "smooth" });
}

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

function collectLinearChainIds(startId: string, childrenOf: Map<string, string[]>): string[] {
    const ids: string[] = [];
    let currentId = startId;

    while (true) {
        const children = childrenOf.get(currentId) ?? [];
        if (children.length !== 1) break;

        const nextId = children[0];
        ids.push(nextId);
        currentId = nextId;
    }

    return ids;
}

function getIndentPx(depth: number) {
    if (depth < 4) return 20;
    if (depth < 8) return 16;
    return 12;
}

function getConnectorOffsetPx(depth: number) {
    const indent = getIndentPx(depth);
    return Math.max(10, indent - 4);
}

function LinkedQuestGroup({
    entries,
    onQuestLinkClick,
}: {
    entries: Array<{ questRef: QuestRef; status: LinkedPrerequisiteStatus; folded: boolean }>;
    onQuestLinkClick: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
    const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
    const containerClass =
        "-mb-2 rounded-t-md border border-white/10 border-b-0 bg-black px-2.5 pt-1.5 pb-3.5";
    const expandedEntries = entries.filter((entry) => !entry.folded);
    const foldedEntries = entries.filter((entry) => entry.folded);
    const highestCollapsedZIndex = foldedEntries.length;

    return (
        <div className={containerClass}>
            <div className="space-y-1">
                {expandedEntries.map(({ questRef, status, folded }) => {
                    const foldedContentClass = folded ? "opacity-60" : "";
                    const statusLabel =
                        status === "completed"
                            ? "Completed"
                            : status === "available"
                              ? "Available"
                              : "Locked";

                    return (
                        <a
                            key={questRef.id}
                            href={`#quest-${questRef.id}`}
                            onClick={(e) => onQuestLinkClick(questRef.id, e)}
                            onMouseEnter={() => setActiveLinkId(questRef.id)}
                            onMouseLeave={() =>
                                setActiveLinkId((current) =>
                                    current === questRef.id ? null : current,
                                )
                            }
                            onFocus={() => setActiveLinkId(questRef.id)}
                            onBlur={() =>
                                setActiveLinkId((current) =>
                                    current === questRef.id ? null : current,
                                )
                            }
                            className={cn(
                                "relative z-0 flex items-center gap-2 rounded-sm bg-black px-1.5 py-1 text-xs text-gray-300 transition-colors hover:bg-[#111111] hover:text-white focus-visible:bg-[#111111] focus-visible:text-white",
                                folded && "-mt-3 first:mt-0",
                            )}
                            style={
                                activeLinkId === questRef.id
                                    ? { zIndex: highestCollapsedZIndex + 1 }
                                    : undefined
                            }
                        >
                            <span
                                title={statusLabel}
                                className={cn(
                                    "inline-flex h-5 shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400",
                                    foldedContentClass,
                                )}
                            >
                                {status === "completed" ? (
                                    <CheckCircle size={11} className="text-tarkov-green/90" />
                                ) : status === "available" ? (
                                    <Circle size={11} className="text-blue-300" />
                                ) : (
                                    <Lock size={10} className="text-red-300" />
                                )}
                                PRE-REQ
                            </span>
                            {(questRef.trader.image4xLink ?? questRef.trader.imageLink) ? (
                                <img
                                    src={
                                        questRef.trader.image4xLink ??
                                        questRef.trader.imageLink ??
                                        ""
                                    }
                                    alt={questRef.trader.name}
                                    className={cn(
                                        "h-4 w-4 shrink-0 rounded-full object-cover",
                                        foldedContentClass,
                                    )}
                                />
                            ) : (
                                <span
                                    className={cn(
                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px]",
                                        foldedContentClass,
                                    )}
                                >
                                    {questRef.trader.name[0]}
                                </span>
                            )}
                            <span
                                className={cn(
                                    "shrink-0 text-[10px] text-gray-500",
                                    foldedContentClass,
                                )}
                            >
                                {questRef.trader.name}
                            </span>
                            <span className={cn("min-w-0 truncate", foldedContentClass)}>
                                {questRef.name}
                            </span>
                        </a>
                    );
                })}
                {foldedEntries.length > 0 && (
                    <div className={expandedEntries.length > 0 ? "pt-2" : ""}>
                        {foldedEntries.map(({ questRef, status, folded }, index) => {
                            const foldedContentClass = folded ? "opacity-60" : "";
                            const statusLabel =
                                status === "completed"
                                    ? "Completed"
                                    : status === "available"
                                      ? "Available"
                                      : "Locked";

                            return (
                                <a
                                    key={questRef.id}
                                    href={`#quest-${questRef.id}`}
                                    onClick={(e) => onQuestLinkClick(questRef.id, e)}
                                    onMouseEnter={() => setActiveLinkId(questRef.id)}
                                    onMouseLeave={() =>
                                        setActiveLinkId((current) =>
                                            current === questRef.id ? null : current,
                                        )
                                    }
                                    onFocus={() => setActiveLinkId(questRef.id)}
                                    onBlur={() =>
                                        setActiveLinkId((current) =>
                                            current === questRef.id ? null : current,
                                        )
                                    }
                                    className={cn(
                                        "relative flex items-center gap-2 rounded-sm bg-black px-1.5 py-1 text-xs text-gray-300 transition-colors hover:bg-[#1a1a1a] hover:text-white focus-visible:bg-[#1a1a1a] focus-visible:text-white",
                                        folded && "-mt-3 first:mt-0",
                                    )}
                                    style={{
                                        zIndex:
                                            activeLinkId === questRef.id
                                                ? highestCollapsedZIndex + 1
                                                : folded
                                                  ? index + 1
                                                  : 0,
                                    }}
                                >
                                    <span
                                        title={statusLabel}
                                        className={cn(
                                            "inline-flex h-5 shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400",
                                            foldedContentClass,
                                        )}
                                    >
                                        {status === "completed" ? (
                                            <CheckCircle
                                                size={11}
                                                className="text-tarkov-green/90"
                                            />
                                        ) : status === "available" ? (
                                            <Circle size={11} className="text-blue-300" />
                                        ) : (
                                            <Lock size={10} className="text-red-300" />
                                        )}
                                        PRE-REQ
                                    </span>
                                    {(questRef.trader.image4xLink ?? questRef.trader.imageLink) ? (
                                        <img
                                            src={
                                                questRef.trader.image4xLink ??
                                                questRef.trader.imageLink ??
                                                ""
                                            }
                                            alt={questRef.trader.name}
                                            className={cn(
                                                "h-4 w-4 shrink-0 rounded-full object-cover",
                                                foldedContentClass,
                                            )}
                                        />
                                    ) : (
                                        <span
                                            className={cn(
                                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px]",
                                                foldedContentClass,
                                            )}
                                        >
                                            {questRef.trader.name[0]}
                                        </span>
                                    )}
                                    <span
                                        className={cn(
                                            "shrink-0 text-[10px] text-gray-500",
                                            foldedContentClass,
                                        )}
                                    >
                                        {questRef.trader.name}
                                    </span>
                                    <span className={cn("min-w-0 truncate", foldedContentClass)}>
                                        {questRef.name}
                                    </span>
                                </a>
                            );
                        })}
                    </div>
                )}
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
            <div className="h-px flex-1 bg-white/5 transition-colors group-hover:bg-white/10" />
            <span className="text-[11px] text-gray-600 transition-colors whitespace-nowrap tracking-wide group-hover:text-gray-400">
                {count} quest{count !== 1 ? "s" : ""} hidden · SHOW
            </span>
            <div className="h-px flex-1 bg-white/5 transition-colors group-hover:bg-white/10" />
        </button>
    );
}

const CONNECTOR_Y = 22;
const BAR_OVERLAP = 4;
const LINEAR_CHAIN_OFFSET = 14;

function QuestNodeCard({
    questId,
    parentOf,
    questsById,
    leadsToByQuestId,
    showDebugButton,
    highlightedQuestId,
    onQuestLinkClick,
}: {
    questId: string;
    parentOf: Map<string, string | null>;
    questsById: Map<string, FullQuest>;
    leadsToByQuestId: Map<string, string[]>;
    showDebugButton: boolean;
    highlightedQuestId: string | null;
    onQuestLinkClick: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
    const { completedQuests, ignoredQuests } = useUserStore();
    const { syncProfile, showPrereqs } = useQuestsContext();
    const quest = questsById.get(questId);
    if (!quest) return null;

    const primaryParentId = parentOf.get(questId) ?? null;
    const linkedPrerequisites = quest.taskRequirements
        .filter((req) => req.task.id !== primaryParentId)
        .map((req) => {
            const questRef = toRef(req.task.id, req.task.name, questsById);
            const linkedQuest = questsById.get(req.task.id);
            const status: LinkedPrerequisiteStatus = completedQuests[req.task.id]
                ? "completed"
                : linkedQuest && isQuestAvailableForProfile(linkedQuest, syncProfile, questsById)
                  ? "available"
                  : "locked";

            return { questRef, status };
        });
    const foldPrerequisites = shouldFoldLinkedPrerequisites({
        completed: !!completedQuests[quest.id],
        ignored: !!ignoredQuests[quest.id],
        prerequisiteIds: quest.taskRequirements.map((req) => req.task.id),
    });
    const partitionedPrerequisites = partitionLinkedPrerequisites({
        completed: !!completedQuests[quest.id],
        ignored: !!ignoredQuests[quest.id],
        linkedPrerequisites: linkedPrerequisites.map((item) => ({
            id: item.questRef.id,
            status: item.status,
        })),
    });
    const prerequisiteEntries = [
        ...partitionedPrerequisites.expanded.map((item) => ({
            questRef:
                linkedPrerequisites.find(
                    (linkedPrerequisite) => linkedPrerequisite.questRef.id === item.id,
                )?.questRef ?? toRef(item.id, item.id, questsById),
            status: item.status,
            folded: false,
        })),
        ...partitionedPrerequisites.folded.map((item) => ({
            questRef:
                linkedPrerequisites.find(
                    (linkedPrerequisite) => linkedPrerequisite.questRef.id === item.id,
                )?.questRef ?? toRef(item.id, item.id, questsById),
            status: item.status,
            folded: foldPrerequisites,
        })),
    ];

    return (
        <>
            {showPrereqs && prerequisiteEntries.length > 0 && (
                <LinkedQuestGroup
                    entries={prerequisiteEntries}
                    onQuestLinkClick={onQuestLinkClick}
                />
            )}
            <QuestCard
                quest={quest}
                prerequisiteQuests={quest.taskRequirements.map((req) =>
                    toRef(req.task.id, req.task.name, questsById),
                )}
                leadsToQuests={(leadsToByQuestId.get(quest.id) ?? []).map((id) =>
                    toRef(id, id, questsById),
                )}
                attachedTop={showPrereqs && linkedPrerequisites.length > 0}
                showDebugButton={showDebugButton}
                highlighted={highlightedQuestId === quest.id}
                onQuestLinkClick={onQuestLinkClick}
            />
        </>
    );
}

function BranchChildren({
    childIds,
    depth,
    childrenOf,
    parentOf,
    questsById,
    leadsToByQuestId,
    showDebugButton,
    highlightedQuestId,
    onQuestLinkClick,
}: {
    childIds: string[];
    depth: number;
    childrenOf: Map<string, string[]>;
    parentOf: Map<string, string | null>;
    questsById: Map<string, FullQuest>;
    leadsToByQuestId: Map<string, string[]>;
    showDebugButton: boolean;
    highlightedQuestId: string | null;
    onQuestLinkClick: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
    const [childrenCollapsed, setChildrenCollapsed] = useState(false);
    const [barHovered, setBarHovered] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
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
        <div
            className="relative mt-1"
            style={{
                marginLeft: `${childIndent}px`,
                paddingLeft: `${connectorOffset}px`,
            }}
        >
            {childrenCollapsed ? (
                <CollapseHint
                    count={countAllDescendants(childIds, childrenOf)}
                    onShow={() => setChildrenCollapsed(false)}
                />
            ) : (
                <>
                    <button
                        onClick={() => setChildrenCollapsed(true)}
                        onMouseEnter={onBarEnter}
                        onMouseLeave={onBarLeave}
                        title="Collapse"
                        className="absolute left-0 cursor-pointer"
                        style={{
                            top: 0,
                            bottom: 0,
                            width: `${connectorOffset}px`,
                        }}
                    >
                        <div
                            className={cn(
                                "absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px transition-colors",
                                barHovered ? "bg-white/25" : "bg-white/10",
                            )}
                        />
                    </button>
                    {childIds.map((childId, i) => {
                        const isLast = i === childIds.length - 1;

                        return (
                            <div key={childId} className="relative mt-1">
                                <div
                                    className={cn(
                                        "absolute h-px transition-colors",
                                        barHovered ? "bg-white/25" : "bg-white/10",
                                    )}
                                    style={{
                                        left: `-${Math.ceil(connectorOffset / 2)}px`,
                                        top: `${CONNECTOR_Y}px`,
                                        width: `${Math.max(8, Math.ceil(connectorOffset / 2))}px`,
                                    }}
                                />
                                {isLast && (
                                    <div
                                        className="absolute w-px bg-[#111111]"
                                        style={{
                                            left: `-${Math.ceil(connectorOffset / 2)}px`,
                                            top: `${CONNECTOR_Y + 1}px`,
                                            bottom: 0,
                                        }}
                                    />
                                )}

                                <QuestTreeNode
                                    questId={childId}
                                    depth={depth + 1}
                                    childrenOf={childrenOf}
                                    parentOf={parentOf}
                                    questsById={questsById}
                                    leadsToByQuestId={leadsToByQuestId}
                                    showDebugButton={showDebugButton}
                                    highlightedQuestId={highlightedQuestId}
                                    onQuestLinkClick={onQuestLinkClick}
                                />
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}

function QuestTreeNode({
    questId,
    depth,
    childrenOf,
    parentOf,
    questsById,
    leadsToByQuestId,
    showDebugButton,
    highlightedQuestId,
    onQuestLinkClick,
}: {
    questId: string;
    depth: number;
    childrenOf: Map<string, string[]>;
    parentOf: Map<string, string | null>;
    questsById: Map<string, FullQuest>;
    leadsToByQuestId: Map<string, string[]>;
    showDebugButton: boolean;
    highlightedQuestId: string | null;
    onQuestLinkClick: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
    const children = childrenOf.get(questId) ?? [];
    const linearChainIds = children.length === 1 ? collectLinearChainIds(questId, childrenOf) : [];
    const branchChildIds = children.length > 1 ? children : [];

    return (
        <div>
            <QuestNodeCard
                questId={questId}
                parentOf={parentOf}
                questsById={questsById}
                leadsToByQuestId={leadsToByQuestId}
                showDebugButton={showDebugButton}
                highlightedQuestId={highlightedQuestId}
                onQuestLinkClick={onQuestLinkClick}
            />

            {linearChainIds.length > 0 && (
                <div className="mt-1 ml-2">
                    {linearChainIds.map((linearQuestId, index) => {
                        const linearChildren = childrenOf.get(linearQuestId) ?? [];
                        const branchAfterLinear = linearChildren.length > 1 ? linearChildren : [];
                        const hasNextLinearQuest = index < linearChainIds.length - 1;

                        return (
                            <div
                                key={linearQuestId}
                                className="relative mt-1"
                                style={{ paddingLeft: `${LINEAR_CHAIN_OFFSET}px` }}
                            >
                                <div
                                    className="absolute left-1.5 w-px bg-white/10"
                                    style={
                                        hasNextLinearQuest
                                            ? {
                                                  top: `-${BAR_OVERLAP}px`,
                                                  bottom: `-${BAR_OVERLAP}px`,
                                              }
                                            : {
                                                  top: `-${BAR_OVERLAP}px`,
                                                  height: `${CONNECTOR_Y}px`,
                                              }
                                    }
                                />
                                <div
                                    className="absolute left-1.5 h-px bg-white/10"
                                    style={{
                                        top: `${CONNECTOR_Y - 4}px`,
                                        width: `${LINEAR_CHAIN_OFFSET - 6}px`,
                                    }}
                                />

                                <QuestNodeCard
                                    questId={linearQuestId}
                                    parentOf={parentOf}
                                    questsById={questsById}
                                    leadsToByQuestId={leadsToByQuestId}
                                    showDebugButton={showDebugButton}
                                    highlightedQuestId={highlightedQuestId}
                                    onQuestLinkClick={onQuestLinkClick}
                                />

                                {branchAfterLinear.length > 0 && (
                                    <BranchChildren
                                        childIds={branchAfterLinear}
                                        depth={depth}
                                        childrenOf={childrenOf}
                                        parentOf={parentOf}
                                        questsById={questsById}
                                        leadsToByQuestId={leadsToByQuestId}
                                        showDebugButton={showDebugButton}
                                        highlightedQuestId={highlightedQuestId}
                                        onQuestLinkClick={onQuestLinkClick}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {branchChildIds.length > 0 && (
                <BranchChildren
                    childIds={branchChildIds}
                    depth={depth}
                    childrenOf={childrenOf}
                    parentOf={parentOf}
                    questsById={questsById}
                    leadsToByQuestId={leadsToByQuestId}
                    showDebugButton={showDebugButton}
                    highlightedQuestId={highlightedQuestId}
                    onQuestLinkClick={onQuestLinkClick}
                />
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
    showDebugButton,
    highlightedQuestId,
    onQuestLinkClick,
}: {
    trader: FullQuest["trader"];
    traderQuests: FullQuest[];
    allTraderQuests: FullQuest[];
    questsById: Map<string, FullQuest>;
    leadsToByQuestId: Map<string, string[]>;
    showDebugButton: boolean;
    highlightedQuestId: string | null;
    onQuestLinkClick: (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
    const { completedQuests } = useUserStore();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const { rootIds, childrenOf, parentOf } = useMemo(
        () => buildTraderTree(traderQuests),
        [traderQuests],
    );

    const total = allTraderQuests.length;
    const completed = allTraderQuests.filter((q) => completedQuests[q.id]).length;
    const pct = total > 0 ? (completed / total) * 100 : 0;

    return (
        <div id={`trader-${trader.id}`} className="mt-2">
            <button
                onClick={() => setIsCollapsed((v) => !v)}
                className="group flex items-center gap-3 p-2 w-full text-left rounded-lg border border-transparent hover:bg-white/1 transition-colors"
            >
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
                <div className="flex items-center justify-center w-[32px] h-[32px] rounded-lg bg-transparent group-hover:bg-white/6 transition-colors shrink-0">
                    <ChevronDown
                        size={13}
                        className={cn(
                            "text-gray-600 group-hover:text-gray-400 shrink-0 transition-[transform,color]",
                            isCollapsed && "-rotate-90",
                        )}
                    />
                </div>
            </button>
            {!isCollapsed && (
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
                                showDebugButton={showDebugButton}
                                highlightedQuestId={highlightedQuestId}
                                onQuestLinkClick={onQuestLinkClick}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function QuestsTree() {
    const {
        filteredQuests,
        quests,
        questsById,
        leadsToByQuestId,
        traders,
        completedCount,
        showDebug,
    } = useQuestsContext();
    const [highlightedQuestId, setHighlightedQuestId] = useState<string | null>(null);
    const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const highlightQuest = (questId: string, event?: React.MouseEvent<HTMLAnchorElement>) => {
        event?.preventDefault();
        setHighlightedQuestId(questId);
        scrollToQuest(questId);
        if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedQuestId((current) => (current === questId ? null : current));
            highlightTimeoutRef.current = null;
        }, QUEST_HIGHLIGHT_DURATION_MS);
    };

    useEffect(() => {
        return () => {
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }
        };
    }, []);

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
                        showDebugButton={showDebug}
                        highlightedQuestId={highlightedQuestId}
                        onQuestLinkClick={highlightQuest}
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
