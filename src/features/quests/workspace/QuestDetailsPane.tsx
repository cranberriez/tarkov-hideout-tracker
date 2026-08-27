"use client";

import { useState } from "react";
import { Bug, CheckCircle2, Circle, Eye, EyeOff, ExternalLink, Flag, Pin, RotateCcw, X, XCircle } from "lucide-react";
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
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestDetailsPane() {
    const [showDebug, setShowDebug] = useState(false);
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
    const hasHeaderMetadata = (quest.minPlayerLevel ?? 0) > 0 ||
        !!quest.requiredPrestige ||
        !!quest.kappaRequired ||
        !!quest.lightkeeperRequired;
    const locationLabel = formatQuestMapSummary(quest, maps);

    return (
        <div className="relative min-h-0 flex-1 overflow-y-auto bg-[#0b0c0e]">
            <header className="relative min-h-64 overflow-hidden border-b border-white/8 bg-[#15171a] px-6 py-8 sm:px-9 sm:py-10">
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
                        {(quest.minPlayerLevel ?? 0) > 0 && <MetadataBadge>Level {quest.minPlayerLevel}</MetadataBadge>}
                        {quest.requiredPrestige && <MetadataBadge>Prestige {quest.requiredPrestige.prestigeLevel}</MetadataBadge>}
                        {quest.kappaRequired && <span className="border border-amber-400/20 bg-amber-400/8 px-2 py-1 text-amber-300">Kappa required</span>}
                        {quest.lightkeeperRequired && <span className="border border-cyan-400/20 bg-cyan-400/8 px-2 py-1 text-cyan-300">Lightkeeper required</span>}
                    </div>}
                    <div className="mt-6 flex flex-wrap gap-2">
                        <span className={cn("inline-flex items-center border px-3 py-2 text-xs font-semibold uppercase tracking-wider", status.status === "locked" ? "border-red-400/25 bg-red-400/8 text-red-300" : status.status === "completed" ? "border-tarkov-green/25 bg-tarkov-green/8 text-tarkov-green" : "border-sky-400/25 bg-sky-400/8 text-sky-300")}>{status.label}</span>
                        <button type="button" onClick={() => { if (status.status !== "completed") retainQuestAfterCompletion(quest.id); requestToggleQuestCompletion(quest.id); }} className={cn("inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors", status.status === "completed" ? "border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-300" : "border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:border-tarkov-green/60")}><CheckCircle2 size={14} />{status.status === "completed" ? "Mark incomplete" : "Complete"}</button>
                        {questCanFail(quest) && !status.terminal && <button type="button" onClick={() => requestFailQuest(quest.id)} className="inline-flex items-center gap-2 border border-red-400/25 bg-red-400/8 px-3 py-2 text-xs text-red-300"><XCircle size={14} /> Failed</button>}
                        {status.terminal === "failed" && <button type="button" onClick={() => requestResetQuestStatus(quest.id)} className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300"><RotateCcw size={14} /> Reset</button>}
                        <button type="button" onClick={() => togglePinnedQuest(quest.id)} className={cn("inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400", pinned && "border-sky-400/25 bg-sky-400/8 text-sky-300")}><Pin size={14} className={pinned ? "fill-current" : ""} />{pinned ? "Unpin" : "Pin"}</button>
                        <button type="button" onClick={() => toggleIgnoredQuest(quest.id)} className={cn("inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400", hidden && "border-violet-400/25 bg-violet-400/8 text-violet-300")}>{hidden ? <Eye size={14} /> : <EyeOff size={14} />}{hidden ? "Show" : "Hide"}</button>
                    </div>
                </div>
            </header>

            <div className="grid max-w-6xl gap-10 px-6 py-10 sm:px-9 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section>
                    {quest.wikiLink && (
                        <div className="mb-7">
                            <a href={quest.wikiLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-gray-500 transition-colors hover:text-tarkov-green">
                                Open quest wiki <ExternalLink size={12} />
                            </a>
                        </div>
                    )}
                    {hasRequirements && <div className="mb-12">
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
                    </div>}
                    <SectionLabel>Objectives</SectionLabel>
                    {quest.objectives.length > 0 ? (
                        <div className="space-y-7">
                            {objectivePresentation.map(({ objective, showItems }) => (
                                <div key={objective.id}>
                                    <ObjectiveRow objective={objective} onItemClick={onItemClick ?? undefined} itemDisplay="rows" showItems={showItems} />
                                </div>
                            ))}
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
                <aside className="space-y-7">
                    {leadsTo.length > 0 && <section>
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
                    {(quest.failureTraderStandingRewards?.length ?? 0) > 0 && <StandingRewards label="Failure reputation" rewards={quest.failureTraderStandingRewards ?? []} />}
                    {(quest.failConditions?.length ?? 0) > 0 && <section><SectionLabel>Failure conditions</SectionLabel><div className="space-y-2">{quest.failConditions?.map((condition) => <div key={condition.id} className="border border-red-400/12 bg-red-400/5 px-3 py-2 text-xs text-red-200/80"><p>{condition.description || condition.type}</p>{condition.type === "taskStatus" && "status" in condition && <p className="mt-1 text-[10px] text-red-200/40">Quest status: {condition.status.join(" or ")}</p>}</div>)}</div></section>}
                </aside>
            </div>

            {showDebug && <QuestDebugPanel quest={quest} onClose={() => setShowDebug(false)} />}
            <button
                type="button"
                onClick={() => setShowDebug((visible) => !visible)}
                aria-label={showDebug ? "Hide quest debug data" : "Show quest debug data"}
                aria-expanded={showDebug}
                className={cn("fixed bottom-5 right-5 z-50 flex h-9 w-9 items-center justify-center rounded-full border bg-[#111316] shadow-xl transition-colors", showDebug ? "border-tarkov-green/50 text-tarkov-green" : "border-white/12 text-gray-600 hover:border-white/25 hover:text-gray-300")}
            >
                <Bug size={15} />
            </button>
        </div>
    );
}

function MetadataBadge({ children }: { children: React.ReactNode }) {
    return <span className="border border-white/10 bg-black/20 px-2 py-1 text-gray-400">{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-gray-600">{children}</h2>;
}

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
