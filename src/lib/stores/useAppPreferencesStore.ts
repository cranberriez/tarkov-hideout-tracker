import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { APP_PREFERENCES_STORAGE_KEY, isAppTheme, type AppTheme } from "@/lib/cfg/app-preferences";

/** Global display preferences; outside profiles, backups and every reset. */
interface AppPreferencesState {
	theme: AppTheme;
	hoverCards: boolean;
	setTheme: (theme: AppTheme) => void;
	setHoverCards: (hoverCards: boolean) => void;
}

export const useAppPreferencesStore = create<AppPreferencesState>()(
	persist(
		(set) => ({
			theme: "default",
			hoverCards: true,
			setTheme: (theme) => set({ theme }),
			setHoverCards: (hoverCards) => set({ hoverCards }),
		}),
		{
			name: APP_PREFERENCES_STORAGE_KEY,
			version: 1,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ theme, hoverCards }) => ({ theme, hoverCards }),
			merge: (persisted, current) => {
				const saved = (persisted ?? {}) as Partial<AppPreferencesState>;
				return {
					...current,
					theme: isAppTheme(saved.theme) ? saved.theme : current.theme,
					hoverCards: typeof saved.hoverCards === "boolean" ? saved.hoverCards : current.hoverCards,
				};
			},
		},
	),
);
