"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { QuestFlagFilters } from "@/components/core/QuestFlagFilters";
import {
    useUserStore,
    type GameMode,
    type PlayerProfileState,
} from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import {
    countCompletedHideoutUpgrades,
    countCompletedQuests,
} from "@/lib/utils/profile-summary";

const PRESTIGE_LEVELS = [1, 2, 3, 4, 5, 6];
const PROFILE_ORDER: GameMode[] = ["PVE", "PVP", "KORD"];
type Faction = "USEC" | "BEAR" | null;
type OpenPanel = "character" | "profiles";

const PROFILE_COLORS: Record<
    GameMode,
    { trigger: string; rowGradient: string; activeRow: string }
> = {
    PVE: {
        trigger: "before:bg-[radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.24)_0%,transparent_60%)]",
        rowGradient: "before:bg-[radial-gradient(circle_at_right,rgba(96,165,250,0.18)_0%,transparent_72%)] hover:border-blue-400/30",
        activeRow: "border-blue-400/40 before:opacity-50",
    },
    PVP: {
        trigger: "before:bg-[radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.24)_0%,transparent_60%)]",
        rowGradient: "before:bg-[radial-gradient(circle_at_right,rgba(239,68,68,0.18)_0%,transparent_72%)] hover:border-red-400/30",
        activeRow: "border-red-400/40 before:opacity-50",
    },
    KORD: {
        trigger: "before:bg-[radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.24)_0%,transparent_60%)]",
        rowGradient: "before:bg-[radial-gradient(circle_at_right,rgba(251,191,36,0.18)_0%,transparent_72%)] hover:border-amber-400/30",
        activeRow: "border-amber-400/40 before:opacity-50",
    },
};

export function PlayerProfileMenu() {
    const [hoveredPanel, setHoveredPanel] = useState<OpenPanel | null>(null);
    const [pinnedPanel, setPinnedPanel] = useState<OpenPanel | null>(null);
    const [isSwitching, startSwitch] = useTransition();
    const router = useRouter();
    const rootRef = useRef<HTMLDivElement>(null);
    const activePanel = pinnedPanel ?? hoveredPanel;

    const {
        playerLevel,
        setPlayerLevel,
        prestigeLevel,
        setPrestigeLevel,
        faction,
        setQuestFaction,
        gameMode,
        profiles,
        setGameMode,
        showKappa,
        setQuestShowKappa,
        showLightkeeper,
        setQuestShowLightkeeper,
    } = useUserStore(
        useShallow((state) => ({
            playerLevel: state.playerLevel,
            setPlayerLevel: state.setPlayerLevel,
            prestigeLevel: state.prestigeLevel,
            setPrestigeLevel: state.setPrestigeLevel,
            faction: state.questFaction,
            setQuestFaction: state.setQuestFaction,
            gameMode: state.gameMode,
            profiles: state.profiles,
            setGameMode: state.setGameMode,
            showKappa: state.questShowKappa,
            setQuestShowKappa: state.setQuestShowKappa,
            showLightkeeper: state.questShowLightkeeper,
            setQuestShowLightkeeper: state.setQuestShowLightkeeper,
        })),
    );

    useEffect(() => {
        if (!activePanel) return;

        function onPointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setPinnedPanel(null);
                setHoveredPanel(null);
            }
        }

        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [activePanel]);

    function switchProfile(mode: GameMode) {
        if (mode === gameMode || isSwitching) return;
        setGameMode(mode);
        startSwitch(() => router.refresh());
    }

    function pinPanel(panel: OpenPanel) {
        setHoveredPanel(panel);
        setPinnedPanel(panel);
    }

    function closePinnedPanel(activeElement?: HTMLElement) {
        setPinnedPanel(null);
        setHoveredPanel(null);
        activeElement?.blur();
    }

    const colors = PROFILE_COLORS[gameMode];

    return (
        <div
            ref={rootRef}
            className="relative"
            onPointerLeave={() => {
                if (!pinnedPanel) setHoveredPanel(null);
            }}
            onBlur={(event) => {
                if (!pinnedPanel && !event.currentTarget.contains(event.relatedTarget)) {
                    setHoveredPanel(null);
                }
            }}
        >
            <div
                className={cn(
                    "relative flex h-10 overflow-hidden rounded border border-white/10 bg-black/35 text-gray-300 transition-colors before:pointer-events-none before:absolute before:inset-0",
                    colors.trigger,
                    activePanel && "border-tarkov-green/50 text-white",
                )}
                role="group"
                aria-label="Character and profile"
            >
                <button
                    type="button"
                    onPointerEnter={() => {
                        if (!pinnedPanel) setHoveredPanel("character");
                    }}
                    onFocus={() => {
                        if (!pinnedPanel) setHoveredPanel("character");
                    }}
                    onClick={() => pinPanel("character")}
                    className={cn(
                        "relative z-10 flex items-center gap-2 px-2.5 transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none",
                        activePanel === "character" && "bg-white/[0.05]",
                    )}
                    aria-haspopup="dialog"
                    aria-expanded={activePanel === "character"}
                    aria-controls="character-customizer-panel"
                    aria-label={`Character, level ${playerLevel}`}
                >
                    <FactionShield faction={faction} size={16} className="shrink-0" />
                    <span className="font-mono text-sm font-semibold leading-none">{playerLevel}</span>
                    {prestigeLevel > 0 && (
                        <span className="rounded-sm bg-purple-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-purple-300">
                            {prestigeLevel}
                        </span>
                    )}
                </button>

                <div className="relative z-10 my-1.5 w-px bg-white/15" aria-hidden="true" />

                <button
                    type="button"
                    onPointerEnter={() => {
                        if (!pinnedPanel) setHoveredPanel("profiles");
                    }}
                    onFocus={() => {
                        if (!pinnedPanel) setHoveredPanel("profiles");
                    }}
                    onClick={() => pinPanel("profiles")}
                    className={cn(
                        "relative z-10 flex min-w-14 items-center justify-center px-2.5 transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none",
                        activePanel === "profiles" && "bg-white/[0.05]",
                    )}
                    aria-haspopup="dialog"
                    aria-expanded={activePanel === "profiles"}
                    aria-controls="profile-selection-panel"
                    aria-label={`Profile, ${gameMode}`}
                >
                    <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-gray-200">
                        {gameMode}
                    </span>
                </button>
            </div>

            {activePanel && (
                <div
                    id={
                        activePanel === "character"
                            ? "character-customizer-panel"
                            : "profile-selection-panel"
                    }
                    className="fixed left-4 right-4 top-[3.25rem] z-50 w-auto overflow-hidden rounded-md border border-white/10 bg-[#0d0d0d] p-3 text-sm shadow-2xl shadow-black/50 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-[min(20rem,calc(100vw-2rem))]"
                    role="dialog"
                    aria-modal="false"
                    aria-label={activePanel === "character" ? "Character customizer" : "Profiles"}
                >
                    <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                {activePanel === "character" ? (
                                    <>
                                        <FactionShield faction={faction} size={16} />
                                        Character
                                    </>
                                ) : (
                                    "Profiles"
                                )}
                            </div>
                            <div className="mt-1 text-base font-semibold text-white">
                                {activePanel === "character"
                                    ? `Level ${playerLevel}${prestigeLevel > 0 ? ` · Prestige ${prestigeLevel}` : ""}`
                                    : "Select a character profile"}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={(event) => closePinnedPanel(event.currentTarget)}
                            className="rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            Close
                        </button>
                    </div>

                    {activePanel === "character" ? (
                        <CharacterCustomizer
                            playerLevel={playerLevel}
                            setPlayerLevel={setPlayerLevel}
                            prestigeLevel={prestigeLevel}
                            setPrestigeLevel={setPrestigeLevel}
                            faction={faction}
                            setFaction={setQuestFaction}
                            showKappa={showKappa}
                            setShowKappa={setQuestShowKappa}
                            showLightkeeper={showLightkeeper}
                            setShowLightkeeper={setQuestShowLightkeeper}
                        />
                    ) : (
                        <ProfileList
                            activeMode={gameMode}
                            profiles={profiles}
                            isSwitching={isSwitching}
                            onSelect={switchProfile}
                        />
                    )}
                </div>
            )}

            {isSwitching && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm">
                    <div className="flex items-center gap-3 rounded-md border border-white/10 bg-[#111] px-5 py-4 text-sm font-medium text-white shadow-2xl">
                        <LoaderCircle className="animate-spin text-tarkov-green" size={18} />
                        Loading {gameMode} character…
                    </div>
                </div>
            )}
        </div>
    );
}

function CharacterCustomizer({
    playerLevel,
    setPlayerLevel,
    prestigeLevel,
    setPrestigeLevel,
    faction,
    setFaction,
    showKappa,
    setShowKappa,
    showLightkeeper,
    setShowLightkeeper,
}: {
    playerLevel: number;
    setPlayerLevel: (level: number) => void;
    prestigeLevel: number;
    setPrestigeLevel: (level: number) => void;
    faction: Faction;
    setFaction: (faction: Faction) => void;
    showKappa: boolean;
    setShowKappa: (show: boolean) => void;
    showLightkeeper: boolean;
    setShowLightkeeper: (show: boolean) => void;
}) {
    return (
        <div className="relative z-10 space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <label htmlFor="player-profile-level" className="text-xs font-medium text-gray-400">
                    Character Level
                </label>
                <input
                    id="player-profile-level"
                    type="number"
                    min={1}
                    max={100}
                    value={playerLevel}
                    onChange={(event) =>
                        setPlayerLevel(Math.min(100, Math.max(1, Number(event.target.value) || 1)))
                    }
                    className="h-8 w-16 rounded border border-white/10 bg-black/40 px-2 text-right font-mono text-xs text-white outline-none transition-colors focus:border-tarkov-green/50"
                />
            </div>

            <ControlGroup label="Prestige">
                <div className="grid grid-cols-6 gap-1">
                    {PRESTIGE_LEVELS.map((level) => (
                        <button
                            key={level}
                            type="button"
                            onClick={() => setPrestigeLevel(prestigeLevel === level ? 0 : level)}
                            className={cn(
                                "flex h-8 items-center justify-center rounded-sm border text-xs font-bold transition-all",
                                prestigeLevel >= level
                                    ? "border-purple-400/40 bg-purple-500/80 text-white shadow-[0_0_8px_rgba(168,85,247,0.35)]"
                                    : "border-white/10 bg-black/30 text-gray-500 hover:border-white/25 hover:text-white",
                            )}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </ControlGroup>

            <ControlGroup label="Faction">
                <div className="grid grid-cols-2 gap-2">
                    <SegmentButton
                        active={faction === "USEC"}
                        onClick={() => setFaction(faction === "USEC" ? null : "USEC")}
                    >
                        USEC
                    </SegmentButton>
                    <SegmentButton
                        active={faction === "BEAR"}
                        onClick={() => setFaction(faction === "BEAR" ? null : "BEAR")}
                    >
                        BEAR
                    </SegmentButton>
                </div>
            </ControlGroup>

            <ControlGroup label="Quest Goals">
                <QuestFlagFilters
                    showKappa={showKappa}
                    showLightkeeper={showLightkeeper}
                    onToggleKappa={() => setShowKappa(!showKappa)}
                    onToggleLightkeeper={() => setShowLightkeeper(!showLightkeeper)}
                    expand
                />
            </ControlGroup>
        </div>
    );
}

function ProfileList({
    activeMode,
    profiles,
    isSwitching,
    onSelect,
}: {
    activeMode: GameMode;
    profiles: Record<GameMode, PlayerProfileState>;
    isSwitching: boolean;
    onSelect: (mode: GameMode) => void;
}) {
    return (
        <div className="relative z-10 grid gap-2">
            {PROFILE_ORDER.map((mode) => {
                const profile = profiles[mode];
                const colors = PROFILE_COLORS[mode];
                const active = mode === activeMode;
                const faction = profile.questFaction ?? "No faction";
                const completedQuests = countCompletedQuests(profile);
                const completedUpgrades = countCompletedHideoutUpgrades(profile);

                return (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => onSelect(mode)}
                        disabled={isSwitching}
                        className={cn(
                            "relative flex w-full items-center gap-3 overflow-hidden rounded border border-white/10 bg-black/25 p-3 text-left transition-colors before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 disabled:cursor-wait disabled:opacity-60",
                            colors.rowGradient,
                            active && colors.activeRow,
                        )}
                    >
                        <span className="relative z-10 inline-flex w-12 shrink-0 items-center justify-center px-2 py-1 text-[11px] font-bold tracking-wide text-gray-200">
                            {mode}
                        </span>
                        <span className="relative z-10 min-w-0 flex-1">
                            <span className="flex items-center gap-2 font-semibold text-gray-100">
                                {faction} · Level {profile.playerLevel}
                                {active && <Check size={14} className="shrink-0 text-tarkov-green" />}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-gray-500">
                                {profile.prestigeLevel > 0
                                    ? `Prestige ${profile.prestigeLevel} · `
                                    : ""}
                                {completedQuests} quests · {completedUpgrades} hideout upgrades
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function FactionShield({
    faction,
    size,
    className,
}: {
    faction: Faction;
    size: number;
    className?: string;
}) {
    const gradientId = useId().replace(/:/g, "");
    const coordinates = { x1: "50%", y1: "0%", x2: "50%", y2: "100%" };
    const bearStops = [
        ["0%", "#f8fafc"],
        ["50%", "#3b82f6"],
        ["100%", "#ef4444"],
    ];

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            {faction && (
                <defs>
                    {faction === "USEC" ? (
                        <radialGradient id={gradientId} cx="30%" cy="28%" r="85%">
                            <stop offset="0%" stopColor="#1e3a8a" />
                            <stop offset="24%" stopColor="#1e3a8a" />
                            <stop offset="35%" stopColor="#f8fafc" />
                            <stop offset="48%" stopColor="#b91c1c" />
                            <stop offset="62%" stopColor="#f8fafc" />
                            <stop offset="78%" stopColor="#b91c1c" />
                            <stop offset="100%" stopColor="#7f1d1d" />
                        </radialGradient>
                    ) : (
                        <linearGradient id={gradientId} {...coordinates}>
                            {bearStops.map(([offset, color]) => (
                                <stop key={offset} offset={offset} stopColor={color} />
                            ))}
                        </linearGradient>
                    )}
                </defs>
            )}
            <path
                d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
                fill={faction ? `url(#${gradientId})` : "currentColor"}
                className={faction ? undefined : "text-gray-500"}
            />
        </svg>
    );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</div>
            {children}
        </section>
    );
}

function SegmentButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex h-8 items-center justify-center rounded-sm border px-3 text-xs font-semibold transition-colors",
                active
                    ? "border-tarkov-green/50 bg-tarkov-green text-black"
                    : "border-white/10 bg-black/30 text-gray-400 hover:border-white/25 hover:text-white",
            )}
        >
            {children}
        </button>
    );
}
