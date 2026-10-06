"use client";

import { useEffect } from "react";
import { applyAppTheme } from "@/lib/cfg/app-preferences";
import { useAppPreferencesStore } from "@/lib/stores/useAppPreferencesStore";

/** Keeps `<html data-theme>` in step with the saved preference after the boot script's first paint. */
export function AppThemeSync() {
	const theme = useAppPreferencesStore((state) => state.theme);
	useEffect(() => applyAppTheme(document.documentElement, theme), [theme]);
	return null;
}
