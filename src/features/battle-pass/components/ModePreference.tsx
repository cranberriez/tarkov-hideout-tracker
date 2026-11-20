import { Circle, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import { DAILY_HEADROOM, gatheringDailyCap } from "../lib/gathering-caps";
import { BALANCED_MODE } from "../lib/owner-preference-model";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { SubDisclosure } from "./ui/Disclosure";
import { GatheringMapsPicker } from "./GatheringMapsPicker";
import { DocumentIcon } from "./ui/DocumentIcon";
import { Toggle } from "./ui/Toggle";
import { liftedControl, syncValue } from "./ui/field";

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

/** Marks a day count past the season end. */
function Late({ count, limit }: { count: number; limit: number }) {
	return count > limit ? <span className="text-warning"> · late</span> : null;
}

/** Preferred gathering mode: claims that need gathering go to this profile
 * whenever that costs nothing. Each card shows its gathering days at the target. */
export function ModePreference() {
	const { profiles, gathering, settings, modePreviews, deadline } = useBattlePassPlanContext();
	const { preferredMode, gatheringFilters, dailyHeadroom } = settings;
	if (profiles.length <= 1) return null;
	const { daysLeft } = deadline;
	const cards = [...profiles, { key: BALANCED_MODE, label: "Balanced", color: "var(--brand)" }];
	const current = modePreviews?.current;
	// Nothing to choose between when every card would show the same gathering.
	const signature = (preview: NonNullable<typeof current>) =>
		`${preview.byMode.map((row) => `${row.profileKey}:${row.quantity}`).join(",")}|${preview.days}`;
	if (
		current &&
		modePreviews.modes.length === cards.length &&
		modePreviews.modes.every((mode) => signature(mode.preview) === signature(current))
	)
		return null;
	return (
		<section data-syncing={gathering.stale || undefined} className="group/sync w-full space-y-3">
			<h4
				className="text-base font-semibold"
				title="Claims that need gathering go to this mode when it costs nothing extra. Balanced spreads them so the modes finish together."
			>
				Preferred mode
			</h4>
			<div
				className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", syncValue)}
				role="radiogroup"
				aria-label="Preferred gathering mode"
			>
				{cards.map((profile) => {
					const selected = preferredMode === profile.key;
					const off = !!gatheringFilters[profile.key]?.disabled;
					const modeIndex = modePreviews?.modes.findIndex((entry) => entry.profileKey === profile.key) ?? -1;
					const mode = modeIndex >= 0 ? modePreviews!.modes[modeIndex] : undefined;
					const Check = selected ? CircleCheck : Circle;
					return (
						<button
							key={profile.key}
							type="button"
							role="radio"
							aria-checked={selected}
							onClick={() => settings.setPreferredMode(selected ? null : profile.key)}
							className={cn(
								"group flex flex-col justify-start space-y-2 rounded-lg p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-brand",
								liftedControl,
								selected &&
									"bg-[color-mix(in_oklab,var(--brand)_4%,var(--surface-raised))] hover:bg-[color-mix(in_oklab,var(--brand)_7%,var(--surface-raised))]",
								off && !selected && "opacity-60",
							)}
						>
							<span className="flex items-center gap-2">
								<Check
									className={cn(
										"size-4 shrink-0 transition-colors",
										!selected && "text-muted-foreground group-hover:text-foreground",
									)}
									style={{ color: selected ? profile.color : undefined }}
									aria-hidden
								/>
								<span className="text-sm font-semibold" style={{ color: profile.color }}>
									{profile.label}
								</span>
								{off && !selected && <span className="ml-auto text-[11px] text-muted-foreground">Off</span>}
							</span>
							<span className="block space-y-0.5 tabular-nums text-muted-foreground">
								{!mode || !current ? (
									<span className="block">Calculating…</span>
								) : (
									(() => {
										const preview = selected ? current : mode.preview;
										return (
											<>
												<span className="block">
													{preview.byMode.map((row) => `${row.profileLabel} ${row.quantity}`).join(" · ") ||
														"Nothing to gather"}
												</span>
												<span className="block">
													{days(preview.days)}
													<Late count={preview.days} limit={daysLeft} />
												</span>
											</>
										);
									})()
								)}
							</span>
						</button>
					);
				})}
			</div>
			<Toggle
				indicator
				className="w-fit"
				checked={dailyHeadroom}
				onChange={settings.setDailyHeadroom}
				title={`Near the daily limit raids spawn far fewer documents. Plans each mode ${DAILY_HEADROOM} below its cap (PVE ${gatheringDailyCap("PVE", DAILY_HEADROOM)}, PVP ${gatheringDailyCap("PVP", DAILY_HEADROOM)}, seasonal ${gatheringDailyCap("seasonal", DAILY_HEADROOM)}). Changes days, not cost.`}
			>
				Leave {DAILY_HEADROOM} unplanned per day
			</Toggle>
		</section>
	);
}

/** Advanced gathering settings: maps to farm, and which modes and documents to gather. */
export function GatheringAdvanced() {
	const { profiles, settings, mapExcluded } = useBattlePassPlanContext();
	const { gatheringFilters } = settings;
	const { documents } = useBattlePassData();
	return (
		<SubDisclosure className="text-sm text-foreground/80" title="Advanced">
			<div className="mb-4">
				<GatheringMapsPicker />
			</div>
			<h5
				className="mb-2 text-sm font-semibold"
				title="Turn off modes or document types you will not gather. Owned documents still count, and claims move to other modes when that costs nothing."
			>
				Modes and documents
			</h5>
			<div className="divide-y divide-border/50">
				{profiles.map((profile) => {
					const filter = gatheringFilters[profile.key] ?? {};
					return (
						<fieldset key={profile.key} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0">
							<legend className="sr-only">{profile.label}</legend>
							<Toggle
								indicator
								className="min-w-28 font-semibold"
								checked={!filter.disabled}
								onChange={(value) => settings.setGatheringChoice(profile.key, value)}
							>
								<span style={{ color: profile.color }}>{profile.label}</span>
							</Toggle>
							{documents.map((doc) => {
								const offMap = mapExcluded.includes(doc.key);
								const on = !filter.disabled && !offMap && !filter.excluded?.includes(doc.key);
								return (
									<button
										key={doc.key}
										type="button"
										aria-pressed={on}
										disabled={filter.disabled || offMap}
										title={offMap ? "Not on your chosen maps" : documentDisplayName(doc.name)}
										onClick={() => settings.setGatheringChoice(profile.key, !on, doc.key)}
										className={cn(
											"inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed",
											on
												? cn(liftedControl, "text-foreground")
												: "border border-transparent bg-transparent text-muted-foreground line-through opacity-60 hover:opacity-90",
										)}
									>
										<DocumentIcon documentKey={doc.key} className={cn("size-5", !on && "grayscale")} />
										{documentDisplayName(doc.name)}
									</button>
								);
							})}
						</fieldset>
					);
				})}
			</div>
		</SubDisclosure>
	);
}
