import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { APP_PREFERENCES_STORAGE_KEY, isAppTheme, type AppTheme } from "@/lib/cfg/app-preferences";

/** Global display preferences; outside profiles, backups and every reset. */
interface AppPreferencesState {
	theme: AppTheme;
	hoverCards: boolean;
	/** Set once a scan reaches the uploader's Sort step; hides the first-run tutorial. */
	uploaderIntroSeen: boolean;
	setTheme: (theme: AppTheme) => void;
	setHoverCards: (hoverCards: boolean) => void;
	markUploaderIntroSeen: () => void;
}

export const useAppPreferencesStore = create<AppPreferencesState>()(
	persist(
		(set) => ({
			theme: "default",
			hoverCards: true,
			uploaderIntroSeen: false,
			setTheme: (theme) => set({ theme }),
			setHoverCards: (hoverCards) => set({ hoverCards }),
			markUploaderIntroSeen: () => set({ uploaderIntroSeen: true }),
		}),
		{
			name: APP_PREFERENCES_STORAGE_KEY,
			version: 1,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ theme, hoverCards, uploaderIntroSeen }) => ({ theme, hoverCards, uploaderIntroSeen }),
			merge: (persisted, current) => {
				const saved = (persisted ?? {}) as Partial<AppPreferencesState>;
				return {
					...current,
					theme: isAppTheme(saved.theme) ? saved.theme : current.theme,
					hoverCards: typeof saved.hoverCards === "boolean" ? saved.hoverCards : current.hoverCards,
					uploaderIntroSeen: saved.uploaderIntroSeen === true,
				};
			},
		},
	),
);
