"use client";

import { CheckCircle2, ExternalLink, Flag, Lock, PackageCheck, Pin, RotateCcw, XCircle } from "lucide-react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { formatQuestTraderGate } from "@/lib/utils/quest-trader-gates";
import { questCanFail } from "@/lib/utils/quest-failures";
import type { FullQuestObjective, QuestOtherRequirement, QuestTraderStandingReward } from "@/types";
import { ObjectiveRow } from "../components/quest-card/QuestObjectiveRows";
import { useQuestsContext } from "../QuestsContext";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestDetailsPane() {
    const { selectedQuest: quest, statusByQuestId, questsById, setSelectedQuestId } = useQuestWorkspace();
    const { leadsToByQuestId, onItemClick, requestToggleQuestCompletion, requestFailQuest, requestResetQuestStatus } = useQuestsContext();
    const pinned = useUserStore((state) => quest ? !!state.pinnedQuests[quest.id] : false);
    const haveItems = useUserStore((state) => quest ? !!state.questsWithItems[quest.id] : false);
    const togglePinnedQuest = useUserStore((state) => state.togglePinnedQuest);
    const toggleQuestHaveItems = useUserStore((state) => state.toggleQuestHaveItems);

    if (!quest) {
        return (
            <div className="flex min-h-[420px] flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.025),transparent_45%)] p-8 text-center">
                <div className="max-w-xs">
                    <Flag size={24} className="mx-auto mb-4 text-gray-800" />
                    <p className="text-sm text-gray-600">Select a quest from the log to inspect its objectives, requirements, and progression links.</p>
                </div>
            </div>
        );
    }

    const status = statusByQuestId.get(quest.id)!;
    const hasItemObjectives = quest.objectives.some((objective) => objective.type === "giveItem" || objective.type === "plantItem");
    const traderImage = quest.trader.image4xLink ?? quest.trader.imageLink;
    const leadsTo = (leadsToByQuestId.get(quest.id) ?? []).map((id) => questsById.get(id)).filter(Boolean);

    return (
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#0b0c0e]">
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
                            <p className="text-xs text-gray-400">{quest.map?.name ?? "Multiple locations"}</p>
                        </div>
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{quest.name}</h1>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                        <span className={cn("border px-2 py-1", status.status === "locked" ? "border-red-400/25 bg-red-400/8 text-red-300" : status.status === "completed" ? "border-tarkov-green/25 bg-tarkov-green/8 text-tarkov-green" : "border-sky-400/25 bg-sky-400/8 text-sky-300")}>{status.label}</span>
                        {(quest.minPlayerLevel ?? 0) > 0 && <MetadataBadge>Level {quest.minPlayerLevel}</MetadataBadge>}
                        <MetadataBadge>{quest.experience.toLocaleString()} XP</MetadataBadge>
                        <MetadataBadge>{quest.factionName && quest.factionName !== "Any" ? quest.factionName : "Any faction"}</MetadataBadge>
                        {quest.requiredPrestige && <MetadataBadge>Prestige {quest.requiredPrestige.prestigeLevel}</MetadataBadge>}
                        {quest.kappaRequired && <span className="border border-amber-400/20 bg-amber-400/8 px-2 py-1 text-amber-300">Kappa</span>}
                        {quest.lightkeeperRequired && <span className="border border-cyan-400/20 bg-cyan-400/8 px-2 py-1 text-cyan-300">Lightkeeper</span>}
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                        <button type="button" onClick={() => requestToggleQuestCompletion(quest.id)} className={cn("inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors", status.status === "completed" ? "border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-300" : "border-tarkov-green/30 bg-tarkov-green/10 text-tarkov-green hover:border-tarkov-green/60")}><CheckCircle2 size={14} />{status.status === "completed" ? "Mark incomplete" : "Complete"}</button>
                        {questCanFail(quest) && !status.terminal && <button type="button" onClick={() => requestFailQuest(quest.id)} className="inline-flex items-center gap-2 border border-red-400/25 bg-red-400/8 px-3 py-2 text-xs text-red-300"><XCircle size={14} /> Failed</button>}
                        {status.terminal === "failed" && <button type="button" onClick={() => requestResetQuestStatus(quest.id)} className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300"><RotateCcw size={14} /> Reset</button>}
                        <button type="button" onClick={() => togglePinnedQuest(quest.id)} className={cn("inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400", pinned && "border-sky-400/25 bg-sky-400/8 text-sky-300")}><Pin size={14} className={pinned ? "fill-current" : ""} />{pinned ? "Unpin" : "Pin"}</button>
                        {hasItemObjectives && <button type="button" onClick={() => toggleQuestHaveItems(quest.id)} className={cn("inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400", haveItems && "border-amber-400/25 bg-amber-400/8 text-amber-300")}><PackageCheck size={14} />Items {haveItems ? "ready" : "needed"}</button>}
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 sm:px-9 xl:grid-cols-[minmax(0,1fr)_300px]">
                <section>
                    <SectionLabel>Objectives</SectionLabel>
                    {quest.objectives.length > 0 ? (
                        <div className="space-y-5">
                            {quest.objectives.map((objective) => (
                                <div key={objective.id} className="border-b border-white/6 pb-5">
                                    <ObjectiveRow objective={objective} onItemClick={onItemClick ?? undefined} />
                                    <ObjectiveDetails objective={objective} />
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-xs text-gray-600">No objectives provided.</p>}
                </section>
                <aside className="space-y-7">
                    {status.reasons.length > 0 && <section><SectionLabel>Locked by</SectionLabel><div className="space-y-2">{status.reasons.map((reason, index) => <div key={`${reason.kind}-${index}`} className="flex items-center gap-2 border border-red-400/12 bg-red-400/5 px-3 py-2 text-xs text-red-200/80"><Lock size={12} />{reason.label}</div>)}</div></section>}
                    {quest.requiredPrestige && (
                        <section><SectionLabel>Prestige requirement</SectionLabel><div className="flex items-center gap-3 border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-300">{(quest.requiredPrestige.iconLink ?? quest.requiredPrestige.imageLink) && <img src={quest.requiredPrestige.iconLink ?? quest.requiredPrestige.imageLink ?? ""} alt="" className="h-8 w-8 object-contain" />}<div><p>{quest.requiredPrestige.name}</p><p className="text-gray-600">Prestige level {quest.requiredPrestige.prestigeLevel}</p></div></div></section>
                    )}
                    {quest.traderRequirements.length > 0 && <section><SectionLabel>Trader gates</SectionLabel><div className="space-y-2">{quest.traderRequirements.map((requirement) => <div key={requirement.id} className="border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-400">{formatQuestTraderGate(requirement)}</div>)}</div></section>}
                    {quest.otherRequirements.length > 0 && <section><SectionLabel>Other gates</SectionLabel><div className="space-y-2">{quest.otherRequirements.map((requirement, index) => <OtherRequirement key={requirement.id ?? `${requirement.type}-${index}`} requirement={requirement} />)}</div></section>}
                    {quest.taskRequirements.length > 0 && <section><SectionLabel>Requires</SectionLabel><div className="space-y-1">{quest.taskRequirements.map((requirement) => <button type="button" key={requirement.task.id} onClick={() => setSelectedQuestId(requirement.task.id)} className="block w-full border-l border-white/10 px-3 py-1.5 text-left text-xs text-gray-400 hover:border-tarkov-green hover:text-white"><span className="block">{requirement.task.name}</span>{requirement.status.length > 0 && <span className="text-[10px] text-gray-600">Status: {requirement.status.join(" or ")}</span>}</button>)}</div></section>}
                    {leadsTo.length > 0 && <section><SectionLabel>Unlocks</SectionLabel><div className="space-y-1">{leadsTo.map((nextQuest) => nextQuest && <button type="button" key={nextQuest.id} onClick={() => setSelectedQuestId(nextQuest.id)} className="block w-full border-l border-white/10 px-3 py-1.5 text-left text-xs text-gray-400 hover:border-tarkov-green hover:text-white">{nextQuest.name}</button>)}</div></section>}
                    {(quest.finishTraderStandingRewards?.length ?? 0) > 0 && <StandingRewards label="Reputation rewards" rewards={quest.finishTraderStandingRewards ?? []} />}
                    {(quest.failureTraderStandingRewards?.length ?? 0) > 0 && <StandingRewards label="Failure reputation" rewards={quest.failureTraderStandingRewards ?? []} />}
                    {(quest.failConditions?.length ?? 0) > 0 && <section><SectionLabel>Failure conditions</SectionLabel><div className="space-y-2">{quest.failConditions?.map((condition) => <div key={condition.id} className="border border-red-400/12 bg-red-400/5 px-3 py-2 text-xs text-red-200/80"><p>{condition.description || condition.type}</p>{condition.type === "taskStatus" && "status" in condition && <p className="mt-1 text-[10px] text-red-200/40">Quest status: {condition.status.join(" or ")}</p>}</div>)}</div></section>}
                    {quest.wikiLink && <a href={quest.wikiLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-tarkov-green">Open quest wiki <ExternalLink size={12} /></a>}
                </aside>
            </div>
        </div>
    );
}

function MetadataBadge({ children }: { children: React.ReactNode }) {
    return <span className="border border-white/10 bg-black/20 px-2 py-1 text-gray-400">{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">{children}</h2>;
}

function DetailChips({ values }: { values: Array<string | null | undefined | false> }) {
    const visible = values.filter((value): value is string => typeof value === "string" && value.length > 0);
    if (visible.length === 0) return null;
    return <div className="ml-5 mt-2 flex flex-wrap gap-1.5">{visible.map((value, index) => <span key={`${value}-${index}`} className="border border-white/8 bg-white/3 px-2 py-1 text-[10px] text-gray-500">{value}</span>)}</div>;
}

function ObjectiveDetails({ objective }: { objective: FullQuestObjective }) {
    const shared = [`Type: ${objective.type}`, objective.maps?.length ? `Maps: ${objective.maps.map((map) => map.name).join(", ")}` : null, objective.count != null ? `Count: ${objective.count}` : null];
    switch (objective.type) {
        case "shoot":
            if ("target" in objective) return <DetailChips values={[...shared, objective.targetNames?.length ? `Targets: ${objective.targetNames.join(", ")}` : objective.target ? `Target: ${objective.target}` : null, objective.shotType ? `Method: ${objective.shotType}` : null, objective.zoneNames?.length ? `Zones: ${objective.zoneNames.join(", ")}` : null, objective.bodyParts.length ? `Body parts: ${objective.bodyParts.join(", ")}` : null]} />;
            break;
        case "extract":
            if ("exitName" in objective) return <DetailChips values={[...shared, objective.exitName ? `Exit: ${objective.exitName}` : null, objective.exitStatus?.length ? `Exit status: ${objective.exitStatus.join(", ")}` : null, objective.zoneNames?.length ? `Zones: ${objective.zoneNames.join(", ")}` : null]} />;
            break;
        case "buildItem":
            if ("item" in objective) return <DetailChips values={[...shared, `Build: ${objective.item.name}`, objective.containsAll.length ? `Must contain: ${objective.containsAll.map((item) => item.name).join(", ")}` : null, objective.containsCategory.length ? `Categories: ${objective.containsCategory.map((category) => category.name).join(", ")}` : null, ...formatBuildAttributes(objective.attributes)]} />;
            break;
        case "hideoutStation":
            if ("hideoutStation" in objective) return <DetailChips values={[...shared, `Station: ${objective.hideoutStation.name}`, objective.stationLevel != null ? `Station level: ${objective.stationLevel}` : null]} />;
            break;
        case "pickupQuestItem":
        case "findQuestItem":
            if ("questItem" in objective) return <DetailChips values={[...shared, `Quest item: ${objective.questItem.name}`]} />;
            break;
        case "taskStatus":
            if ("task" in objective) return <DetailChips values={[...shared, `Quest: ${objective.task.name}`, objective.status.length ? `Status: ${objective.status.join(" or ")}` : null]} />;
            break;
        case "traderLevel":
            if ("trader" in objective && "level" in objective) return <DetailChips values={[...shared, `Trader: ${objective.trader.name}`, `Loyalty level: ${objective.level}`]} />;
            break;
        case "traderStanding":
            if ("trader" in objective && "compareMethod" in objective) return <DetailChips values={[...shared, `Trader: ${objective.trader.name}`, `Standing ${objective.compareMethod} ${objective.value}`]} />;
            break;
        case "playerLevel":
            if ("playerLevel" in objective) return <DetailChips values={[...shared, `Player level: ${objective.playerLevel}`]} />;
            break;
        case "useItem":
            if ("useAny" in objective) return <DetailChips values={[...shared, objective.useAny.length ? `Use: ${objective.useAny.map((item) => item.name).join(" or ")}` : null, `Requirement: ${objective.compareMethod} ${objective.count}`, objective.zoneNames.length ? `Zones: ${objective.zoneNames.join(", ")}` : null]} />;
            break;
    }
    return <DetailChips values={shared} />;
}

function OtherRequirement({ requirement }: { requirement: QuestOtherRequirement }) {
    const label = requirement.requirementType || requirement.type || "Requirement";
    const knownKeys = new Set(["id", "type", "requirementType"]);
    const details = Object.entries(requirement).filter(([key, value]) => !knownKeys.has(key) && value != null).map(([key, value]) => `${humanize(key)}: ${formatUnknownValue(value)}`);
    return <div className="border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-400"><p>{humanize(label)}</p>{details.length > 0 && <p className="mt-1 text-[10px] text-gray-600">{details.join(" · ")}</p>}</div>;
}

function StandingRewards({ label, rewards }: { label: string; rewards: QuestTraderStandingReward[] }) {
    return <section><SectionLabel>{label}</SectionLabel><div className="space-y-2">{rewards.map((reward, index) => <div key={`${reward.trader.id}-${index}`} className="flex items-center justify-between border border-white/8 px-3 py-2 text-xs"><span className="text-gray-400">{reward.trader.name}</span><span className={reward.standing >= 0 ? "text-tarkov-green" : "text-red-300"}>{formatStanding(reward.standing)}</span></div>)}</div></section>;
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

function formatBuildAttributes(value: unknown): string[] {
    const attributes = Array.isArray(value)
        ? value
        : typeof value === "object" && value !== null
            ? Object.entries(value).map(([name, requirement]) => ({ name, requirement }))
            : [];
    return attributes.map((attribute) => {
        if (typeof attribute !== "object" || attribute === null) return formatUnknownValue(attribute);
        const record = attribute as Record<string, unknown>;
        const requirement = typeof record.requirement === "object" && record.requirement !== null
            ? record.requirement as Record<string, unknown>
            : {};
        return `${humanize(String(record.name ?? "Requirement"))} ${String(requirement.compareMethod ?? "")} ${String(requirement.value ?? "")}`.trim();
    });
}
