"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { GameMode } from "@/lib/game-mode";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EditionSelection } from "./EditionSelection";
import { GameModeSelection } from "./GameModeSelection";
import { X } from "lucide-react";
import { QuickHideoutLevels } from "./QuickHideoutLevels";
import { STATIC_STATIONS, type SetupStation } from "@/lib/data/static-stations";

export function SetupModal() {
    const router = useRouter();
    const {
        gameEdition,
        gameMode,
        setGameEdition,
        setGameMode,
        applyEditionBonuses,
        completeSetup,
        isSetupOpen,
        setSetupOpen,
        hasCompletedSetup,
        stationLevels,
        setStationLevel,
        deprecatedLegacyState,
        hasConvertedDeprecatedLegacyState,
        hasDismissedDeprecatedLegacyState,
    } = useUserStore();
    const hasPendingLegacyConversion =
        deprecatedLegacyState !== null &&
        !hasConvertedDeprecatedLegacyState &&
        !hasDismissedDeprecatedLegacyState;

    const [stations] = useState<SetupStation[]>(STATIC_STATIONS);
    const [activeView, setActiveView] = useState<"settings" | "quick-levels">("settings");

    // Apply bonuses whenever edition changes
    useEffect(() => {
        if (gameEdition && stations) {
            applyEditionBonuses(stations);
        }
    }, [gameEdition, stations, applyEditionBonuses]);

    if (!isSetupOpen || hasPendingLegacyConversion) return null;

    const handleFinish = () => {
        completeSetup();
        window.location.reload();
    };

    const handleGameModeSelect = (mode: GameMode) => {
        if (mode === gameMode) return;
        setGameMode(mode);
        router.refresh();
    };

    const canFinish = gameEdition !== null;

    return (
        <Dialog open={isSetupOpen} onOpenChange={setSetupOpen}>
            <DialogContent
                showCloseButton={false}
                className="w-full md:max-w-3xl p-0 gap-0 overflow-hidden rounded-md bg-card border border-border-color"
            >
                <div className="px-6 py-4 flex items-center justify-between border-b border-border-color bg-black/60">
                    <div>
                        <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-gray-300">
                            {hasCompletedSetup ? "EDIT SETUP" : "SET UP YOUR PROFILE"}
                        </DialogTitle>
                        <p className="mt-1 text-xs text-gray-500">
                            {activeView === "settings"
                                ? "Choose the profile that matches your Tarkov character."
                                : "Set each station to its current in-game level."}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSetupOpen(false)}
                        className="rounded-sm p-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                        aria-label="Close setup"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 max-h-[65vh] overflow-y-auto bg-black/40">
                    {activeView === "settings" ? (
                        <div className="space-y-8">
                            <GameModeSelection selected={gameMode} onSelect={handleGameModeSelect} />
                            <EditionSelection selected={gameEdition} onSelect={setGameEdition} />
                        </div>
                    ) : (
                        <QuickHideoutLevels
                            stations={stations}
                            stationLevels={stationLevels}
                            setStationLevel={setStationLevel}
                        />
                    )}
                </div>

                <div className="px-6 py-4 border-t border-border-color bg-black/70 flex items-center justify-end gap-3">
                    {activeView === "settings" ? (
                        <>
                            <button
                                onClick={handleFinish}
                                disabled={!canFinish}
                                className="px-4 py-2 rounded-sm font-medium text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Setup
                            </button>
                            <button
                                onClick={() => setActiveView("quick-levels")}
                                disabled={!canFinish}
                                className={`px-5 py-2 rounded-sm font-semibold text-sm tracking-wide transition-all ${
                                    canFinish
                                        ? "bg-tarkov-green text-black hover:bg-lime-300 shadow-[0_0_18px_rgba(157,255,0,0.25)]"
                                        : "bg-black/40 text-gray-600 border border-white/10 cursor-not-allowed"
                                }`}
                            >
                                Hideout Levels &rarr;
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setActiveView("settings")}
                                className="px-4 py-2 rounded-sm font-medium text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                &larr; Back
                            </button>
                            <button
                                onClick={handleFinish}
                                className="px-5 py-2 rounded-sm font-semibold text-sm tracking-wide bg-tarkov-green text-black hover:bg-tarkov-green-dim shadow-[0_0_18px_rgba(157,255,0,0.25)] transition-all"
                            >
                                {hasCompletedSetup ? "Save Changes" : "Complete Setup"}
                            </button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
