"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArchiveRestore, Check, ShieldCheck } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDataContext } from "@/app/(data)/_dataContext";
import { GAME_MODES, type GameMode, type PlayerProfileState, useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";
import type { Station } from "@/types";

type DialogStep = "select" | "replace";

interface ProfileStats {
    playerLevel: number;
    prestigeLevel: number;
    faction: string;
    edition: string;
    completedQuests: number;
    totalItems: number;
    maxedStations: Station[];
    loyaltySummary: Array<{ level: number; count: number }>;
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function countEnabled(value: unknown) {
    return Object.values(asRecord(value)).filter(Boolean).length;
}

function getNumber(value: unknown, fallback = 0) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildStats(source: Record<string, unknown>, stations: Station[]): ProfileStats {
    const totalItems = Object.values(asRecord(source.itemCounts)).reduce<number>(
        (total, value) => {
            const counts = asRecord(value);
            return total + getNumber(counts.have) + getNumber(counts.haveFir);
        },
        0,
    );
    const stationLevels = asRecord(source.stationLevels);
    const maxedStations = stations.filter((station) => {
        const maxLevel = Math.max(0, ...station.levels.map((level) => level.level));
        return getNumber(stationLevels[station.id]) >= maxLevel && maxLevel > 0;
    });
    const loyaltyLevels = Object.values(asRecord(source.questTraderLoyaltyLevels)).map(
        (value) => getNumber(value, 1),
    );

    return {
        playerLevel: getNumber(source.playerLevel, 1),
        prestigeLevel: getNumber(source.prestigeLevel),
        faction: source.questFaction === "BEAR" ? "BEAR" : "USEC",
        edition: typeof source.gameEdition === "string" ? source.gameEdition : "Not set",
        completedQuests: countEnabled(source.completedQuests),
        totalItems,
        maxedStations,
        loyaltySummary: [1, 2, 3, 4]
            .map((level) => ({ level, count: loyaltyLevels.filter((value) => value === level).length }))
            .filter(({ count }) => count > 0),
    };
}

function hasProfileData(profile: PlayerProfileState) {
    const hasStationProgress = Object.values(profile.stationLevels).some((level) => level > 0);
    const hasItems = Object.values(profile.itemCounts).some(({ have, haveFir }) => have > 0 || haveFir > 0);
    const hasQuestProgress = [
        profile.completedQuests,
        profile.failedQuests,
        profile.questsWithItems,
        profile.pinnedQuests,
    ].some((record) => Object.values(record).some(Boolean));

    return profile.hasCompletedSetup || profile.gameEdition !== null || profile.playerLevel > 1 ||
        profile.prestigeLevel > 0 || profile.questFenceReputation !== 0 ||
        Object.values(profile.questTraderLoyaltyLevels).some((level) => level > 1) ||
        hasStationProgress || hasItems || hasQuestProgress || profile.questChangeHistory.length > 0 ||
        profile.questShowKappa || profile.questShowLightkeeper;
}

function StatsPanel({ stats }: { stats: ProfileStats }) {
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
                {[
                    ["Character level", stats.playerLevel],
                    ["Faction", stats.faction],
                    ["Prestige", stats.prestigeLevel],
                    ["Edition", stats.edition],
                    ["Completed quests", stats.completedQuests],
                    ["Items held", stats.totalItems.toLocaleString()],
                ].map(([label, value]) => (
                    <div key={label} className="border border-white/8 bg-white/[0.03] p-3">
                        <div className="text-[10px] uppercase tracking-wide text-gray-600">{label}</div>
                        <div className="mt-1 text-sm font-medium text-gray-200">{value}</div>
                    </div>
                ))}
            </div>
            <div>
                <div className="text-xs text-gray-500">Trader loyalty levels</div>
                <div className="mt-2 flex flex-wrap gap-2">
                    {stats.loyaltySummary.length > 0 ? stats.loyaltySummary.map(({ level, count }) => (
                        <span key={level} className="border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-gray-300">
                            LL{level} · {count} {count === 1 ? "trader" : "traders"}
                        </span>
                    )) : <span className="text-xs text-gray-600">No saved trader levels</span>}
                </div>
            </div>
            <div>
                <div className="text-xs text-gray-500">Max-level hideout stations · {stats.maxedStations.length}</div>
                <div className="mt-2 text-xs leading-5 text-gray-400">
                    {stats.maxedStations.length > 0
                        ? stats.maxedStations.map((station) => station.name).join(", ")
                        : "No stations were at their maximum level."}
                </div>
            </div>
        </div>
    );
}

export function LegacyProfileConversionDialog() {
    const { stations } = useDataContext();
    const store = useUserStore(useShallow((state) => ({
        deprecatedLegacyState: state.deprecatedLegacyState,
        hasConverted: state.hasConvertedDeprecatedLegacyState,
        hasDismissed: state.hasDismissedDeprecatedLegacyState,
        profiles: state.profiles,
        gameMode: state.gameMode,
        convert: state.convertDeprecatedLegacyState,
        dismiss: state.dismissDeprecatedLegacyState,
    })));
    const { isOpenFromSettings, setOpenFromSettings } = useUIStore(useShallow((state) => ({
        isOpenFromSettings: state.isLegacyProfileConversionOpen,
        setOpenFromSettings: state.setLegacyProfileConversionOpen,
    })));
    const [selectedModeOverride, setSelectedModeOverride] = useState<GameMode | null>(null);
    const [step, setStep] = useState<DialogStep>("select");
    const shouldOpenAutomatically = store.deprecatedLegacyState !== null && !store.hasConverted && !store.hasDismissed;
    const isOpen = store.deprecatedLegacyState !== null && (shouldOpenAutomatically || isOpenFromSettings);
    const selectedMode = selectedModeOverride ?? store.gameMode;
    const destinationHasData = hasProfileData(store.profiles[selectedMode]);
    const availableStations = useMemo(() => stations ?? [], [stations]);
    const oldStats = useMemo(
        () => store.deprecatedLegacyState ? buildStats(store.deprecatedLegacyState, availableStations) : null,
        [availableStations, store.deprecatedLegacyState],
    );
    const currentStats = useMemo(
        () => buildStats(store.profiles[selectedMode] as unknown as Record<string, unknown>, availableStations),
        [availableStations, selectedMode, store.profiles],
    );

    if (!store.deprecatedLegacyState || !oldStats) return null;

    const handleCancel = () => {
        if (!store.hasConverted) store.dismiss();
        setOpenFromSettings(false);
        setSelectedModeOverride(null);
        setStep("select");
    };
    const completeConversion = () => {
        store.convert(selectedMode);
        setOpenFromSettings(false);
        window.location.reload();
    };
    const handleContinue = () => destinationHasData ? setStep("replace") : completeConversion();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
            <DialogContent className="max-h-[90dvh] overflow-hidden p-0 md:max-w-4xl">
                <DialogHeader className="border-b border-border-color bg-black/60 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-tarkov-green/25 bg-tarkov-green/10 text-tarkov-green"><ArchiveRestore size={20} /></span>
                        <div>
                            <DialogTitle className="text-lg text-white">
                                {step === "replace" ? `Replace ${selectedMode} profile data?` : "Restore your old profile data"}
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-sm text-gray-400">
                                {step === "replace" ? "Review the data that will be replaced before continuing." : "We kept your data from before profiles were introduced. Choose where it belongs."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {step === "select" ? (
                    <div className="grid max-h-[65dvh] overflow-y-auto md:grid-cols-2">
                        <section className="space-y-5 border-b border-border-color bg-black/30 p-6 md:border-b-0 md:border-r">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Your old data</div>
                            <StatsPanel stats={oldStats} />
                        </section>
                        <section className="space-y-5 bg-black/20 p-6">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Destination profile</div>
                            <div className="space-y-2">
                                {GAME_MODES.map((mode) => {
                                    const selected = selectedMode === mode;
                                    const hasData = hasProfileData(store.profiles[mode]);
                                    return (
                                        <button key={mode} type="button" aria-pressed={selected} onClick={() => setSelectedModeOverride(mode)}
                                            className={cn("flex w-full items-center gap-3 border p-4 text-left transition-colors", selected ? "border-tarkov-green/50 bg-tarkov-green/10" : "border-white/10 bg-black/20 hover:bg-white/5")}
                                        >
                                            <span className={cn("flex h-9 w-9 items-center justify-center rounded-full border", selected ? "border-tarkov-green bg-tarkov-green text-black" : "border-white/15 text-gray-600")}>
                                                {selected ? <Check size={17} strokeWidth={3} /> : <ShieldCheck size={17} />}
                                            </span>
                                            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                                <span className="text-sm font-semibold text-white">{mode}</span>
                                                {hasData && <span className="inline-flex items-center gap-1 border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-wide text-amber-200"><AlertTriangle size={11} /> Has data</span>}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="text-xs leading-5 text-gray-500">Your old snapshot will remain stored after restoration.</div>
                        </section>
                    </div>
                ) : (
                    <div className="grid max-h-[65dvh] overflow-y-auto md:grid-cols-2">
                        <section className="space-y-5 border-b border-tarkov-green/20 bg-tarkov-green/[0.03] p-6 md:border-b-0 md:border-r">
                            <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[0.18em] text-tarkov-green">Old data</span><span className="text-[10px] uppercase tracking-wide text-tarkov-green/70">Will be restored</span></div>
                            <StatsPanel stats={oldStats} />
                        </section>
                        <section className="space-y-5 bg-red-500/[0.03] p-6">
                            <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Current {selectedMode} data</span><span className="text-[10px] uppercase tracking-wide text-red-300/70">Will be replaced</span></div>
                            <StatsPanel stats={currentStats} />
                        </section>
                    </div>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-border-color bg-black/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white">Cancel</button>
                    <div className="flex items-center justify-end gap-2">
                        {step === "replace" && <button type="button" onClick={() => setStep("select")} className="px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white">Back</button>}
                        <button type="button" onClick={step === "replace" ? completeConversion : handleContinue}
                            className={cn("inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold transition-colors", step === "replace" ? "bg-red-500 text-white hover:bg-red-400" : "bg-tarkov-green text-black hover:bg-lime-300")}
                        >
                            {step === "replace" ? `Replace ${selectedMode} data` : "Confirm and continue"}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
