"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EditionSelection } from "./EditionSelection";
import { GameModeSelection } from "./GameModeSelection";
import { X } from "lucide-react";
import { QuickHideoutLevels } from "./QuickHideoutLevels";
import type { Station } from "@/types";
import { STATIC_STATIONS } from "@/lib/data/static-stations";

export function SetupModal() {
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
    } = useUserStore();

    const [stations] = useState<Station[]>(STATIC_STATIONS);
    const [activeView, setActiveView] = useState<"settings" | "quick-levels">("settings");

    // Automatically open only on true first visit, based on persisted state
    useEffect(() => {
        if (typeof window === "undefined") return;

        try {
            const raw = localStorage.getItem("tarkov-hideout-user-state");
            if (!raw) {
                if (!hasCompletedSetup) {
                    setSetupOpen(true);
                }
                return;
            }

            const parsed = JSON.parse(raw) as { state?: { hasCompletedSetup?: boolean } };
            const done = parsed?.state?.hasCompletedSetup ?? false;

            if (!done && !hasCompletedSetup) {
                setSetupOpen(true);
            }
        } catch {
            if (!hasCompletedSetup) {
                setSetupOpen(true);
            }
        }
    }, [hasCompletedSetup, setSetupOpen]);

    // Apply bonuses whenever edition changes
    useEffect(() => {
        if (gameEdition && stations) {
            applyEditionBonuses(stations);
        }
    }, [gameEdition, stations, applyEditionBonuses]);

    if (!isSetupOpen) return null;

    const handleFinish = () => {
        completeSetup();
    };

    const canFinish = gameEdition !== null;

    return (
        <Dialog open={isSetupOpen} onOpenChange={setSetupOpen}>
            <DialogContent
                showCloseButton={false}
                className="w-full md:max-w-3xl p-0 gap-0 overflow-hidden rounded-md bg-card border border-border-color"
            >
                <div className="px-6 py-4 flex items-center justify-between border-b border-border-color bg-black/60">
                    <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-gray-400">
                        INITIAL SETUP
                    </DialogTitle>
                    <button
                        onClick={() => completeSetup()}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 pt-4 pb-3 border-b border-border-color bg-black/40">
                    <div className="text-xs text-gray-500">
                        Configure your game settings and hideout levels so item requirements and
                        prices match your account.
                    </div>
                </div>

                <div className="p-6 max-h-[65vh] overflow-y-auto bg-black/40">
                    {activeView === "settings" ? (
                        <div className="space-y-8">
                            <EditionSelection selected={gameEdition} onSelect={setGameEdition} />
                            <GameModeSelection selected={gameMode} onSelect={setGameMode} />
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
                                Save & Close
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
                                Set Hideout Levels &rarr;
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
