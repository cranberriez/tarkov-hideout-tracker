"use client";

import { useSyncExternalStore } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { FilterSwitchRow } from "@/components/ui/filter-bar";
import { APP_THEMES, APP_THEME_LABELS, type AppTheme } from "@/lib/cfg/app-preferences";
import { useAppPreferencesStore } from "@/lib/stores/useAppPreferencesStore";
import { cn } from "@/lib/utils";

/** Base roles only: derived roles (such as `--card`) resolve at <html> and ignore a nested `data-theme`. */
const SWATCH_ROLES = ["bg-background", "bg-[var(--card-bg)]", "bg-brand", "bg-success", "bg-warning", "bg-danger"];

function subscribeHydration(notify: () => void) {
	return useAppPreferencesStore.persist.onFinishHydration(notify);
}

export function PreferencesCard() {
	const hydrated = useSyncExternalStore(
		subscribeHydration,
		() => useAppPreferencesStore.persist.hasHydrated(),
		() => false,
	);
	const theme = useAppPreferencesStore((state) => state.theme);
	const hoverCards = useAppPreferencesStore((state) => state.hoverCards);
	const setTheme = useAppPreferencesStore((state) => state.setTheme);
	const setHoverCards = useAppPreferencesStore((state) => state.setHoverCards);
	// Server and pre-hydration renders show defaults, avoiding a mismatch with saved values.
	const activeTheme: AppTheme = hydrated ? theme : "default";

	return (
		<section className="overflow-hidden rounded-lg border border-highlight/10 bg-card">
			<div className="flex items-center gap-3 border-b border-highlight/10 px-5 py-4">
				<div className="rounded-md border border-highlight/10 bg-highlight/5 p-2.5 text-muted-foreground">
					<SlidersHorizontal size={21} />
				</div>
				<div>
					<h2 className="text-sm font-semibold text-foreground">Preferences</h2>
					<p className="mt-1 text-xs text-muted-foreground">Applies to every profile on this device.</p>
				</div>
			</div>
			<div className="divide-y divide-highlight/8">
				<FilterSwitchRow
					label="Hover cards"
					description="Show item, recipe and requirement previews when hovering."
					checked={hydrated ? hoverCards : true}
					onCheckedChange={setHoverCards}
				/>
				<fieldset className="px-3 py-3">
					<legend className="mb-2.5 text-sm text-foreground">Appearance</legend>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{APP_THEMES.map((option) => {
							const selected = option === activeTheme;
							return (
								<label
									key={option}
									className={cn(
										"flex cursor-pointer flex-col gap-2 rounded-md border p-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand",
										selected ? "border-brand/60 bg-brand/10" : "border-highlight/10 hover:bg-highlight/5",
									)}
								>
									<input
										type="radio"
										name="app-theme"
										value={option}
										checked={selected}
										onChange={() => setTheme(option)}
										className="sr-only"
									/>
									{/* The default scope resets roles a theme leaves unset, instead of inheriting the page theme. */}
									<span data-theme="default" aria-hidden="true" className="block">
										<span data-theme={option} className="flex h-7 overflow-hidden rounded border border-border">
											{SWATCH_ROLES.map((role) => (
												<span key={role} className={cn("flex-1", role)} />
											))}
										</span>
									</span>
									<span className="flex items-center justify-between gap-2">
										<span className="text-xs font-medium text-foreground">{APP_THEME_LABELS[option].label}</span>
										{selected && <Check size={14} className="text-brand" />}
									</span>
									<span className="text-[10px] leading-4 text-subtle-foreground">
										{APP_THEME_LABELS[option].description}
									</span>
								</label>
							);
						})}
					</div>
				</fieldset>
			</div>
		</section>
	);
}
