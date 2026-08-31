"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { QuestBranchLine } from "./quest-branch-graph";
import { buildQuestGraphLayout } from "./quest-graph-layout";
import {
    QuestGraphEdges,
    QuestGraphNode,
    QuestGraphToolbar,
    QuestVisualizerLineIndex,
} from "./QuestVisualizerParts";
import { useQuestGraphViewport } from "./useQuestGraphViewport";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

function SeriesGraph({ line, onBack, focusedQuestId }: {
    line: QuestBranchLine;
    onBack: () => void;
    focusedQuestId: string | null;
}) {
    const { statusByQuestId, setSelectedQuestId, setMode } = useQuestWorkspace();
    const [hoveredQuestId, setHoveredQuestId] = useState<string | null>(null);
    const layout = useMemo(
        () => buildQuestGraphLayout(line, hoveredQuestId),
        [hoveredQuestId, line],
    );
    const {
        scrollContainerRef,
        zoom,
        isPanning,
        changeZoom,
        beginPan,
        continuePan,
        endPan,
        handleWheel,
    } = useQuestGraphViewport({
        lineId: line.id,
        nodes: line.nodes,
        focusedQuestId,
    });
    const openQuest = (questId: string) => {
        setSelectedQuestId(questId);
        setMode("details");
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <QuestGraphToolbar line={line} zoom={zoom} onBack={onBack} onZoomChange={changeZoom} />
            <div
                ref={scrollContainerRef}
                onPointerDown={beginPan}
                onPointerMove={continuePan}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                onWheel={handleWheel}
                title="Drag to pan · Scroll vertically · Shift + scroll horizontally"
                className={cn(
                    "min-h-0 flex-1 select-none overflow-auto bg-[radial-gradient(circle_at_50%_20%,#151719,#0b0c0e_65%)]",
                    isPanning ? "cursor-grabbing" : "cursor-grab",
                )}
            >
                <div className="relative" style={{ width: layout.width * zoom, height: layout.height * zoom }}>
                    <div
                        className="absolute left-0 top-0 origin-top-left"
                        style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}
                    >
                        <svg className="absolute inset-0" width={layout.width} height={layout.height} aria-hidden="true">
                            <defs>
                                <marker id="quest-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                    <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
                                </marker>
                            </defs>
                            <QuestGraphEdges edges={layout.edges} nodesById={layout.nodesById} activeQuestId={hoveredQuestId} />
                        </svg>
                        {layout.nodes.map((nodeLayout) => (
                            <QuestGraphNode
                                key={nodeLayout.node.quest.id}
                                layout={nodeLayout}
                                statusByQuestId={statusByQuestId}
                                focusedQuestId={focusedQuestId}
                                activeQuestId={hoveredQuestId}
                                onOpen={openQuest}
                                onHover={setHoveredQuestId}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function QuestVisualizerPane() {
    const {
        branchLines,
        visualizerLineId,
        visualizerFocusQuestId,
        openQuestVisualizer,
        showQuestVisualizerIndex,
    } = useQuestWorkspace();
    const selectedLine = visualizerLineId
        ? branchLines.find((line) => line.id === visualizerLineId) ?? null
        : null;

    if (!selectedLine) {
        return <QuestVisualizerLineIndex onSelect={(line) => openQuestVisualizer(line.id)} />;
    }

    return <SeriesGraph line={selectedLine} focusedQuestId={visualizerFocusQuestId} onBack={showQuestVisualizerIndex} />;
}
