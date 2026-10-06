import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameMode } from "@/lib/stores/useUserStore";

export const KAPPA_STORE_STORAGE_KEY = "tarkov-kappa-checklist-state";

export type KappaViewMode = "all" | "need";

type CompletedItemsByMode = Partial<Record<GameMode, Record<string, boolean>>>;

interface KappaState {
	completedItemsByMode: CompletedItemsByMode;
	viewMode: KappaViewMode;
	/** The uploader stops keeping copies for Kappa hand-ins. */
	ignoreInUploader: boolean;
	setViewMode: (viewMode: KappaViewMode) => void;
	setIgnoreInUploader: (ignore: boolean) => void;
	toggleCompletedItem: (gameMode: GameMode, itemId: string) => void;
	/** Checks items off without unchecking any already done. */
	completeItems: (gameMode: GameMode, itemIds: readonly string[]) => void;
	resetCompletedItems: () => void;
	importCompletedItems: (profiles: CompletedItemsByMode) => void;
	resetAll: () => void;
}

const DEFAULT_KAPPA_STATE = {
	completedItemsByMode: {},
	viewMode: "all" as KappaViewMode,
	ignoreInUploader: false,
};

export const useKappaStore = create<KappaState>()(
	persist(
		(set) => ({
			...DEFAULT_KAPPA_STATE,
			importCompletedItems: (profiles) =>
				set((state) => ({
					completedItemsByMode: { ...state.completedItemsByMode, ...profiles },
				})),
			setViewMode: (viewMode) => set({ viewMode }),
			setIgnoreInUploader: (ignoreInUploader) => set({ ignoreInUploader }),
			completeItems: (gameMode, itemIds) =>
				set((state) => ({
					completedItemsByMode: {
						...state.completedItemsByMode,
						[gameMode]: {
							...(state.completedItemsByMode[gameMode] ?? {}),
							...Object.fromEntries(itemIds.map((itemId) => [itemId, true])),
						},
					},
				})),
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
			partialize: ({ completedItemsByMode, viewMode, ignoreInUploader }) => ({
				completedItemsByMode,
				viewMode,
				ignoreInUploader,
			}),
		},
	),
);
