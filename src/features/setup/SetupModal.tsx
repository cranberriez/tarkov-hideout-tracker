"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EditionSelection } from "./EditionSelection";
import { GameModeSelection } from "./GameModeSelection";
import { X } from "lucide-react";
import { QuickHideoutLevels } from "./QuickHideoutLevels";
import { STATIC_STATIONS } from "@/lib/data/static-stations";
import {
	createSetupDraft,
	selectDraftGameEdition,
	selectDraftGameMode,
	setDraftStationLevel,
	shouldStartOnHideoutLevels,
} from "./setup-draft";

export function SetupModal() {
	const { isSetupOpen, hasPendingLegacyConversion } = useUserStore(
		useShallow((state) => ({
			isSetupOpen: state.isSetupOpen,
			hasPendingLegacyConversion:
				state.deprecatedLegacyState !== null &&
				!state.hasConvertedDeprecatedLegacyState &&
				!state.hasDismissedDeprecatedLegacyState,
		})),
	);

	if (!isSetupOpen || hasPendingLegacyConversion) return null;

	// Mounted only while open, so closing discards every unsaved draft change.
	return <SetupDialog />;
}

function SetupDialog() {
	const { profiles, gameMode, completeSetup, setSetupOpen } = useUserStore(
		useShallow((state) => ({
			profiles: state.profiles,
			gameMode: state.gameMode,
			completeSetup: state.completeSetup,
			setSetupOpen: state.setSetupOpen,
		})),
	);
	const stations = STATIC_STATIONS;
	const [draft, setDraft] = useState(() => createSetupDraft(profiles, gameMode, stations));
	const [activeView, setActiveView] = useState<"settings" | "quick-levels">(() =>
		shouldStartOnHideoutLevels(profiles, gameMode) ? "quick-levels" : "settings",
	);
	const hasCompletedSetup = profiles[draft.gameMode].hasCompletedSetup;

	const handleFinish = () => {
		completeSetup(draft);
		window.location.reload();
	};

	const canFinish = draft.gameEdition !== null;

	return (
		<Dialog open onOpenChange={setSetupOpen}>
			<DialogContent
				showCloseButton={false}
				className="w-full md:max-w-3xl p-0 gap-0 overflow-hidden rounded-md bg-card border border-border-color"
			>
				<div className="px-6 py-4 flex items-center justify-between border-b border-border-color bg-shadow/60">
					<div>
						<DialogTitle className="text-sm font-semibold tracking-[0.2em] text-foreground">
							{hasCompletedSetup ? "EDIT SETUP" : "SET UP YOUR PROFILE"}
						</DialogTitle>
						<p className="mt-1 text-xs text-subtle-foreground">
							{activeView === "settings"
								? "Choose the profile that matches your Tarkov character."
								: "Set each station to its current in-game level."}
						</p>
					</div>
					<button
						type="button"
						onClick={() => setSetupOpen(false)}
						className="rounded-sm p-1 text-subtle-foreground transition-colors hover:bg-highlight/5 hover:text-foreground"
						aria-label="Close setup"
					>
						<X size={18} />
					</button>
				</div>

				<div className="p-6 max-h-[65vh] overflow-y-auto bg-shadow/40">
					{activeView === "settings" ? (
						<div className="space-y-8">
							<GameModeSelection
								selected={draft.gameMode}
								onSelect={(mode) => setDraft((current) => selectDraftGameMode(current, profiles, mode, stations))}
							/>
							<EditionSelection
								selected={draft.gameEdition}
								onSelect={(edition) => setDraft((current) => selectDraftGameEdition(current, edition, stations))}
							/>
						</div>
					) : (
						<QuickHideoutLevels
							stations={stations}
							stationLevels={draft.stationLevels}
							setStationLevel={(stationId, level) =>
								setDraft((current) => setDraftStationLevel(current, stationId, level))
							}
						/>
					)}
				</div>

				<div className="px-6 py-4 border-t border-border-color bg-shadow/70 flex items-center justify-end gap-3">
					{activeView === "settings" ? (
						<>
							<button
								onClick={handleFinish}
								disabled={!canFinish}
								className="px-4 py-2 rounded-sm font-medium text-sm text-muted-foreground hover:text-foreground hover:bg-highlight/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Save Setup
							</button>
							<button
								onClick={() => setActiveView("quick-levels")}
								disabled={!canFinish}
								className={`px-5 py-2 rounded-sm font-semibold text-sm tracking-wide transition-all ${
									canFinish
										? "bg-brand text-inverse hover:bg-brand-hover shadow-[0_0_18px_color-mix(in_oklab,_var(--brand)_25%,_transparent)]"
										: "bg-shadow/40 text-subtle-foreground border border-highlight/10 cursor-not-allowed"
								}`}
							>
								Hideout Levels &rarr;
							</button>
						</>
					) : (
						<>
							<button
								onClick={() => setActiveView("settings")}
								className="px-4 py-2 rounded-sm font-medium text-sm text-muted-foreground hover:text-foreground hover:bg-highlight/5 transition-colors"
							>
								&larr; Back
							</button>
							<button
								onClick={handleFinish}
								className="px-5 py-2 rounded-sm font-semibold text-sm tracking-wide bg-brand text-inverse hover:bg-brand-hover shadow-[0_0_18px_color-mix(in_oklab,_var(--brand)_25%,_transparent)] transition-all"
							>
								{hasCompletedSetup ? "Save Changes" : "Complete Setup"}
							</button>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
