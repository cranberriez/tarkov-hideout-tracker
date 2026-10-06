"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArchiveRestore, Check, ShieldCheck } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { GAME_MODES, type GameMode, useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";
import { legacyProfileConversionQueryOptions } from "@/lib/query/conversions";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import type { LegacyConversionStation } from "@/types/contracts";

import { hasProfileData } from "./profile-data";

type DialogStep = "select" | "replace";

const EMPTY_STATIONS: LegacyConversionStation[] = [];

interface ProfileStats {
	playerLevel: number;
	prestigeLevel: number;
	faction: string;
	edition: string;
	completedQuests: number;
	totalItems: number;
	savedStations: Array<{ id: string; name: string; level: number }>;
	loyaltySummary: Array<{ level: number; count: number }>;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function countEnabled(value: unknown) {
	return Object.values(asRecord(value)).filter(Boolean).length;
}

function getNumber(value: unknown, fallback = 0) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildStats(source: Record<string, unknown>, stations: LegacyConversionStation[]): ProfileStats {
	const totalItems = Object.values(asRecord(source.itemCounts)).reduce<number>((total, value) => {
		const counts = asRecord(value);
		return total + getNumber(counts.have) + getNumber(counts.haveFir);
	}, 0);
	const stationLevels = asRecord(source.stationLevels);
	const stationNames = new Map(stations.map((station) => [station.id, station.name]));
	const savedStations = Object.entries(stationLevels)
		.filter(([, level]) => getNumber(level) > 0)
		.map(([id, level]) => ({ id, name: stationNames.get(id) ?? `Unknown station (${id})`, level: getNumber(level) }));
	const loyaltyLevels = Object.values(asRecord(source.questTraderLoyaltyLevels)).map((value) => getNumber(value, 1));

	return {
		playerLevel: getNumber(source.playerLevel, 1),
		prestigeLevel: getNumber(source.prestigeLevel),
		faction: source.questFaction === "BEAR" ? "BEAR" : "USEC",
		edition: typeof source.gameEdition === "string" ? source.gameEdition : "Not set",
		completedQuests: countEnabled(source.completedQuests),
		totalItems,
		savedStations,
		loyaltySummary: [1, 2, 3, 4]
			.map((level) => ({ level, count: loyaltyLevels.filter((value) => value === level).length }))
			.filter(({ count }) => count > 0),
	};
}

function StatsPanel({ stats, legacy = false }: { stats: ProfileStats; legacy?: boolean }) {
	return (
		<div className="space-y-5">
			<div className="grid grid-cols-2 gap-2">
				{[
					["Character level", stats.playerLevel],
					["Faction", stats.faction],
					["Prestige", stats.prestigeLevel],
					["Edition", stats.edition],
					[legacy ? "Old quests (not imported)" : "Completed quests", stats.completedQuests],
					["Items held", stats.totalItems.toLocaleString()],
				].map(([label, value]) => (
					<div key={label} className="border border-highlight/8 bg-highlight/[0.03] p-3">
						<div className="text-[10px] uppercase tracking-wide text-subtle-foreground">{label}</div>
						<div className="mt-1 text-sm font-medium text-foreground">{value}</div>
					</div>
				))}
			</div>
			<div>
				<div className="text-xs text-subtle-foreground">Trader loyalty levels</div>
				<div className="mt-2 flex flex-wrap gap-2">
					{stats.loyaltySummary.length > 0 ? (
						stats.loyaltySummary.map(({ level, count }) => (
							<span key={level} className="border border-highlight/10 bg-shadow/30 px-2.5 py-1 text-xs text-foreground">
								LL{level} · {count} {count === 1 ? "trader" : "traders"}
							</span>
						))
					) : (
						<span className="text-xs text-subtle-foreground">No saved trader levels</span>
					)}
				</div>
			</div>
			<div>
				<div className="text-xs text-subtle-foreground">Saved hideout levels · {stats.savedStations.length}</div>
				<div className="mt-2 text-xs leading-5 text-muted-foreground">
					{stats.savedStations.length > 0
						? stats.savedStations.map((station) => `${station.name}: level ${station.level}`).join(", ")
						: "No saved station upgrades."}
				</div>
			</div>
		</div>
	);
}

export function LegacyProfileConversionDialog() {
	const hydrated = useUserStoreHydrated();
	const store = useUserStore(
		useShallow((state) => ({
			deprecatedLegacyState: state.deprecatedLegacyState,
			hasConverted: state.hasConvertedDeprecatedLegacyState,
			hasDismissed: state.hasDismissedDeprecatedLegacyState,
			profiles: state.profiles,
			gameMode: state.gameMode,
			convert: state.convertDeprecatedLegacyState,
			dismiss: state.dismissDeprecatedLegacyState,
		})),
	);
	const { isOpenFromSettings, setOpenFromSettings, isDeferred, defer } = useUIStore(
		useShallow((state) => ({
			isOpenFromSettings: state.isLegacyProfileConversionOpen,
			setOpenFromSettings: state.setLegacyProfileConversionOpen,
			isDeferred: state.isLegacyProfileConversionDeferred,
			defer: state.deferLegacyProfileConversion,
		})),
	);
	const [selectedModeOverride, setSelectedModeOverride] = useState<GameMode | null>(null);
	const [step, setStep] = useState<DialogStep>("select");
	const [saveError, setSaveError] = useState<string | null>(null);
	const isPending = store.deprecatedLegacyState !== null && !store.hasConverted && !store.hasDismissed;
	const shouldOpenAutomatically = isPending && !isDeferred;
	const isOpen = hydrated && store.deprecatedLegacyState !== null && (shouldOpenAutomatically || isOpenFromSettings);
	const selectedMode = selectedModeOverride ?? store.gameMode;
	const requestedMode = toTarkovJsonGameMode(selectedMode);
	const conversionQuery = useQuery({
		...legacyProfileConversionQueryOptions(requestedMode),
		enabled: isOpen,
	});
	const conversionData = conversionQuery.data ?? null;
	const requestError = conversionQuery.error ? "Station details could not be loaded." : null;
	const isLoading = isOpen && conversionQuery.isPending;
	const destinationHasData = hasProfileData(store.profiles[selectedMode]);
	const availableStations = conversionData?.stations ?? EMPTY_STATIONS;
	const oldStats = useMemo(
		() => (store.deprecatedLegacyState ? buildStats(store.deprecatedLegacyState, availableStations) : null),
		[availableStations, store.deprecatedLegacyState],
	);
	const currentStats = useMemo(
		() => buildStats(store.profiles[selectedMode] as unknown as Record<string, unknown>, availableStations),
		[availableStations, selectedMode, store.profiles],
	);

	if (!store.deprecatedLegacyState || !oldStats) return null;

	const resetDialog = () => {
		setSelectedModeOverride(null);
		setStep("select");
	};
	const handleSkip = () => {
		if (!store.hasConverted) store.dismiss();
		setOpenFromSettings(false);
		resetDialog();
	};
	// Escape and the close button leave the choice pending; the banner offers it again.
	const handleClose = () => {
		if (isPending) defer();
		else setOpenFromSettings(false);
		resetDialog();
	};
	const completeConversion = () => {
		setSaveError(null);
		try {
			store.convert(selectedMode);
			setOpenFromSettings(false);
			window.location.reload();
		} catch {
			setSaveError(
				"Your profile could not be saved. Your previous data is preserved. Check browser storage and try again.",
			);
		}
	};
	const handleContinue = () => (destinationHasData ? setStep("replace") : completeConversion());

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent
				className="max-h-[90dvh] overflow-hidden p-0 md:max-w-4xl"
				onInteractOutside={(event) => event.preventDefault()}
			>
				<DialogHeader className="border-b border-border-color bg-shadow/60 px-6 py-5">
					<div className="flex items-center gap-3">
						<span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand/25 bg-brand/10 text-brand">
							<ArchiveRestore size={20} />
						</span>
						<div>
							<DialogTitle className="text-lg text-foreground">
								{step === "replace" ? `Replace ${selectedMode} profile data?` : "Restore your old profile data"}
							</DialogTitle>
							<DialogDescription className="mt-1 text-sm text-muted-foreground">
								{step === "replace"
									? "Review the data that will be replaced before continuing."
									: "We kept your data from before profiles were introduced. Choose where it belongs."}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				{(isLoading || requestError || conversionData?.errors.stations) && (
					<div className="border-b border-border-color bg-shadow/40 px-6 py-2 text-xs text-muted-foreground">
						{isLoading ? "Loading hideout station details…" : (requestError ?? conversionData?.errors.stations)}
						{requestError && (
							<button type="button" onClick={() => void conversionQuery.refetch()} className="ml-2 underline">
								Retry
							</button>
						)}
					</div>
				)}

				{step === "select" ? (
					<div className="grid max-h-[65dvh] overflow-y-auto md:grid-cols-2">
						<section className="space-y-5 border-b border-border-color bg-shadow/30 p-6 md:border-b-0 md:border-r">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle-foreground">
								Your old data
							</div>
							<StatsPanel stats={oldStats} legacy />
						</section>
						<section className="space-y-5 bg-shadow/20 p-6">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle-foreground">
								Destination profile
							</div>
							<div className="space-y-2">
								{GAME_MODES.map((mode) => {
									const selected = selectedMode === mode;
									const hasData = hasProfileData(store.profiles[mode]);
									return (
										<button
											key={mode}
											type="button"
											aria-pressed={selected}
											onClick={() => setSelectedModeOverride(mode)}
											className={cn(
												"flex w-full items-center gap-3 border p-4 text-left transition-colors",
												selected
													? "border-brand/50 bg-brand/10"
													: "border-highlight/10 bg-shadow/20 hover:bg-highlight/5",
											)}
										>
											<span
												className={cn(
													"flex h-9 w-9 items-center justify-center rounded-full border",
													selected
														? "border-brand bg-brand text-inverse"
														: "border-highlight/15 text-subtle-foreground",
												)}
											>
												{selected ? <Check size={17} strokeWidth={3} /> : <ShieldCheck size={17} />}
											</span>
											<span className="flex min-w-0 flex-1 items-center justify-between gap-3">
												<span className="text-sm font-semibold text-foreground">{mode}</span>
												{hasData && (
													<span className="inline-flex items-center gap-1 border border-warning/25 bg-warning/10 px-2 py-1 text-[10px] uppercase tracking-wide text-warning">
														<AlertTriangle size={11} /> Has data
													</span>
												)}
											</span>
										</button>
									);
								})}
							</div>
							<div className="text-xs leading-5 text-subtle-foreground">
								Hideout levels, completed hideout requirements, inventory (including FiR counts), and character settings
								will be copied. Your original old data will remain stored separately and unchanged.
							</div>
							<div className="text-xs leading-5 text-warning">
								Quest progress will not be copied because quests have been extensively reworked. Completed, failed,
								tracked, and pinned quests will start fresh in the destination profile.
							</div>
						</section>
					</div>
				) : (
					<div className="grid max-h-[65dvh] overflow-y-auto md:grid-cols-2">
						<p className="p-4 text-xs text-warning md:col-span-2">
							This replaces the selected profile, including clearing its quest progress. Old quests are not imported.
							Your original old storage and other profiles are preserved.
						</p>
						<section className="space-y-5 border-b border-brand/20 bg-brand/[0.03] p-6 md:border-b-0 md:border-r">
							<div className="flex items-center justify-between gap-3">
								<span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Old data</span>
								<span className="text-[10px] uppercase tracking-wide text-brand/70">Will be restored</span>
							</div>
							<StatsPanel stats={oldStats} legacy />
						</section>
						<section className="space-y-5 bg-danger/[0.03] p-6">
							<div className="flex items-center justify-between gap-3">
								<span className="text-xs font-semibold uppercase tracking-[0.18em] text-danger">
									Current {selectedMode} data
								</span>
								<span className="text-[10px] uppercase tracking-wide text-danger/70">Will be replaced</span>
							</div>
							<StatsPanel stats={currentStats} />
						</section>
					</div>
				)}

				{saveError && (
					<p role="alert" className="px-6 py-3 text-sm text-danger">
						{saveError}
					</p>
				)}
				<div className="flex flex-col-reverse gap-3 border-t border-border-color bg-shadow/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
					<button
						type="button"
						onClick={handleSkip}
						className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-highlight/5 hover:text-foreground"
					>
						{store.hasConverted ? "Cancel" : "Skip"}
					</button>
					<div className="flex items-center justify-end gap-2">
						{step === "replace" && (
							<button
								type="button"
								onClick={() => setStep("select")}
								className="px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-highlight/5 hover:text-foreground"
							>
								Back
							</button>
						)}
						<button
							type="button"
							onClick={step === "replace" ? completeConversion : handleContinue}
							className={cn(
								"inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold transition-colors",
								step === "replace"
									? "bg-danger text-inverse hover:bg-danger/85"
									: "bg-brand text-inverse hover:bg-brand-hover",
							)}
						>
							{step === "replace" ? `Replace ${selectedMode} data` : "Confirm and continue"}
						</button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
