/** Device-wide display preferences shared by every profile. Server-safe: no store or browser imports. */
export const APP_PREFERENCES_STORAGE_KEY = "tarkov-app-preferences-v1";

export const APP_THEMES = ["default", "dim", "light", "contrast"] as const;
export type AppTheme = (typeof APP_THEMES)[number];

export const APP_THEME_LABELS: Record<AppTheme, { label: string; description: string }> = {
	default: { label: "Default", description: "The original dark theme" },
	dim: { label: "Dim", description: "Softer, lighter dark surfaces" },
	light: { label: "Light", description: "Bright surfaces with ink accents" },
	contrast: { label: "High contrast", description: "Neutral black and white for readability" },
};

export function isAppTheme(value: unknown): value is AppTheme {
	return typeof value === "string" && (APP_THEMES as readonly string[]).includes(value);
}

/** `data-theme` is absent for the default theme so `:root` alone defines it. */
export function applyAppTheme(root: HTMLElement, theme: AppTheme) {
	if (theme === "default") delete root.dataset.theme;
	else root.dataset.theme = theme;
}

/** Runs in <head> before first paint so a saved theme never flashes the default palette. */
export const APP_THEME_BOOT_SCRIPT = `try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(
	APP_PREFERENCES_STORAGE_KEY,
)})||"null");t=t&&t.state&&t.state.theme;if(${JSON.stringify(
	APP_THEMES.filter((theme) => theme !== "default"),
)}.indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}`;
