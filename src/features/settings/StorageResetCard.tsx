"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import {
    USER_STORE_STORAGE_KEY,
    useUserStore,
} from "@/lib/stores/useUserStore";
import { QUEST_LOG_IMPORT_SEEN_FILES_KEY } from "@/lib/utils/quest-log-import";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

type ResetAction = "hideout" | "items" | "quests" | "all" | null;

export function StorageResetCard() {
    const resetHideoutData = useUserStore((state) => state.resetHideoutData);
    const resetItemData = useUserStore((state) => state.resetItemData);
    const resetQuestData = useUserStore((state) => state.resetQuestData);
    const resetAll = useUserStore((state) => state.resetAll);
    const storageSignal = useUserStore(
        useShallow((state) => ({
            stationLevels: state.stationLevels,
            hiddenStations: state.hiddenStations,
            completedRequirements: state.completedRequirements,
            itemCounts: state.itemCounts,
            completedQuests: state.completedQuests,
            questsWithItems: state.questsWithItems,
            ignoredQuests: state.ignoredQuests,
            pinnedQuests: state.pinnedQuests,
            checklistViewMode: state.checklistViewMode,
            itemSourceFilter: state.itemSourceFilter,
            showHidden: state.showHidden,
            hideCheap: state.hideCheap,
            hideMoney: state.hideMoney,
            showFirOnly: state.showFirOnly,
            hideRequirements: state.hideRequirements,
            cheapPriceThreshold: state.cheapPriceThreshold,
            hideoutCompactMode: state.hideoutCompactMode,
            itemsSize: state.itemsSize,
            hasSeenItemConversionModal: state.hasSeenItemConversionModal,
            hasSeenHideoutLevelWarning: state.hasSeenHideoutLevelWarning,
            sellToPreference: state.sellToPreference,
            useCategorization: state.useCategorization,
            playerLevel: state.playerLevel,
            prestigeLevel: state.prestigeLevel,
            questTraderLoyaltyLevels: state.questTraderLoyaltyLevels,
            questViewMode: state.questViewMode,
            questSelectedTraders: state.questSelectedTraders,
            questFaction: state.questFaction,
            questShowKappa: state.questShowKappa,
            questShowLightkeeper: state.questShowLightkeeper,
            questSelectedMaps: state.questSelectedMaps,
            questHideCompleted: state.questHideCompleted,
            questShowAvailableOnly: state.questShowAvailableOnly,
            questShowHandInOnly: state.questShowHandInOnly,
            questShowFirHandInOnly: state.questShowFirHandInOnly,
            questShowPinnedOnly: state.questShowPinnedOnly,
            questShowIgnored: state.questShowIgnored,
            questShowDebug: state.questShowDebug,
            questShowPrereqs: state.questShowPrereqs,
            questSidebarCollapsed: state.questSidebarCollapsed,
            itemShowPinnedQuestSection: state.itemShowPinnedQuestSection,
            itemShowPinnedQuestOnly: state.itemShowPinnedQuestOnly,
            itemQuestMaxDepth: state.itemQuestMaxDepth,
            itemQuestVisibilityMode: state.itemQuestVisibilityMode,
            itemQuestCustomLookahead: state.itemQuestCustomLookahead,
            itemQuestCustomLevelLookahead: state.itemQuestCustomLevelLookahead,
            itemShowFutureFir: state.itemShowFutureFir,
            gameEdition: state.gameEdition,
            gameMode: state.gameMode,
            hasCompletedSetup: state.hasCompletedSetup,
            isSetupOpen: state.isSetupOpen,
            editionBonusesAppliedFor: state.editionBonusesAppliedFor,
        })),
    );

    const [pendingReset, setPendingReset] = useState<ResetAction>(null);
    const isHydrated = useSyncExternalStore(
        () => () => undefined,
        () => true,
        () => false,
    );

    const storageUsage = useMemo(() => {
        void storageSignal;

        if (!isHydrated || typeof window === "undefined") {
            return { usedBytes: 0, usedKilobytes: "0.0", percent: 0 };
        }

        const raw = window.localStorage.getItem(USER_STORE_STORAGE_KEY) ?? "";
        const usedBytes = new TextEncoder().encode(raw).length;
        const percent = Math.min((usedBytes / LOCAL_STORAGE_QUOTA_BYTES) * 100, 100);

        return {
            usedBytes,
            usedKilobytes: (usedBytes / 1024).toFixed(1),
            percent,
        };
    }, [isHydrated, storageSignal]);

    function confirmReset(action: Exclude<ResetAction, null>) {
        if (action === "hideout") {
            resetHideoutData();
        } else if (action === "items") {
            resetItemData();
        } else if (action === "quests") {
            resetQuestData();
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(QUEST_LOG_IMPORT_SEEN_FILES_KEY);
            }
        } else {
            resetAll();
        }

        setPendingReset(null);
    }

    const resetDialogContent = useMemo(() => {
        switch (pendingReset) {
            case "hideout":
                return {
                    title: "Delete all hideout data?",
                    description:
                        "Deletes hideout progress only. Preferences stay the same.",
                    confirmLabel: "Delete hideout data",
                };
            case "items":
                return {
                    title: "Delete all item data?",
                    description:
                        "Deletes tracked item counts only. Settings stay the same.",
                    confirmLabel: "Delete item data",
                };
            case "quests":
                return {
                    title: "Delete all quest data?",
                    description:
                        "Deletes quest progress and sync cache. Filters stay the same.",
                    confirmLabel: "Delete quest data",
                };
            case "all":
                return {
                    title: "Delete ALL data?",
                    description:
                        "Deletes all saved data. This cannot be undone.",
                    confirmLabel: "Delete ALL data",
                };
            default:
                return null;
        }
    }, [pendingReset]);

    const resetButtons = [
        {
            key: "hideout" as const,
            label: "Delete all hideout data",
            description: "Removes hideout progress.",
            tone: "border-red-500/15 bg-red-500/[0.07] text-red-100 hover:bg-red-500/[0.11]",
        },
        {
            key: "items" as const,
            label: "Delete all item data",
            description: "Removes item counts.",
            tone: "border-red-500/15 bg-red-500/[0.07] text-red-100 hover:bg-red-500/[0.11]",
        },
        {
            key: "quests" as const,
            label: "Delete all quest data",
            description: "Removes quest progress and sync cache.",
            tone: "border-red-500/15 bg-red-500/[0.07] text-red-100 hover:bg-red-500/[0.11]",
        },
        {
            key: "all" as const,
            label: "Delete ALL data",
            description: "Removes all saved data.",
            tone: "border-red-500/60 bg-red-600 text-white hover:bg-red-500",
        },
    ];

    const quotaMegabytes = (LOCAL_STORAGE_QUOTA_BYTES / (1024 * 1024)).toFixed(0);
    const percentLabel =
        storageUsage.percent < 0.1 && storageUsage.usedBytes > 0
            ? "<0.1"
            : storageUsage.percent.toFixed(1);

    return (
        <>
            <div className="bg-card border rounded-lg p-4 sm:p-5 space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-white">Saved data usage</div>
                        <div className="text-xs text-gray-400">
                            {storageUsage.usedKilobytes} KB / {quotaMegabytes} MB
                        </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                        <div
                            className="h-full rounded-full bg-white/35 transition-[width]"
                            style={{ width: `${storageUsage.percent}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
                        <span>{percentLabel}% of saved space used</span>
                        <span>Very small for most players</span>
                    </div>
                </div>

                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-4 sm:p-5 space-y-4">
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-white">Danger zone</div>
                        <div className="text-xs text-gray-300/80 max-w-xl leading-5">
                            Delete progress by section. The final action removes everything.
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {resetButtons.map((button) => (
                            <div
                                key={button.key}
                                className="rounded-md border border-white/6 bg-black/10 p-3 sm:p-4"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-white">
                                            {button.label}
                                        </div>
                                        <div className="text-xs text-gray-400 leading-5">
                                            {button.description}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPendingReset(button.key)}
                                        className={`inline-flex min-w-44 items-center justify-center rounded-md border px-3 py-2 text-xs font-medium sm:text-sm transition-colors ${button.tone}`}
                                    >
                                        {button.key === "all" ? "Delete everything" : "Delete"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Dialog open={pendingReset !== null} onOpenChange={(open) => !open && setPendingReset(null)}>
                <DialogContent className="max-w-md p-0 overflow-hidden">
                    <DialogHeader className="border-b border-border-color bg-black/60 px-6 py-4">
                        <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-gray-300">
                            {resetDialogContent?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 bg-black/40 px-6 py-5">
                        <DialogDescription className="text-sm leading-6 text-gray-400">
                            {resetDialogContent?.description}
                        </DialogDescription>
                        <DialogFooter>
                            <button
                                type="button"
                                onClick={() => setPendingReset(null)}
                                className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm text-gray-300 transition-colors hover:bg-white/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => pendingReset && confirmReset(pendingReset)}
                                className="inline-flex items-center justify-center rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs sm:text-sm text-red-400 transition-colors hover:bg-red-500/20"
                            >
                                {resetDialogContent?.confirmLabel}
                            </button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
