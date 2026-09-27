"use client";

import { CheckCircle2, Map as MapIcon } from "lucide-react";
import { SectionLabel } from "@/components/ui/detail-section";
import { cn } from "@/lib/utils";
import { QuestObjectiveIcon } from "../../objectives/QuestObjectiveIcon";
import { ObjectiveRow } from "../../objectives/QuestObjectiveRows";
import { getPositionedObjectiveMaps } from "../quest-detail-markers";
import type { QuestDetailMapData } from "../quest-details-model";
import type { ObjectivePresentation } from "../quest-objective-presentation";

export function QuestObjectives({
    questId,
    objectiveCount,
    objectivePresentation,
    completedObjectiveIds,
    mapData,
    selectedMapKey,
    focusedObjectiveId,
    onHoverObjective,
    onShowObjectiveOnMap,
    onToggleObjectiveCompletion,
}: {
    questId: string;
    objectiveCount: number;
    objectivePresentation: ObjectivePresentation[];
    completedObjectiveIds: ReadonlySet<string>;
    mapData: QuestDetailMapData;
    selectedMapKey: string | null;
    focusedObjectiveId: string | null;
    onHoverObjective: (objectiveId: string | null) => void;
    onShowObjectiveOnMap: (mapKey: string, objectiveId: string) => void;
    onToggleObjectiveCompletion: (questId: string, objectiveId: string) => void;
}) {
    return (
        <>
            <SectionLabel>Objectives</SectionLabel>
            {objectivePresentation.length > 0 ? (
                <div className="space-y-7">
                    {objectivePresentation.map((presentation) => (
                        <QuestObjectiveDisplay
                            key={presentation.objective.id}
                            questId={questId}
                            objectiveCount={objectiveCount}
                            presentation={presentation}
                            isCompleted={completedObjectiveIds.has(presentation.objective.id)}
                            isFocused={focusedObjectiveId === presentation.objective.id}
                            mapData={mapData}
                            selectedMapKey={selectedMapKey}
                            onHoverObjective={onHoverObjective}
                            onShowObjectiveOnMap={onShowObjectiveOnMap}
                            onToggleObjectiveCompletion={onToggleObjectiveCompletion}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-xs text-subtle-foreground">No objectives provided.</p>
            )}
        </>
    );
}

function QuestObjectiveDisplay({
    questId,
    objectiveCount,
    presentation: { objective, showItems },
    isCompleted,
    isFocused,
    mapData,
    selectedMapKey,
    onHoverObjective,
    onShowObjectiveOnMap,
    onToggleObjectiveCompletion,
}: {
    questId: string;
    objectiveCount: number;
    presentation: ObjectivePresentation;
    isCompleted: boolean;
    isFocused: boolean;
    mapData: QuestDetailMapData;
    selectedMapKey: string | null;
    onHoverObjective: (objectiveId: string | null) => void;
    onShowObjectiveOnMap: (mapKey: string, objectiveId: string) => void;
    onToggleObjectiveCompletion: (questId: string, objectiveId: string) => void;
}) {
    const positionedMaps = getPositionedObjectiveMaps(objective);
    const cueMapKey = positionedMaps.some((map) => map.key === selectedMapKey)
        ? selectedMapKey
        : positionedMaps[0]?.key;
    const markers = cueMapKey
        ? (mapData.markersByMap.get(cueMapKey) ?? []).filter((marker) => marker.objectiveIds?.includes(objective.id))
        : [];
    const markerStyle = mapData.styles.get(objective.id);
    const positionedLocationCount = positionedMaps.reduce((count, map) => count + map.locationCount, 0);
    const multipleLocationLabel = positionedLocationCount > 1
        ? objective.locations?.some((location) => location.position && location.source === "possibleLocation")
            ? "Multiple spawns"
            : "Multiple locations"
        : null;
    const canComplete = objectiveCount > 1 && positionedMaps.length > 0;

    return (
        <div
            onMouseEnter={() => {
                if (!isCompleted && markers.length > 0) onHoverObjective(objective.id);
            }}
            onMouseLeave={() => onHoverObjective(null)}
            className={cn(
                "rounded-md bg-highlight/[0.035] p-3",
                isFocused && "bg-highlight/[0.065]",
            )}
        >
            {positionedMaps.length > 0 && (
                <div className="mb-3 flex w-full flex-wrap items-center gap-x-3 gap-y-2">
                    {markerStyle && (
                        <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-shadow/70"
                            style={{ backgroundColor: markerStyle.color }}
                        >
                            <QuestObjectiveIcon type={objective.type} size={11} className="text-inverse" />
                        </span>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {positionedMaps.map((map) => (
                            <button
                                type="button"
                                key={map.key}
                                onClick={() => onShowObjectiveOnMap(map.key, objective.id)}
                                className="inline-flex items-center gap-1.5 rounded bg-shadow/30 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-shadow/45 hover:text-brand"
                            >
                                <MapIcon size={11} />
                                Show on {map.name}
                                {map.locationCount > 1 && <span className="text-subtle-foreground">×{map.locationCount}</span>}
                            </button>
                        ))}
                    </div>
                    {multipleLocationLabel && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-warning/80">
                            {multipleLocationLabel}
                        </span>
                    )}
                    {canComplete && (
                        <button
                            type="button"
                            aria-pressed={isCompleted}
                            aria-label={`${isCompleted ? "Undo completion of" : "Complete"} objective: ${objective.description}`}
                            onClick={() => onToggleObjectiveCompletion(questId, objective.id)}
                            className={cn(
                                "ml-auto inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-semibold transition-colors",
                                isCompleted
                                    ? "bg-success/15 text-success hover:bg-highlight/10 hover:text-foreground"
                                    : "bg-shadow/30 text-subtle-foreground hover:bg-shadow/45 hover:text-brand",
                            )}
                        >
                            <CheckCircle2 size={12} className="text-success" />
                            {isCompleted ? "Completed" : "Complete"}
                        </button>
                    )}
                </div>
            )}
            <ObjectiveRow
                objective={objective}
                itemDisplay="rows"
                showItems={showItems}
            />
        </div>
    );
}
