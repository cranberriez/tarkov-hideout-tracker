import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameMode } from "@/lib/stores/useUserStore";

export const KAPPA_STORE_STORAGE_KEY = "tarkov-kappa-checklist-state";

export type KappaViewMode = "all" | "need";

type CompletedItemsByMode = Partial<Record<GameMode, Record<string, boolean>>>;

interface KappaState {
    completedItemsByMode: CompletedItemsByMode;
    viewMode: KappaViewMode;
    setViewMode: (viewMode: KappaViewMode) => void;
    toggleCompletedItem: (gameMode: GameMode, itemId: string) => void;
    resetCompletedItems: () => void;
    resetAll: () => void;
}

const DEFAULT_KAPPA_STATE = {
    completedItemsByMode: {},
    viewMode: "all" as KappaViewMode,
};

export const useKappaStore = create<KappaState>()(
    persist(
        (set) => ({
            ...DEFAULT_KAPPA_STATE,
            setViewMode: (viewMode) => set({ viewMode }),
            toggleCompletedItem: (gameMode, itemId) =>
                set((state) => {
                    const completedForMode = {
                        ...(state.completedItemsByMode[gameMode] ?? {}),
                    };

                    if (completedForMode[itemId]) {
                        delete completedForMode[itemId];
                    } else {
                        completedForMode[itemId] = true;
                    }

                    return {
                        completedItemsByMode: {
                            ...state.completedItemsByMode,
                            [gameMode]: completedForMode,
                        },
                    };
                }),
            resetCompletedItems: () => set({ completedItemsByMode: {} }),
            resetAll: () => set({ ...DEFAULT_KAPPA_STATE }),
        }),
        {
            name: KAPPA_STORE_STORAGE_KEY,
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: ({ completedItemsByMode, viewMode }) => ({
                completedItemsByMode,
                viewMode,
            }),
        },
    ),
);
