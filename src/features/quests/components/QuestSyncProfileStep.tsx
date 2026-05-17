"use client";

import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";

const PRESTIGE_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;

export function QuestSyncProfileStep({
    onContinue,
}: {
    onContinue: () => void;
}) {
    const {
        playerLevel,
        prestigeLevel,
        questFaction,
        setPlayerLevel,
        setPrestigeLevel,
        setQuestFaction,
    } = useUserStore(
        useShallow((state) => ({
            playerLevel: state.playerLevel,
            prestigeLevel: state.prestigeLevel,
            questFaction: state.questFaction,
            setPlayerLevel: state.setPlayerLevel,
            setPrestigeLevel: state.setPrestigeLevel,
            setQuestFaction: state.setQuestFaction,
        })),
    );
    const canContinue = questFaction !== null;

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-300">
                    Step 1 · Confirm Profile
                </h3>
            </div>

            <div className="grid gap-4 md:grid-cols-[120px_1fr] md:items-center">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Player Level
                </label>
                <input
                    type="number"
                    min={1}
                    max={100}
                    value={playerLevel}
                    onChange={(event) =>
                        setPlayerLevel(Math.min(100, Math.max(1, Number(event.target.value) || 1)))
                    }
                    className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-tarkov-green/50"
                />
            </div>

            <div className="grid gap-4 md:grid-cols-[120px_1fr] md:items-center">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Prestige
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {PRESTIGE_OPTIONS.map((value) => (
                        <button
                            key={value}
                            onClick={() => setPrestigeLevel(value)}
                            className={`rounded-sm px-3 py-2 text-sm transition-colors ${
                                prestigeLevel === value
                                    ? "bg-tarkov-green text-black"
                                    : "border border-white/10 bg-black/30 text-gray-400 hover:border-white/20 hover:text-white"
                            }`}
                        >
                            {value}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[120px_1fr] md:items-center">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Faction
                </label>
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setQuestFaction("USEC")}
                        className={`rounded-sm px-3 py-2 text-sm transition-colors ${
                            questFaction === "USEC"
                                ? "bg-tarkov-green text-black"
                                : "border border-white/10 bg-black/30 text-gray-400 hover:border-white/20 hover:text-white"
                        }`}
                    >
                        USEC
                    </button>
                    <button
                        onClick={() => setQuestFaction("BEAR")}
                        className={`rounded-sm px-3 py-2 text-sm transition-colors ${
                            questFaction === "BEAR"
                                ? "bg-tarkov-green text-black"
                                : "border border-white/10 bg-black/30 text-gray-400 hover:border-white/20 hover:text-white"
                        }`}
                    >
                        BEAR
                    </button>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={onContinue}
                    disabled={!canContinue}
                    className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                        canContinue
                            ? "bg-tarkov-green text-black hover:bg-tarkov-green-dim"
                            : "cursor-not-allowed border border-white/10 bg-black/30 text-gray-600"
                    }`}
                >
                    Continue to Trader Sync
                </button>
            </div>
        </div>
    );
}
