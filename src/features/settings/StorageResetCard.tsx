"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import {
    USER_STORE_STORAGE_KEY,
    useUserStore,
} from "@/lib/stores/useUserStore";
import {
    KAPPA_STORE_STORAGE_KEY,
    useKappaStore,
} from "@/lib/stores/useKappaStore";
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
    const resetKappaItems = useKappaStore((state) => state.resetCompletedItems);
    const resetKappaAll = useKappaStore((state) => state.resetAll);
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
            questCardSize: state.questCardSize,
            questSortMode: state.questSortMode,
            questSelectedTraders: state.questSelectedTraders,
            questFaction: state.questFaction,
            questShowKappa: state.questShowKappa,
            questShowLightkeeper: state.questShowLightkeeper,
            questSelectedMaps: state.questSelectedMaps,
            questHideCompleted: state.questHideCompleted,
            questShowAvailableOnly: state.questShowAvailableOnly,
            questVisibilityMode: state.questVisibilityMode,
            questActiveDepth: state.questActiveDepth,
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
    const kappaStorageSignal = useKappaStore(
        useShallow((state) => ({
            completedItemsByMode: state.completedItemsByMode,
            viewMode: state.viewMode,
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
        void kappaStorageSignal;

        if (!isHydrated || typeof window === "undefined") {
            return { usedBytes: 0, usedKilobytes: "0.0", percent: 0 };
        }

        const userStoreRaw = window.localStorage.getItem(USER_STORE_STORAGE_KEY) ?? "";
        const kappaStoreRaw = window.localStorage.getItem(KAPPA_STORE_STORAGE_KEY) ?? "";
        const usedBytes = new TextEncoder().encode(userStoreRaw + kappaStoreRaw).length;
        const percent = Math.min((usedBytes / LOCAL_STORAGE_QUOTA_BYTES) * 100, 100);

        return {
            usedBytes,
            usedKilobytes: (usedBytes / 1024).toFixed(1),
            percent,
        };
    }, [isHydrated, kappaStorageSignal, storageSignal]);

    function confirmReset(action: Exclude<ResetAction, null>) {
        if (action === "hideout") {
            resetHideoutData();
        } else if (action === "items") {
            resetItemData();
            resetKappaItems();
        } else if (action === "quests") {
            resetQuestData();
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(QUEST_LOG_IMPORT_SEEN_FILES_KEY);
            }
        } else {
            resetAll();
            resetKappaAll();
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
                        "Deletes item counts for the active profile and Kappa checklist progress for all three profiles. Settings stay the same.",
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
                        "Deletes all three player profiles, Kappa progress, and their shared settings. Separate profit settings and import-file history remain. This cannot be undone.",
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
            tone: "border-danger/15 bg-danger/[0.07] text-danger hover:bg-danger/[0.11]",
        },
        {
            key: "items" as const,
            label: "Delete all item data",
            description: "Active profile’s items and all profiles’ Kappa completion.",
            tone: "border-danger/15 bg-danger/[0.07] text-danger hover:bg-danger/[0.11]",
        },
        {
            key: "quests" as const,
            label: "Delete all quest data",
            description: "Removes quest progress and sync cache.",
            tone: "border-danger/15 bg-danger/[0.07] text-danger hover:bg-danger/[0.11]",
        },
        {
            key: "all" as const,
            label: "Delete ALL data",
            description: "All profiles, Kappa progress, and shared settings. Separate profit data remains.",
            tone: "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
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
                        <div className="text-sm font-medium text-foreground">Saved data usage</div>
                        <div className="text-xs text-muted-foreground">
                            {storageUsage.usedKilobytes} KB / {quotaMegabytes} MB
                        </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-highlight/8">
                        <div
                            className="h-full rounded-full bg-highlight/35 transition-[width]"
                            style={{ width: `${storageUsage.percent}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{percentLabel}% of saved space used</span>
                        <span>Profile & Kappa storage · estimated capacity</span>
                    </div>
                </div>

                <div className="border-t border-highlight/10 pt-4 space-y-3">
                    <div className="space-y-1">
                        <div className="text-sm font-medium text-danger">Reset progress</div>
                        <div className="text-xs text-foreground/80 max-w-xl leading-5">
                            Section resets affect the active profile unless noted. Export a backup before deleting progress.
                        </div>
                    </div>

                    <div className="divide-y divide-highlight/5">
                        {resetButtons.map((button) => (
                            <div
                                key={button.key}
                                className="py-3"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                        <div className="text-sm font-medium text-foreground">
                                            {button.label}
                                        </div>
                                        <div className="text-xs text-muted-foreground leading-5">
                                            {button.description}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPendingReset(button.key)}
                                        className={`inline-flex shrink-0 items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${button.tone}`}
                                    >
                                        {button.key === "all" ? "Reset all profiles" : "Reset"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <Dialog open={pendingReset !== null} onOpenChange={(open) => !open && setPendingReset(null)}>
                <DialogContent className="max-w-md p-0 overflow-hidden">
                    <DialogHeader className="border-b border-border-color bg-shadow/60 px-6 py-4">
                        <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-foreground">
                            {resetDialogContent?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 bg-shadow/40 px-6 py-5">
                        <DialogDescription className="text-sm leading-6 text-muted-foreground">
                            {resetDialogContent?.description}
                        </DialogDescription>
                        <DialogFooter>
                            <button
                                type="button"
                                onClick={() => setPendingReset(null)}
                                className="inline-flex items-center justify-center rounded-md border border-highlight/10 bg-highlight/5 px-3 py-2 text-xs sm:text-sm text-foreground transition-colors hover:bg-highlight/10"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => pendingReset && confirmReset(pendingReset)}
                                className="inline-flex items-center justify-center rounded-md border border-danger/60 bg-danger/10 px-3 py-2 text-xs sm:text-sm text-danger transition-colors hover:bg-danger/20"
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
