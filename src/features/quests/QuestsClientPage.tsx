"use client";

import { useState, useMemo, ReactNode } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { FullQuest } from "@/types";
import { QuestCard } from "./QuestCard";

interface QuestsClientPageProps {
    quests: FullQuest[];
    updatedAt: number;
}

type FactionFilter = "USEC" | "BEAR";

export function QuestsClientPage({ quests, updatedAt }: QuestsClientPageProps) {
    void updatedAt;

    const { completedQuests, playerLevel, setPlayerLevel, prestigeLevel, setPrestigeLevel } = useUserStore();

    const [selectedTraders, setSelectedTraders] = useState<Set<string>>(new Set());
    const [faction, setFaction] = useState<FactionFilter | null>(null);
    const [showKappa, setShowKappa] = useState(false);
    const [showLightkeeper, setShowLightkeeper] = useState(false);
    const [selectedMaps, setSelectedMaps] = useState<Set<string>>(new Set());
    const [hideCompleted, setHideCompleted] = useState(false);
    const [showAvailableOnly, setShowAvailableOnly] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const questsById = useMemo(() => new Map(quests.map((q) => [q.id, q])), [quests]);

    // Walk taskRequirements transitively to find all quests needed for a given root set.
    // Handles the case where tarkov.dev doesn't mark every prerequisite with kappaRequired/lightkeeperRequired.
    const kappaQuestIds = useMemo(() => {
        return getTransitivePrereqs(
            new Set(quests.filter((q) => q.kappaRequired).map((q) => q.id)),
            questsById,
        );
    }, [quests, questsById]);

    const lightkeeperQuestIds = useMemo(() => {
        return getTransitivePrereqs(
            new Set(quests.filter((q) => q.lightkeeperRequired).map((q) => q.id)),
            questsById,
        );
    }, [quests, questsById]);

    const leadsToByQuestId = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const quest of quests) {
            for (const req of quest.taskRequirements) {
                const arr = map.get(req.task.id) ?? [];
                arr.push(quest.id);
                map.set(req.task.id, arr);
            }
        }
        return map;
    }, [quests]);

    const traders = useMemo(() => {
        const map = new Map<string, FullQuest["trader"]>();
        for (const q of quests) {
            if (!map.has(q.trader.id)) map.set(q.trader.id, q.trader);
        }
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [quests]);

    const allMaps = useMemo(() => {
        const map = new Map<string, string>();
        for (const q of quests) {
            if (q.map) map.set(q.map.normalizedName, q.map.name);
        }
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [quests]);

    const filteredQuests = useMemo(() => {
        return quests.filter((quest) => {
            if (hideCompleted && completedQuests[quest.id]) return false;

            if (showAvailableOnly) {
                if ((quest.minPlayerLevel ?? 0) > playerLevel) return false;
                if (!quest.taskRequirements.every((req) => completedQuests[req.task.id]))
                    return false;
            }

            if (selectedTraders.size > 0 && !selectedTraders.has(quest.trader.id)) return false;

            if (faction !== null && quest.factionName && quest.factionName !== faction)
                return false;

            if (showKappa || showLightkeeper) {
                if (!((showKappa && kappaQuestIds.has(quest.id)) || (showLightkeeper && lightkeeperQuestIds.has(quest.id))))
                    return false;
            }

            if (
                selectedMaps.size > 0 &&
                (!quest.map || !selectedMaps.has(quest.map.normalizedName))
            )
                return false;

            return true;
        });
    }, [
        quests,
        hideCompleted,
        showAvailableOnly,
        selectedTraders,
        faction,
        showKappa,
        showLightkeeper,
        selectedMaps,
        completedQuests,
        playerLevel,
        kappaQuestIds,
        lightkeeperQuestIds,
    ]);

    const completedCount = quests.filter((q) => completedQuests[q.id]).length;

    const toggleTrader = (id: string) => {
        setSelectedTraders((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleMap = (normalizedName: string) => {
        setSelectedMaps((prev) => {
            const next = new Set(prev);
            if (next.has(normalizedName)) next.delete(normalizedName);
            else next.add(normalizedName);
            return next;
        });
    };

    const toggleFaction = (f: FactionFilter) => {
        setFaction((prev) => (prev === f ? null : f));
    };

    const toggleKappa = () => setShowKappa((v) => !v);
    const toggleLightkeeper = () => setShowLightkeeper((v) => !v);

    const sidebarContent = (
        <>
            {/* Player level */}
            <div className="flex flex-col gap-2">
                <SidebarLabel>Player Level</SidebarLabel>
                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-gray-500 shrink-0">Lv.</span>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        value={playerLevel}
                        onChange={(e) =>
                            setPlayerLevel(
                                Math.min(100, Math.max(1, Number(e.target.value))),
                            )
                        }
                        className="w-14 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-tarkov-green/50 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                </div>
            </div>

            {/* Prestige */}
            <div className="flex flex-col gap-2">
                <SidebarLabel>Prestige</SidebarLabel>
                <div className="flex gap-1 px-2">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                            key={n}
                            onClick={() => setPrestigeLevel(prestigeLevel === n ? 0 : n)}
                            className={`w-7 h-7 text-xs font-mono rounded transition-all flex items-center justify-center ${
                                prestigeLevel >= n
                                    ? "bg-purple-500/80 text-white font-bold shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                                    : "bg-black/40 border border-white/10 text-gray-500 hover:text-white hover:border-white/30"
                            }`}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            {/* Traders */}
            <div className="flex flex-col gap-1">
                <SidebarLabel>
                    Trader
                    {selectedTraders.size > 0 && (
                        <button
                            onClick={() => setSelectedTraders(new Set())}
                            className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            clear
                        </button>
                    )}
                </SidebarLabel>
                {traders.map((trader) => {
                    const active = selectedTraders.has(trader.id);
                    return (
                        <SidebarToggle
                            key={trader.id}
                            active={active}
                            onClick={() => toggleTrader(trader.id)}
                        >
                            {(trader.image4xLink ?? trader.imageLink) ? (
                                <img
                                    src={trader.image4xLink ?? trader.imageLink ?? ""}
                                    alt={trader.name}
                                    className="w-5 h-5 rounded-full object-cover shrink-0"
                                />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-gray-500 shrink-0">
                                    {trader.name[0]}
                                </div>
                            )}
                            {trader.name}
                        </SidebarToggle>
                    );
                })}
            </div>

            {/* Maps */}
            <div className="flex flex-col gap-1">
                <SidebarLabel>
                    Map
                    {selectedMaps.size > 0 && (
                        <button
                            onClick={() => setSelectedMaps(new Set())}
                            className="ml-auto text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            clear
                        </button>
                    )}
                </SidebarLabel>
                {allMaps.map(([normalizedName, name]) => {
                    const active = selectedMaps.has(normalizedName);
                    return (
                        <SidebarToggle
                            key={normalizedName}
                            active={active}
                            onClick={() => toggleMap(normalizedName)}
                        >
                            {name}
                        </SidebarToggle>
                    );
                })}
            </div>
        </>
    );

    return (
        <>
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
            <div
                className="fixed inset-0 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                    className="absolute left-0 top-0 bottom-0 w-64 bg-[#0d0d0d] border-r border-white/10 flex flex-col gap-6 overflow-y-auto py-6 px-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    {sidebarContent}
                </div>
            </div>
        )}

        {/* Floating sidebar toggle for small screens */}
        <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="fixed bottom-6 right-6 z-50 lg:hidden w-12 h-12 rounded-full bg-[#111] border border-tarkov-green/40 text-tarkov-green flex items-center justify-center shadow-[0_0_20px_rgba(157,255,0,0.2)] hover:shadow-[0_0_28px_rgba(157,255,0,0.35)] hover:border-tarkov-green/70 transition-all"
            title="Filters"
        >
            <SlidersIcon />
        </button>

        <div className="max-w-6xl mx-auto flex gap-0 py-8">
            {/* ---- Left sidebar ---- */}
            <aside className="hidden lg:flex flex-col gap-6 w-56 shrink-0 sticky top-4 self-start max-h-[calc(100vh-3rem)] overflow-y-auto pb-8 pl-6 pr-5">
                {sidebarContent}
            </aside>

            {/* ---- Main content ---- */}
            <div className="flex-1 min-w-0 px-6">
                {/* Page header */}
                <div className="mb-8 flex flex-col gap-1 border-b border-border-color pb-6">
                    <h1 className="text-3xl font-bold text-white tracking-tight">QUESTS</h1>
                    <p className="text-gray-400 mt-1 text-sm">
                        Track quest completion and filter by trader, map, faction, and progression
                        goal
                    </p>
                </div>

                <div className="flex flex-col gap-3 pb-8">
                    {/* Filter bar */}
                    <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md border flex-wrap">
                        {/* Faction toggles */}
                        <SegGroup>
                            <SegButton
                                active={faction === "USEC"}
                                onClick={() => toggleFaction("USEC")}
                            >
                                USEC
                            </SegButton>
                            <SegButton
                                active={faction === "BEAR"}
                                onClick={() => toggleFaction("BEAR")}
                            >
                                BEAR
                            </SegButton>
                        </SegGroup>

                        <Divider />

                        {/* Quest goal */}
                        <SegGroup>
                            <SegButton active={showKappa} onClick={toggleKappa}>
                                Kappa
                            </SegButton>
                            <SegButton active={showLightkeeper} onClick={toggleLightkeeper}>
                                LK
                            </SegButton>
                        </SegGroup>

                        <div className="flex-1" />

                        <Divider />

                        <FilterButton
                            active={hideCompleted}
                            onClick={() => setHideCompleted((v) => !v)}
                            label="Hide Completed"
                        />
                        <FilterButton
                            active={showAvailableOnly}
                            onClick={() => setShowAvailableOnly((v) => !v)}
                            label="Available Only"
                        />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 px-1 text-xs text-gray-500">
                        <span>{filteredQuests.length} quests</span>
                        <span className="text-gray-600">·</span>
                        <span>
                            {completedCount}/{quests.length} completed
                        </span>
                    </div>

                    {/* Quest list */}
                    <div className="space-y-1">
                        {filteredQuests.map((quest) => (
                            <QuestCard
                                key={quest.id}
                                quest={quest}
                                prerequisiteNames={quest.taskRequirements.map(
                                    (req) => questsById.get(req.task.id)?.name ?? req.task.name,
                                )}
                                leadsToNames={(leadsToByQuestId.get(quest.id) ?? []).map(
                                    (id) => questsById.get(id)?.name ?? id,
                                )}
                            />
                        ))}
                        {filteredQuests.length === 0 && (
                            <div className="flex items-center justify-center py-16 text-gray-600 text-sm">
                                No quests match the current filters.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}

// ---- Icons ----

function SlidersIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
            <circle cx="8" cy="6" r="2" fill="currentColor" stroke="none" />
            <circle cx="16" cy="12" r="2" fill="currentColor" stroke="none" />
            <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
    );
}

// ---- Sidebar components ----

function SidebarLabel({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center gap-1 px-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">
                {children}
            </span>
        </div>
    );
}

function SidebarToggle({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 w-full text-xs px-2 py-1.5 rounded-sm transition-all text-left border-l-2 ${
                active
                    ? "border-tarkov-green text-tarkov-green bg-tarkov-green/5"
                    : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
            }`}
        >
            {children}
        </button>
    );
}

// ---- Filter bar components ----

function Divider() {
    return <div className="h-5 w-px bg-white/10 shrink-0" />;
}

function SegGroup({ children }: { children: ReactNode }) {
    return (
        <div className="flex shrink-0 bg-black/40 rounded-sm p-1 border border-white/10">
            {children}
        </div>
    );
}

function SegButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-xs transition-all ${
                active
                    ? "bg-tarkov-green text-black shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
        >
            {children}
        </button>
    );
}

function FilterButton({
    active,
    onClick,
    label,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-sm border transition-all cursor-pointer shrink-0 ${
                active
                    ? "border-tarkov-green text-tarkov-green bg-tarkov-green/10 shadow-[0_0_10px_rgba(157,255,0,0.1)]"
                    : "border-white/10 text-gray-400 hover:border-white/30 bg-black/20 hover:bg-black/40"
            }`}
        >
            {label}
        </button>
    );
}

// ---- Helpers ----

function getTransitivePrereqs(
    rootIds: Set<string>,
    questsById: Map<string, FullQuest>,
): Set<string> {
    const result = new Set(rootIds);
    const queue = [...rootIds];
    while (queue.length > 0) {
        const id = queue.pop()!;
        const quest = questsById.get(id);
        if (!quest) continue;
        for (const req of quest.taskRequirements) {
            if (!result.has(req.task.id)) {
                result.add(req.task.id);
                queue.push(req.task.id);
            }
        }
    }
    return result;
}
