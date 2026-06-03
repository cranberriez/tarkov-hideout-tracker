"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { QuestFlagFilters } from "@/components/core/QuestFlagFilters";
import { useUserStore, type GameMode } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";

const PRESTIGE_LEVELS = [1, 2, 3, 4, 5, 6];
const GAME_MODES: GameMode[] = ["PVP", "PVE"];
type Faction = "USEC" | "BEAR" | null;

export function PlayerProfileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const {
        playerLevel,
        setPlayerLevel,
        prestigeLevel,
        setPrestigeLevel,
        faction,
        setQuestFaction,
        gameMode,
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
            setGameMode: state.setGameMode,
            showKappa: state.questShowKappa,
            setQuestShowKappa: state.setQuestShowKappa,
            showLightkeeper: state.questShowLightkeeper,
            setQuestShowLightkeeper: state.setQuestShowLightkeeper,
        })),
    );

    useEffect(() => {
        if (!isOpen) return;

        function onPointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [isOpen]);

    const compactModeClasses =
        gameMode === "PVE"
            ? "before:bg-[radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.24)_0%,transparent_32%)]"
            : "before:bg-[radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.24)_0%,transparent_32%)]";
    const panelModeClasses =
        gameMode === "PVE"
            ? "before:bg-[radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.24)_0%,transparent_22%)]"
            : "before:bg-[radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.24)_0%,transparent_22%)]";

    function closePinnedPanel(activeElement?: HTMLElement) {
        setIsOpen(false);
        activeElement?.blur();
    }

    return (
        <div ref={rootRef} className="group relative">
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={cn(
                    "relative flex h-10 items-center gap-2 overflow-hidden rounded border border-white/10 bg-black/35 px-2.5 text-gray-300 transition-colors hover:border-white/25 hover:text-white",
                    "before:pointer-events-none before:absolute before:inset-0",
                    compactModeClasses,
                    isOpen && "border-tarkov-green/50 text-white",
                )}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label="Player profile"
            >
                <FactionShield faction={faction} size={16} className="relative z-10 shrink-0" />
                <span className="relative z-10 font-mono text-sm font-semibold leading-none">
                    {playerLevel}
                </span>
                {prestigeLevel > 0 && (
                    <span className="relative z-10 rounded-sm bg-purple-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-purple-300">
                        {prestigeLevel}
                    </span>
                )}
            </button>

            <div
                className={cn(
                    "absolute right-0 top-0 z-50 origin-top-right overflow-hidden rounded-md border border-white/10 bg-[#0d0d0d] text-sm shadow-2xl shadow-black/50 transition-all duration-150 before:pointer-events-none before:absolute before:inset-0",
                    isOpen ? "w-[min(20rem,calc(100vw-2rem))] p-3" : "w-[min(16.5rem,calc(100vw-2rem))] p-2.5",
                    panelModeClasses,
                    isOpen
                        ? "pointer-events-auto scale-100 opacity-100"
                        : "pointer-events-none scale-95 opacity-0 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100",
                )}
                role={isOpen ? "dialog" : "tooltip"}
                aria-label="Player profile summary"
            >
                <div className={cn("relative z-10 flex items-start justify-between gap-3", isOpen ? "mb-3" : "mb-2")}>
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <FactionShield faction={faction} size={16} />
                            Character
                        </div>
                        <div className={cn("mt-1 font-semibold text-white", isOpen ? "text-base" : "text-sm")}>
                            Level {playerLevel}
                            {prestigeLevel > 0 && (
                                <span className="ml-2 text-purple-300">P{prestigeLevel}</span>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={(event) => {
                            if (isOpen) closePinnedPanel(event.currentTarget);
                            else setIsOpen(true);
                        }}
                        className={cn(
                            "rounded-sm font-bold uppercase tracking-wide text-gray-500 transition-colors hover:bg-white/5 hover:text-white",
                            isOpen ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]",
                        )}
                    >
                        {isOpen ? "Close" : "Edit"}
                    </button>
                </div>

                {!isOpen ? (
                    <ProfileSummary
                        faction={faction}
                        gameMode={gameMode}
                        showKappa={showKappa}
                        showLightkeeper={showLightkeeper}
                    />
                ) : (
                    <div className="relative z-10 space-y-4">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                            <label
                                htmlFor="player-profile-level"
                                className="text-xs font-medium text-gray-400"
                            >
                                Character Level
                            </label>
                            <input
                                id="player-profile-level"
                                type="number"
                                min={1}
                                max={100}
                                value={playerLevel}
                                onChange={(event) =>
                                    setPlayerLevel(
                                        Math.min(100, Math.max(1, Number(event.target.value) || 1)),
                                    )
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
                                        onClick={() =>
                                            setPrestigeLevel(prestigeLevel === level ? 0 : level)
                                        }
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
                                    onClick={() => setQuestFaction(faction === "USEC" ? null : "USEC")}
                                >
                                    USEC
                                </SegmentButton>
                                <SegmentButton
                                    active={faction === "BEAR"}
                                    onClick={() => setQuestFaction(faction === "BEAR" ? null : "BEAR")}
                                >
                                    BEAR
                                </SegmentButton>
                            </div>
                        </ControlGroup>

                        <ControlGroup label="Game Mode">
                            <div className="grid grid-cols-2 gap-2">
                                {GAME_MODES.map((mode) => (
                                    <SegmentButton
                                        key={mode}
                                        active={gameMode === mode}
                                        onClick={() => setGameMode(mode)}
                                    >
                                        {mode}
                                    </SegmentButton>
                                ))}
                            </div>
                        </ControlGroup>

                        <ControlGroup label="Quest Goals">
                            <QuestFlagFilters
                                showKappa={showKappa}
                                showLightkeeper={showLightkeeper}
                                onToggleKappa={() => setQuestShowKappa(!showKappa)}
                                onToggleLightkeeper={() => setQuestShowLightkeeper(!showLightkeeper)}
                                expand
                            />
                        </ControlGroup>
                    </div>
                )}
            </div>
        </div>
    );
}

function ProfileSummary({
    faction,
    gameMode,
    showKappa,
    showLightkeeper,
}: {
    faction: "USEC" | "BEAR" | null;
    gameMode: GameMode;
    showKappa: boolean;
    showLightkeeper: boolean;
}) {
    const goals = [
        showKappa ? "Kappa" : null,
        showLightkeeper ? "Lightkeeper" : null,
    ].filter(Boolean);

    return (
        <div className="grid gap-1.5 text-[11px]">
            <SummaryRow label="Faction" value={faction ?? "Any"} />
            <SummaryRow label="Mode" value={gameMode} />
            <SummaryRow label="Goals" value={goals.length > 0 ? goals.join(" + ") : "None"} />
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

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-sm bg-white/[0.03] px-2 py-1">
            <span className="text-gray-500">{label}</span>
            <span className="inline-flex items-center gap-1 font-medium text-gray-200">
                <Check size={12} className="text-tarkov-green" />
                {value}
            </span>
        </div>
    );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
                {label}
            </div>
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
