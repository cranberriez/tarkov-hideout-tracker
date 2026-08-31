"use client";

import { ArrowLeft, GitBranch, Lock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestBranchLine, QuestBranchNode } from "./quest-branch-graph";
import type {
    QuestGraphEdgeLayout,
    QuestGraphNodeLayout,
} from "./quest-graph-layout";
import {
    QUEST_GRAPH_MAX_ZOOM,
    QUEST_GRAPH_MIN_ZOOM,
    QUEST_GRAPH_ZOOM_STEP,
} from "./useQuestGraphViewport";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

type QuestStatusMap = ReturnType<typeof useQuestWorkspace>["statusByQuestId"];

export function QuestVisualizerLineIndex({
    onSelect,
}: {
    onSelect: (line: QuestBranchLine) => void;
}) {
    const { branchLines, statusByQuestId } = useQuestWorkspace();
    return (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <div className="mx-auto max-w-4xl">
                <div className="mb-5">
                    <h2 className="font-serif text-xl font-semibold text-gray-100">Quest visualizer</h2>
                </div>
                {branchLines.length === 0 ? (
                    <div className="border border-white/8 bg-white/3 px-5 py-8 text-center text-sm text-gray-500">
                        No quest series are available in the current quest data.
                    </div>
                ) : (
                    <section>
                        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-600">Special questlines</h3>
                        <div className="grid gap-3 md:grid-cols-2">
                            {branchLines.map((line) => {
                                const activeNodes = line.nodes.filter(
                                    (node) => statusByQuestId.get(node.quest.id)?.status === "active",
                                );
                                const entryNodes = activeNodes.length > 0
                                    ? activeNodes
                                    : line.nodes.filter((node) => node.rank === 0);
                                return (
                                    <button
                                        key={line.id}
                                        type="button"
                                        onClick={() => onSelect(line)}
                                        aria-label={`View ${line.name}`}
                                        className="flex h-full flex-col items-stretch justify-start border border-white/10 bg-[#111214] p-4 text-left align-top transition-colors hover:border-tarkov-green/40 hover:bg-[#151719] focus-visible:border-tarkov-green/60 focus-visible:outline-none"
                                    >
                                        <div className="flex items-center gap-2">
                                            <GitBranch size={16} className="text-tarkov-green" />
                                            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-100">{line.name}</h3>
                                            <span className="border border-amber-300/20 bg-amber-300/5 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-200/70">Special</span>
                                            <span className="text-[10px] uppercase tracking-wider text-gray-600">{line.nodes.length} quests</span>
                                        </div>
                                        <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                                            {activeNodes.length > 0 ? "Currently active" : "Start here"}
                                        </p>
                                        <div className="space-y-1.5">
                                            {entryNodes.map((node) => (
                                                <div
                                                    key={node.quest.id}
                                                    className="flex w-full items-center gap-2 border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-300"
                                                >
                                                    <QuestTraderIcon node={node} />
                                                    <span className="min-w-0 flex-1 truncate">{node.quest.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

function QuestTraderIcon({ node }: { node: QuestBranchNode }) {
    const image = node.quest.trader.image4xLink ?? node.quest.trader.imageLink;
    return image ? (
        <img src={image} alt="" className="h-6 w-6 shrink-0 rounded-full border border-white/10 object-cover" />
    ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] text-gray-500">
            {node.quest.trader.name.slice(0, 1)}
        </span>
    );
}

export function QuestGraphToolbar({
    line,
    zoom,
    onBack,
    onZoomChange,
}: {
    line: QuestBranchLine;
    zoom: number;
    onBack: () => void;
    onZoomChange: (zoom: number) => void;
}) {
    return (
        <div className="border-b border-white/8 bg-[#0e0f11] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white">
                    <ArrowLeft size={14} /> All series
                </button>
                <div className="h-4 w-px bg-white/10" />
                <h2 className="text-sm font-semibold text-gray-100">{line.name}</h2>
                <span className="text-[10px] uppercase tracking-wider text-gray-600">{line.nodes.length} quests</span>
                <div className="ml-auto flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                    <span><i className="mr-1.5 inline-block h-0.5 w-5 bg-sky-400/80 align-middle" /> on accept</span>
                    <span><i className="mr-1.5 inline-block h-0.5 w-5 bg-tarkov-green/70 align-middle" /> on complete</span>
                    <span><i className="mr-1.5 inline-block h-0.5 w-5 bg-red-400/90 align-middle" /> on fail / fails</span>
                    <span><i className="mr-1.5 inline-block h-0.5 w-5 border-t border-dotted border-amber-300/70 align-middle" /> exclusive</span>
                    <div className="ml-1 flex items-center border border-white/10 bg-black/20">
                        <button
                            type="button"
                            onClick={() => onZoomChange(zoom - QUEST_GRAPH_ZOOM_STEP)}
                            disabled={zoom <= QUEST_GRAPH_MIN_ZOOM}
                            aria-label="Zoom out"
                            title="Zoom out"
                            className="flex h-7 w-7 items-center justify-center text-sm text-gray-300 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >−</button>
                        <button
                            type="button"
                            onClick={() => onZoomChange(1)}
                            aria-label="Reset zoom"
                            title="Reset zoom"
                            className="h-7 min-w-11 border-x border-white/10 px-1 text-[9px] tabular-nums text-gray-500 transition-colors hover:bg-white/8 hover:text-white"
                        >{Math.round(zoom * 100)}%</button>
                        <button
                            type="button"
                            onClick={() => onZoomChange(zoom + QUEST_GRAPH_ZOOM_STEP)}
                            disabled={zoom >= QUEST_GRAPH_MAX_ZOOM}
                            aria-label="Zoom in"
                            title="Zoom in"
                            className="flex h-7 w-7 items-center justify-center text-sm text-gray-300 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >+</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function QuestGraphEdges({
    edges,
    nodesById,
    activeQuestId,
}: {
    edges: readonly QuestGraphEdgeLayout[];
    nodesById: ReadonlyMap<string, QuestBranchNode>;
    activeQuestId: string | null;
}) {
    return (
        <>
            {edges.map(({ edge, geometry, color, isHighlighted }) => {
                const sourceName = nodesById.get(edge.sourceId)?.quest.name ?? edge.sourceId;
                const targetName = nodesById.get(edge.targetId)?.quest.name ?? edge.targetId;
                return (
                    <g
                        key={edge.id}
                        opacity={activeQuestId ? (isHighlighted ? 1 : 0.08) : 0.82}
                        className="transition-opacity duration-150"
                    >
                        <title>{`${sourceName} → ${targetName}: ${edge.label}`}</title>
                        <path
                            d={geometry.path}
                            fill="none"
                            stroke={color}
                            strokeWidth={isHighlighted ? "2.75" : "1.5"}
                            strokeDasharray={edge.kind === "exclusive" ? "2 5" : undefined}
                            markerEnd={edge.kind === "exclusive" ? undefined : "url(#quest-flow-arrow)"}
                        />
                        {geometry.showLabel && (
                            <text
                                x={geometry.labelX}
                                y={geometry.labelY}
                                textAnchor="middle"
                                fill={color}
                                stroke="#0b0c0e"
                                strokeWidth="5"
                                paintOrder="stroke"
                                transform={geometry.labelRotation ? `rotate(${geometry.labelRotation} ${geometry.labelX} ${geometry.labelY})` : undefined}
                                className="text-[10px] font-medium"
                            >
                                {edge.label}
                            </text>
                        )}
                    </g>
                );
            })}
        </>
    );
}

export function QuestGraphNode({
    layout,
    statusByQuestId,
    focusedQuestId,
    activeQuestId,
    onOpen,
    onHover,
}: {
    layout: QuestGraphNodeLayout;
    statusByQuestId: QuestStatusMap;
    focusedQuestId: string | null;
    activeQuestId: string | null;
    onOpen: (questId: string) => void;
    onHover: (questId: string | null) => void;
}) {
    const { node, position, duplicateRouteIndex, isConnected } = layout;
    const status = statusByQuestId.get(node.quest.id);
    const traderImage = node.quest.trader.image4xLink ?? node.quest.trader.imageLink;
    return (
        <button
            type="button"
            onClick={() => onOpen(node.quest.id)}
            title={`Open ${node.quest.name}`}
            onMouseMove={() => onHover(node.quest.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
                "absolute flex h-[74px] w-[240px] cursor-pointer items-start gap-3 border bg-[#151619] px-3 pt-3 text-left shadow-lg transition-[opacity,filter,border-color,background-color] duration-150 hover:border-tarkov-green/50 hover:bg-[#191b1e] focus-visible:z-20",
                activeQuestId && !isConnected ? "opacity-20 grayscale" : "z-10 opacity-100",
                focusedQuestId === node.quest.id && "ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-[#0b0c0e]",
                status?.status === "completed" ? "border-tarkov-green/35" : status?.status === "failed" ? "border-red-400/40" : status?.status === "active" ? "border-sky-400/35" : "border-white/12",
            )}
            style={{ left: position.x, top: position.y }}
        >
            {traderImage ? <img src={traderImage} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover" /> : <QuestTraderIcon node={node} />}
            <span className="min-w-0 flex-1">
                <span className="flex items-start gap-1.5">
                    <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold leading-4 text-gray-100">{node.quest.name}</span>
                    {duplicateRouteIndex !== undefined && (
                        <span className="shrink-0 border border-amber-300/20 bg-amber-300/5 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-200/65">
                            Route {String.fromCharCode(65 + duplicateRouteIndex)}
                        </span>
                    )}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-gray-600">
                    {status?.status === "locked" && <Lock size={9} />}
                    {status?.status === "failed" && <XCircle size={9} />}
                    {status?.label ?? node.quest.trader.name}
                    {node.canFail && <span className="text-red-300/65">· can fail</span>}
                </span>
            </span>
        </button>
    );
}
