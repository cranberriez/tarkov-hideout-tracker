"use client";

import dynamic from "next/dynamic";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { Bug, CheckCircle2, Circle, Eye, EyeOff, ExternalLink, Flag, MapPinned, Pin, RotateCcw, X, XCircle } from "lucide-react";
import type { MapOverlayMarker } from "@/features/maps/map-types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { formatQuestTraderGate, getQuestTraderGateType } from "@/lib/utils/quest-trader-gates";
import {
    compareTraderTierCompletionCount,
    countCompletedTraderTierQuests,
    formatTraderTierCompletionGate,
    getTraderTierCompletionGate,
} from "@/lib/utils/quest-trader-completion-gates";
import { questCanFail } from "@/lib/utils/quest-failures";
import type { FullQuest, FullQuestObjective, QuestOtherRequirement, QuestTraderStandingReward } from "@/types";
import { ObjectiveRow } from "../components/quest-card/QuestObjectiveRows";
import { formatQuestMapSummary } from "../quest-map-groups";
import { useQuestsContext } from "../QuestsContext";
import {
    buildQuestDetailMarkers,
    createQuestDetailObjectiveStyles,
    getPositionedObjectiveMaps,
    getQuestDetailMaps,
} from "./quest-detail-markers";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

const LazyMapViewer = dynamic(
    () => import("@/features/maps/MapViewer").then((module) => module.MapViewer),
    {
        ssr: false,
        loading: () => <MapLoadingPlaceholder label="Loading objective map…" />,
    },
);

export function QuestDetailsPane() {
    const [showDebug, setShowDebug] = useState(false);
    const [mapTarget, setMapTarget] = useState<{
        questId: string;
        mapKey: string;
        objectiveId: string | null;
        requestKey: number;
    } | null>(null);
    const mapSectionRef = useRef<HTMLElement>(null);
    const { selectedQuest: quest, statusByQuestId, questsById, maps, setSelectedQuestId, retainQuestAfterCompletion } = useQuestWorkspace();
    const { leadsToByQuestId, onItemClick, requestToggleQuestCompletion, requestFailQuest, requestResetQuestStatus } = useQuestsContext();
    const pinned = useUserStore((state) => quest ? !!state.pinnedQuests[quest.id] : false);
    const hidden = useUserStore((state) => quest ? !!state.ignoredQuests[quest.id] : false);
    const completedQuests = useUserStore((state) => state.completedQuests);
    const failedQuests = useUserStore((state) => state.failedQuests);
    const playerLevel = useUserStore((state) => state.playerLevel);
    const prestigeLevel = useUserStore((state) => state.prestigeLevel);
    const questFaction = useUserStore((state) => state.questFaction);
    const traderLoyaltyLevels = useUserStore((state) => state.questTraderLoyaltyLevels);
    const fenceReputation = useUserStore((state) => state.questFenceReputation);
    const togglePinnedQuest = useUserStore((state) => state.togglePinnedQuest);
    const toggleIgnoredQuest = useUserStore((state) => state.toggleIgnoredQuest);
    const questMapData = useMemo(
        () => quest ? buildQuestDetailMapData(quest) : null,
        [quest],
    );
    const deferredMapData = useDeferredValue(questMapData);

    if (!quest) {
        return (
            <div className="flex min-h-[420px] border-t border-white/10 flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.025),transparent_45%)] p-8 text-center">
                <div className="max-w-xs">
                    <Flag size={24} className="mx-auto mb-4 text-gray-800" />
                    <p className="text-sm text-gray-600">Select a quest from the log to inspect its objectives, requirements, and progression links.</p>
                </div>
            </div>
        );
    }

    const status = statusByQuestId.get(quest.id)!;
    const traderImage = quest.trader.image4xLink ?? quest.trader.imageLink;
    const leadsTo = (leadsToByQuestId.get(quest.id) ?? []).map((id) => questsById.get(id)).filter(Boolean);
    const objectivePresentation = buildObjectivePresentation(quest.objectives);
    const traderTierCompletionGates = quest.otherRequirements
        .map(getTraderTierCompletionGate)
        .filter((gate): gate is NonNullable<typeof gate> => gate !== null);
    const unknownOtherRequirements = quest.otherRequirements.filter(
        (requirement) => !getTraderTierCompletionGate(requirement),
    );
    const hasRequirements = (quest.minPlayerLevel ?? 0) > 0 ||
        (!!quest.factionName && quest.factionName !== "Any") ||
        !!quest.requiredPrestige ||
        quest.traderRequirements.length > 0 ||
        quest.otherRequirements.length > 0 ||
        quest.taskRequirements.length > 0;
    const hasHeaderMetadata = !!quest.requiredPrestige ||
        !!quest.kappaRequired ||
        !!quest.lightkeeperRequired;
    const hasFailureDetails = (quest.failureTraderStandingRewards?.length ?? 0) > 0 ||
        (quest.failConditions?.length ?? 0) > 0;
    const detailColumnCount = Number(hasRequirements) + Number(leadsTo.length > 0) + Number(hasFailureDetails);
    const locationLabel = formatQuestMapSummary(quest, maps);
    const detailMaps = questMapData?.maps ?? [];
    const selectedDetailMapKey = mapTarget?.questId === quest.id &&
        detailMaps.some((map) => map.key === mapTarget.mapKey)
        ? mapTarget.mapKey
        : detailMaps[0]?.key ?? null;
    const selectedDetailMap = detailMaps.find((map) => map.key === selectedDetailMapKey) ?? null;
    const detailMarkersByMap: Map<string, MapOverlayMarker[]> =
        questMapData?.markersByMap ?? new Map<string, MapOverlayMarker[]>();
    const detailMarkers = selectedDetailMapKey
        ? detailMarkersByMap.get(selectedDetailMapKey) ?? []
        : [];
    const panelMapData = deferredMapData ?? questMapData;
    const panelMapKey = panelMapData && mapTarget?.questId === panelMapData.questId &&
        panelMapData.maps.some((map) => map.key === mapTarget.mapKey)
        ? mapTarget.mapKey
        : panelMapData?.maps[0]?.key ?? null;
    const panelSelectedMap = panelMapData?.maps.find((map) => map.key === panelMapKey) ?? null;
    const panelMarkers = panelMapKey
        ? panelMapData?.markersByMap.get(panelMapKey) ?? []
        : [];
    const isMapUpdatePending = !!panelMapData && panelMapData.questId !== quest.id;
    const focusedObjectiveId = mapTarget?.questId === quest.id &&
        mapTarget.mapKey === selectedDetailMapKey
        ? mapTarget.objectiveId
        : null;
    const focusRequestKey = focusedObjectiveId ? mapTarget?.requestKey ?? null : null;

    const showObjectiveOnMap = (mapKey: string, objectiveId: string) => {
        setMapTarget((current) => ({
            questId: quest.id,
            mapKey,
            objectiveId,
            requestKey: (current?.requestKey ?? 0) + 1,
        }));
        if (!window.matchMedia("(min-width: 1280px)").matches) {
            requestAnimationFrame(() => mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
        }
    };

    const selectDetailMap = (mapKey: string) => {
        setMapTarget((current) => ({
            questId: quest.id,
            mapKey,
            objectiveId: null,
            requestKey: (current?.requestKey ?? 0) + 1,
        }));
    };

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0c0e]">
            <header className="relative min-h-64 shrink-0 overflow-hidden border-b border-white/8 bg-[#15171a] px-6 py-8 sm:px-9 sm:py-10">
                {quest.taskImageLink && (
                    <div
                        className="pointer-events-none absolute inset-y-0 right-0"
                        style={{ maskImage: "linear-gradient(to right, transparent 0%, black 24%, black 100%)" }}
                    >
                        <img src={quest.taskImageLink} alt="" className="h-full w-auto max-w-none object-contain object-right opacity-55" />
                    </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0c0e] via-[#0b0c0e]/88 to-transparent" />
                <div className="relative max-w-2xl sm:pr-10">
                    <div className="mb-5 flex items-center gap-3">
                        {traderImage ? <img src={traderImage} alt="" className="h-10 w-10 rounded-full border border-white/10 object-cover" /> : null}
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">{quest.trader.name}</p>
                            <p className="text-xs text-gray-400">{locationLabel}</p>
                        </div>
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{quest.name}</h1>
                    {hasHeaderMetadata && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                        {quest.requiredPrestige && <MetadataBadge>Prestige {quest.requiredPrestige.prestigeLevel}</MetadataBadge>}
                        {quest.kappaRequired && <span className="border border-amber-400/20 bg-amber-400/8 px-2 py-1 text-amber-300">Kappa required</span>}
                        {quest.lightkeeperRequired && <span className="border border-cyan-400/20 bg-cyan-400/8 px-2 py-1 text-cyan-300">Lightkeeper required</span>}
                    </div>}
                    <div className="mt-6 flex flex-wrap gap-2">
                        <span className={cn("inline-flex items-center border px-3 py-2 text-xs font-semibold uppercase tracking-wider", status.status === "locked" || status.status === "failed" ? "border-red-400/25 bg-red-400/8 text-red-300" : status.status === "completed" ? "border-tarkov-green/25 bg-tarkov-green/8 text-tarkov-green" : "border-sky-400/25 bg-sky-400/8 text-sky-300")}>{status.label}</span>
                        <button type="button" onClick={() => { if (status.status !== "completed") retainQuestAfterCompletion(quest.id); requestToggleQuestCompletion(quest.id); }} className={cn(questActionButtonClass, status.status === "completed" ? "border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:border-red-400/50 hover:bg-red-400/15 hover:text-red-200" : "border-tarkov-green/35 bg-tarkov-green/12 text-tarkov-green hover:border-tarkov-green/70 hover:bg-tarkov-green/20")}><CheckCircle2 size={14} />{status.status === "completed" ? "Mark incomplete" : "Complete"}</button>
                        {questCanFail(quest) && !status.terminal && <button type="button" onClick={() => requestFailQuest(quest.id)} className={cn(questActionButtonClass, "border-red-400/35 bg-red-400/10 text-red-300 hover:border-red-400/65 hover:bg-red-400/20 hover:text-red-200")}><XCircle size={14} /> Fail</button>}
                        {status.terminal === "failed" && <button type="button" onClick={() => requestResetQuestStatus(quest.id)} className={cn(questActionButtonClass, "border-white/15 bg-white/7 text-gray-300 hover:border-white/30 hover:bg-white/12 hover:text-white")}><RotateCcw size={14} /> Reset</button>}
                        <button type="button" onClick={() => togglePinnedQuest(quest.id)} className={cn(questActionButtonClass, "border-white/15 bg-white/7 text-gray-400 hover:border-sky-400/40 hover:bg-sky-400/12 hover:text-sky-200", pinned && "border-sky-400/35 bg-sky-400/12 text-sky-300")}><Pin size={14} className={pinned ? "fill-current" : ""} />{pinned ? "Unpin" : "Pin"}</button>
                        <button type="button" onClick={() => toggleIgnoredQuest(quest.id)} className={cn(questActionButtonClass, "border-white/15 bg-white/7 text-gray-400 hover:border-violet-400/40 hover:bg-violet-400/12 hover:text-violet-200", hidden && "border-violet-400/35 bg-violet-400/12 text-violet-300")}>{hidden ? <Eye size={14} /> : <EyeOff size={14} />}{hidden ? "Show" : "Hide"}</button>
                    </div>
                </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,46%)] xl:overflow-hidden">
            <div className="min-w-0 xl:overflow-y-auto">
            <div className="max-w-6xl px-6 py-10 sm:px-9">
                <section>
                    {quest.wikiLink && (
                        <div className="mb-7">
                            <a href={quest.wikiLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-gray-500 transition-colors hover:text-tarkov-green">
                                Open quest wiki <ExternalLink size={12} />
                            </a>
                        </div>
                    )}
                    {detailColumnCount > 0 && <div className={cn(
                        "mb-12 grid gap-8",
                        detailColumnCount === 2 && "md:grid-cols-2",
                        detailColumnCount === 3 && "md:grid-cols-3",
                    )}>
                        {hasRequirements && <section className="min-w-0">
                            <SectionLabel>Requirements</SectionLabel>
                            <div className="space-y-2.5 text-sm">
                            {(quest.minPlayerLevel ?? 0) > 0 && (
                                <RequirementRow
                                    satisfied={playerLevel >= (quest.minPlayerLevel ?? 0)}
                                    label="Player level"
                                >
                                    Level {quest.minPlayerLevel}
                                </RequirementRow>
                            )}
                            {quest.factionName && quest.factionName !== "Any" && (
                                <RequirementRow
                                    satisfied={questFaction ? questFaction === quest.factionName : null}
                                    label="Faction"
                                >
                                    {quest.factionName}
                                </RequirementRow>
                            )}
                            {quest.requiredPrestige && (
                                <RequirementRow satisfied={prestigeLevel >= quest.requiredPrestige.prestigeLevel} label="Prestige">
                                    Level {quest.requiredPrestige.prestigeLevel}
                                </RequirementRow>
                            )}
                            {quest.traderRequirements.map((requirement) => {
                                const gateType = getQuestTraderGateType(requirement);
                                const isFence = requirement.trader.normalizedName === "fence" || requirement.trader.name.toLowerCase() === "fence";
                                const currentValue = gateType === "level"
                                    ? traderLoyaltyLevels[requirement.trader.id] ?? 1
                                    : gateType === "reputation" && isFence
                                      ? fenceReputation
                                      : null;
                                return (
                                    <RequirementRow
                                        key={requirement.id}
                                        satisfied={currentValue == null ? null : compareRequirementValue(currentValue, requirement.compareMethod, requirement.value)}
                                        label="Trader"
                                    >
                                        {formatQuestTraderGate(requirement)}
                                    </RequirementRow>
                                );
                            })}
                            {traderTierCompletionGates.map((gate) => {
                                const completedCount = countCompletedTraderTierQuests(questsById.values(), completedQuests, gate);
                                return (
                                    <RequirementRow
                                        key={gate.variableId}
                                        satisfied={compareTraderTierCompletionCount(completedCount, gate)}
                                        label="Tasks completed"
                                        title={formatTraderTierCompletionGate(gate)}
                                    >
                                        {completedCount}/{gate.requiredCount} {gate.trader} LL{gate.tier} tasks
                                    </RequirementRow>
                                );
                            })}
                            {unknownOtherRequirements.map((requirement, index) => (
                                <RequirementRow key={requirement.id ?? `${requirement.type}-${index}`} satisfied={null} label={humanize(requirement.requirementType || requirement.type || "Other")}>
                                    {formatOtherRequirementDetails(requirement) || "Required"}
                                </RequirementRow>
                            ))}
                            {quest.taskRequirements.map((requirement) => (
                                <RequirementRow
                                    key={requirement.task.id}
                                    satisfied={isTaskRequirementSatisfied(requirement.status, !!completedQuests[requirement.task.id], !!failedQuests[requirement.task.id])}
                                    label={formatTaskRequirementStatus(requirement.status)}
                                    onClick={() => setSelectedQuestId(requirement.task.id)}
                                >
                                    {requirement.task.name}
                                </RequirementRow>
                            ))}
                            </div>
                        </section>}
                        {leadsTo.length > 0 && <section className="min-w-0">
                            <SectionLabel>Unlocks</SectionLabel>
                            <div className="space-y-2.5 text-sm">
                                {leadsTo.map((nextQuest) => nextQuest && (
                                    <div key={nextQuest.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedQuestId(nextQuest.id)}
                                            className="cursor-pointer text-left text-gray-300 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-current"
                                        >
                                            {nextQuest.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>}
                        {hasFailureDetails && <section className="min-w-0">
                            <SectionLabel>Failure conditions</SectionLabel>
                            <div className="space-y-5">
                                {(quest.failConditions?.length ?? 0) > 0 && <div className="space-y-2">{quest.failConditions?.map((condition) => <div key={condition.id} className="border border-red-400/12 bg-red-400/5 px-3 py-2 text-xs text-red-200/80"><p>{condition.description || condition.type}</p>{condition.type === "taskStatus" && "status" in condition && <p className="mt-1 text-[10px] text-red-200/40">Quest status: {condition.status.join(" or ")}</p>}</div>)}</div>}
                                {(quest.failureTraderStandingRewards?.length ?? 0) > 0 && <StandingRewards label="Failure reputation" rewards={quest.failureTraderStandingRewards ?? []} />}
                            </div>
                        </section>}
                    </div>}
                    <SectionLabel>Objectives</SectionLabel>
                    {quest.objectives.length > 0 ? (
                        <div className="space-y-7">
                            {objectivePresentation.map(({ objective, showItems }) => {
                                const objectiveMaps = getPositionedObjectiveMaps(objective);
                                const cueMapKey = objectiveMaps.some((map) => map.key === selectedDetailMapKey)
                                    ? selectedDetailMapKey
                                    : objectiveMaps[0]?.key;
                                const objectiveMarkers = cueMapKey
                                    ? (detailMarkersByMap.get(cueMapKey) ?? []).filter((marker) =>
                                          marker.objectiveIds?.includes(objective.id),
                                      )
                                    : [];
                                const objectiveMarkerCues = [...new Map<string, MapOverlayMarker>(
                                    objectiveMarkers.map((marker) => [`${marker.label}:${marker.color}`, marker]),
                                ).values()];
                                const positionedLocationCount = objectiveMaps.reduce(
                                    (count, map) => count + map.locationCount,
                                    0,
                                );
                                const multipleLocationLabel = positionedLocationCount > 1
                                    ? objective.locations?.some((location) => location.position && location.source === "possibleLocation")
                                        ? "Multiple spawns"
                                        : "Multiple locations"
                                    : null;
                                const isFocused = focusedObjectiveId === objective.id;
                                return (
                                    <div
                                        key={objective.id}
                                        className={cn(
                                            objectiveMaps.length > 0 && "border-l-2 bg-white/[0.015] py-3 pl-4 pr-3",
                                            isFocused && "bg-white/[0.045]",
                                        )}
                                        style={objectiveMaps.length > 0 ? { borderLeftColor: objectiveMarkers[0]?.color } : undefined}
                                    >
                                        {objectiveMaps.length > 0 && (
                                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                                    <span className="flex -space-x-1">
                                                        {objectiveMarkerCues.map((marker) => (
                                                            <span
                                                                key={marker.id}
                                                                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border bg-black/90 px-1 font-mono text-[10px]"
                                                                style={{ color: marker.color, borderColor: marker.color }}
                                                            >
                                                                {marker.label}
                                                            </span>
                                                        ))}
                                                    </span>
                                                    Mapped objective
                                                    {multipleLocationLabel && (
                                                        <span className="border border-amber-300/20 bg-amber-300/8 px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-amber-200/80">
                                                            {multipleLocationLabel}
                                                        </span>
                                                    )}
                                                </span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {objectiveMaps.map((map) => (
                                                        <button
                                                            type="button"
                                                            key={map.key}
                                                            onClick={() => showObjectiveOnMap(map.key, objective.id)}
                                                            className="inline-flex items-center gap-1.5 border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-medium text-gray-400 transition-colors hover:border-tarkov-green/40 hover:text-tarkov-green"
                                                        >
                                                            <MapPinned size={11} />
                                                            {objectiveMaps.length > 1 ? `Show on ${map.name}` : "Show on map"}
                                                            {map.locationCount > 1 && <span className="text-gray-600">· {map.locationCount}</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <ObjectiveRow objective={objective} onItemClick={onItemClick ?? undefined} itemDisplay="rows" showItems={showItems} />
                                    </div>
                                );
                            })}
                        </div>
                    ) : <p className="text-xs text-gray-600">No objectives provided.</p>}

                    {(quest.finishTraderStandingRewards?.length ?? 0) > 0 && <div className="mt-12">
                        <SectionLabel>Rewards</SectionLabel>
                        <div className="space-y-2.5 text-sm">
                            {(quest.finishTraderStandingRewards ?? []).map((reward, index) => (
                                <p key={`${reward.trader.id}-${index}`} className={reward.standing >= 0 ? "text-tarkov-green" : "text-red-300"}>
                                    <span className="mr-2 text-gray-600">{reward.trader.name} reputation</span>{formatStanding(reward.standing)}
                                </p>
                            ))}
                        </div>
                    </div>}
                </section>
            </div>
            </div>

            {selectedDetailMap && (
                <aside
                    ref={mapSectionRef}
                    className="order-first flex h-[52vh] min-h-80 flex-col border-b border-white/10 bg-[#0a0b0d] xl:order-last xl:h-auto xl:min-h-0 xl:border-b-0 xl:border-l"
                >
                    <div className="shrink-0 border-b border-white/10 bg-[#101113] px-4 py-3">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Objective map</p>
                                <p className="mt-1 text-xs text-gray-400">
                                    {detailMarkers.length} mapped location{detailMarkers.length === 1 ? "" : "s"} on {selectedDetailMap.name}
                                </p>
                            </div>
                            {detailMaps.length > 1 && (
                                <div className="flex flex-wrap gap-1.5" aria-label="Quest objective maps">
                                    {detailMaps.map((map) => (
                                        <button
                                            type="button"
                                            key={map.key}
                                            aria-pressed={map.key === selectedDetailMapKey}
                                            onClick={() => selectDetailMap(map.key)}
                                            className={cn(
                                                "border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                                                map.key === selectedDetailMapKey
                                                    ? "border-tarkov-green/45 bg-tarkov-green/10 text-tarkov-green"
                                                    : "border-white/10 bg-white/3 text-gray-500 hover:border-white/25 hover:text-gray-200",
                                            )}
                                        >
                                            {map.name} · {map.locationCount}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#08090a]">
                        {panelSelectedMap ? (
                            <LazyMapViewer
                                mapKey={panelSelectedMap.key}
                                markers={panelMarkers}
                                highlightedObjectiveId={!isMapUpdatePending ? focusedObjectiveId : null}
                                focusedObjectiveId={!isMapUpdatePending ? focusedObjectiveId : null}
                                focusRequestKey={!isMapUpdatePending ? focusRequestKey : null}
                                onMarkerSelect={(marker) => {
                                    const objectiveId = marker.objectiveIds?.[0];
                                    if (objectiveId) showObjectiveOnMap(panelSelectedMap.key, objectiveId);
                                }}
                            />
                        ) : (
                            <MapLoadingPlaceholder label="Preparing objective map…" />
                        )}
                        {isMapUpdatePending && (
                            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                                <span className="border border-white/10 bg-black/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-300 shadow-xl">
                                    Updating map…
                                </span>
                            </div>
                        )}
                    </div>
                </aside>
            )}
            </div>

            {showDebug && <QuestDebugPanel quest={quest} onClose={() => setShowDebug(false)} />}
            <button
                type="button"
                onClick={() => setShowDebug((visible) => !visible)}
                aria-label={showDebug ? "Hide quest debug data" : "Show quest debug data"}
                aria-expanded={showDebug}
                className={cn("fixed bottom-5 left-5 z-50 flex h-9 w-9 items-center justify-center rounded-full border bg-[#111316] shadow-xl transition-colors", showDebug ? "border-tarkov-green/50 text-tarkov-green" : "border-white/12 text-gray-600 hover:border-white/25 hover:text-gray-300")}
            >
                <Bug size={15} />
            </button>
        </div>
    );
}

function buildQuestDetailMapData(quest: FullQuest) {
    const maps = getQuestDetailMaps(quest);
    const styles = createQuestDetailObjectiveStyles(quest);
    return {
        questId: quest.id,
        maps,
        styles,
        markersByMap: new Map(
            maps.map((map) => [map.key, buildQuestDetailMarkers(quest, map.key, styles)]),
        ),
    };
}

function MapLoadingPlaceholder({ label }: { label: string }) {
    return (
        <div className="flex h-full min-h-72 items-center justify-center bg-[#0b0c0e] p-8 text-center">
            <div>
                <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-tarkov-green" />
                <p className="mt-3 text-xs font-medium text-gray-500">{label}</p>
            </div>
        </div>
    );
}

function MetadataBadge({ children }: { children: React.ReactNode }) {
    return <span className="border border-white/10 bg-black/20 px-2 py-1 text-gray-400">{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-gray-600">{children}</h2>;
}

const questActionButtonClass = "inline-flex cursor-pointer select-none items-center gap-2 border px-3 py-2 text-xs font-semibold shadow-[0_2px_0_rgba(0,0,0,0.35)] transition-[transform,background-color,border-color,color,box-shadow] hover:-translate-y-px active:translate-y-px active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#15171a]";

function RequirementRow({
    children,
    label,
    satisfied,
    onClick,
    title,
}: {
    children: React.ReactNode;
    label: string;
    satisfied: boolean | null;
    onClick?: () => void;
    title?: string;
}) {
    const icon = satisfied === true
        ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-tarkov-green" />
        : satisfied === false
          ? <XCircle size={14} className="mt-0.5 shrink-0 text-red-300" />
          : <Circle size={14} className="mt-0.5 shrink-0 text-gray-600" />;
    return (
        <p title={title} className="flex items-start gap-2">
            {icon}
            <span>
                <span className="mr-2 text-gray-600">{label}</span>
                {onClick ? (
                    <button
                        type="button"
                        onClick={onClick}
                        className={cn(
                            "cursor-pointer text-left underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-current",
                            satisfied === false ? "text-red-200/80" : "text-gray-300",
                        )}
                    >
                        {children}
                    </button>
                ) : (
                    <span className={satisfied === false ? "text-red-200/80" : "text-gray-300"}>{children}</span>
                )}
            </span>
        </p>
    );
}

interface ObjectivePresentation {
    objective: FullQuestObjective;
    showItems: boolean;
}

function getRegularItemKey(objective: FullQuestObjective) {
    if (!("items" in objective) || !Array.isArray(objective.items) || objective.items.length === 0) return null;
    return objective.items.map((item) => item.id).sort().join(":");
}

function getQuestItemKey(objective: FullQuestObjective) {
    if ((objective.type !== "pickupQuestItem" && objective.type !== "findQuestItem") || !("questItem" in objective)) return null;
    return objective.questItem.id;
}

function buildObjectivePresentation(objectives: FullQuestObjective[]): ObjectivePresentation[] {
    const deferredFindByGiveIndex = new Map<number, number>();
    const deferredFindIndices = new Set<number>();

    objectives.forEach((objective, findIndex) => {
        if (objective.type !== "findItem") return;
        const itemKey = getRegularItemKey(objective);
        if (!itemKey) return;
        const giveIndex = objectives.findIndex((candidate, candidateIndex) =>
            candidateIndex > findIndex && candidate.type === "giveItem" && getRegularItemKey(candidate) === itemKey
        );
        if (giveIndex >= 0 && !deferredFindByGiveIndex.has(giveIndex)) {
            deferredFindByGiveIndex.set(giveIndex, findIndex);
            deferredFindIndices.add(findIndex);
        }
    });

    const questItemGroups = new Map<string, number[]>();
    objectives.forEach((objective, index) => {
        const itemKey = getQuestItemKey(objective);
        if (itemKey) questItemGroups.set(itemKey, [...(questItemGroups.get(itemKey) ?? []), index]);
    });
    const deferredQuestItemIndices = new Set([...questItemGroups.values()].flatMap((indices) => indices.slice(0, -1)));

    const result: ObjectivePresentation[] = [];
    objectives.forEach((objective, index) => {
        if (deferredFindIndices.has(index) || deferredQuestItemIndices.has(index)) return;

        const findIndex = deferredFindByGiveIndex.get(index);
        if (findIndex != null) result.push({ objective: objectives[findIndex], showItems: false });

        const questItemKey = getQuestItemKey(objective);
        const questItemGroup = questItemKey ? questItemGroups.get(questItemKey) ?? [] : [];
        if (questItemGroup.length > 1 && questItemGroup.at(-1) === index) {
            questItemGroup.slice(0, -1).forEach((groupIndex) => result.push({ objective: objectives[groupIndex], showItems: false }));
        }

        result.push({ objective, showItems: true });
    });
    return result;
}

function QuestDebugPanel({ quest, onClose }: { quest: FullQuest; onClose: () => void }) {
    return (
        <aside className="fixed bottom-16 right-5 z-50 flex max-h-[70vh] w-[min(680px,calc(100vw-2.5rem))] flex-col overflow-hidden border border-white/15 bg-[#101215] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div><p className="text-xs font-semibold text-white">Quest debug data</p><p className="mt-0.5 text-[10px] text-gray-600">Normalized data received by this page</p></div>
                <button type="button" onClick={onClose} aria-label="Close quest debug data" className="text-gray-600 hover:text-white"><X size={15} /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4">
                <DebugJson label="Objectives" value={quest.objectives} />
                <DebugJson label="Full quest" value={quest} />
            </div>
        </aside>
    );
}

function DebugJson({ label, value }: { label: string; value: unknown }) {
    return (
        <details className="mb-3 border border-white/8 bg-black/25" open={label === "Objectives"}>
            <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</summary>
            <pre className="max-h-80 overflow-auto border-t border-white/8 p-3 text-[10px] leading-relaxed text-gray-500">{JSON.stringify(value, null, 2)}</pre>
        </details>
    );
}

function formatOtherRequirementDetails(requirement: QuestOtherRequirement) {
    const knownKeys = new Set(["id", "type", "requirementType"]);
    const details = Object.entries(requirement).filter(([key, value]) => !knownKeys.has(key) && value != null).map(([key, value]) => `${humanize(key)}: ${formatUnknownValue(value)}`);
    return details.join(" · ");
}

function compareRequirementValue(current: number, method: string, required: number) {
    switch (method.trim()) {
        case ">": return current > required;
        case "<": return current < required;
        case "<=": return current <= required;
        case "=":
        case "==":
        case "===": return current === required;
        case "!=":
        case "!==": return current !== required;
        default: return current >= required;
    }
}

function isTaskRequirementSatisfied(statuses: string[], completed: boolean, failed: boolean) {
    const normalized = statuses.map((status) => status.trim().toLowerCase());
    if (normalized.some((status) => status === "success" || status === "complete" || status === "completed")) return completed;
    if (normalized.some((status) => status === "fail" || status === "failed")) return failed;
    if (normalized.includes("active")) return completed || failed;
    return completed;
}

function formatTaskRequirementStatus(statuses: string[]) {
    const normalized = statuses.map((status) => status.trim().toLowerCase());
    if (normalized.some((status) => status === "fail" || status === "failed")) return "Task failed";
    if (normalized.includes("active")) return "Task attempted";
    return "Task completed";
}

function StandingRewards({ label, rewards }: { label: string; rewards: QuestTraderStandingReward[] }) {
    return <section><SectionLabel>{label}</SectionLabel><div className="space-y-2">{rewards.map((reward, index) => <div key={`${reward.trader.id}-${index}`} className="flex items-center justify-between border border-white/8 px-3 py-2.5 text-sm"><span className="text-gray-400">{reward.trader.name}</span><span className={reward.standing >= 0 ? "text-tarkov-green" : "text-red-300"}>{formatStanding(reward.standing)}</span></div>)}</div></section>;
}

function formatStanding(value: number) {
    return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 3 })}`;
}

function humanize(value: string) {
    return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function formatUnknownValue(value: unknown): string {
    if (Array.isArray(value)) return value.map(formatUnknownValue).join(", ");
    if (typeof value === "object" && value !== null) return Object.entries(value).map(([key, nested]) => `${humanize(key)} ${formatUnknownValue(nested)}`).join(", ");
    return String(value);
}
