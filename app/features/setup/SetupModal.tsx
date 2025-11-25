"use client";

import { useEffect } from "react";
import { useUserStore } from "@/app/lib/stores/useUserStore";
import { useDataStore } from "@/app/lib/stores/useDataStore";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EditionSelection } from "./EditionSelection";
import { GameModeSelection } from "./GameModeSelection";
import { X } from "lucide-react";

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
    } = useUserStore();

    const { stations, fetchStations } = useDataStore();

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

    // Fetch stations if missing
    useEffect(() => {
        if (isSetupOpen && !stations) {
            fetchStations();
        }
    }, [isSetupOpen, stations, fetchStations]);

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
                className="w-full md:max-w-2xl p-0 gap-0 overflow-hidden"
            >
                <div className="p-6 flex items-center justify-between border-b border-border-color">
                    <DialogTitle className="text-2xl font-bold text-white tracking-wider">
                        INITIAL SETUP
                    </DialogTitle>
                    <button
                        onClick={() => completeSetup()}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-8 max-h-[60vh] overflow-y-auto">
                    <EditionSelection selected={gameEdition} onSelect={setGameEdition} />
                    <GameModeSelection selected={gameMode} onSelect={setGameMode} />
                </div>

                <div className="p-6 border-t border-border-color bg-black/20">
                    <button
                        onClick={handleFinish}
                        disabled={!canFinish}
                        className={`
                            w-full py-3 rounded-lg font-bold text-lg transition-all duration-200
                            ${
                                canFinish
                                    ? "bg-white text-black hover:bg-gray-200 shadow-lg"
                                    : "bg-gray-800 text-gray-500 cursor-not-allowed"
                            }
                        `}
                    >
                        {hasCompletedSetup ? "Save Changes" : "Complete Setup"}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
