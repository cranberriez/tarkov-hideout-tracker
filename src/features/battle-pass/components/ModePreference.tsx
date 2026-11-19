import { Circle, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import { DAILY_HEADROOM, gatheringDailyCap } from "../lib/gathering-caps";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { SubDisclosure } from "./ui/Disclosure";
import { DocumentIcon } from "./ui/DocumentIcon";
import { Toggle } from "./ui/Toggle";
import { liftedControl, syncValue } from "./ui/field";

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
/** Mode colour mixed into the raised surface, so a selected card stays opaque and lifted. */
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--surface-raised))`;

/** Preferred gathering mode: claims that need gathering go to this profile
 * whenever that costs nothing. */
export function ModePreference() {
	const { profiles, route, gathering, settings } = useBattlePassPlanContext();
	const { preferredMode, gatheringFilters, dailyHeadroom } = settings;
	const reserve = dailyHeadroom ? DAILY_HEADROOM : 0;
	const plan = gathering.cashFree;
	if (profiles.length <= 1) return null;
	return (
		<section data-syncing={gathering.stale || undefined} className="group/sync w-full space-y-3">
			<div className="space-y-1">
				<h4 className="text-sm font-semibold">Preferred gathering mode</h4>
				<p className="text-xs leading-relaxed text-muted-foreground">
					Pick one. Claims that need gathering go there when it costs nothing extra.
				</p>
			</div>
			<div
				className={cn("grid gap-2 sm:grid-cols-3", syncValue)}
				role="radiogroup"
				aria-label="Preferred gathering mode"
			>
				{profiles.map((profile) => {
					const selected = preferredMode === profile.key;
					const off = !!gatheringFilters[profile.key]?.disabled;
					const cap = gatheringDailyCap(profile.key, reserve);
					const claims = route?.claims.filter((claim) => claim.profileKey === profile.key).length ?? 0;
					const owned = Object.values(profile.inventory).reduce((sum, count) => sum + count, 0);
					// No cash-free plan exists with these settings: nothing meaningful to gather.
					// The gathering target decides how much each mode gathers; without
					// breakpoints (nothing to buy), fall back to the cash-free plan.
					const modeWindow = gathering.selected?.windows.find((row) => row.profileKey === profile.key);
					const gather = gathering.breakpoints.length
						? (modeWindow?.quantity ?? 0)
						: plan
							? (plan.modes.get(profile.key)?.documents.reduce((sum, row) => sum + row.quantity, 0) ?? 0)
							: null;
					const Check = selected ? CircleCheck : Circle;
					return (
						<button
							key={profile.key}
							type="button"
							role="radio"
							aria-checked={selected}
							onClick={() => settings.setPreferredMode(selected ? null : profile.key)}
							style={selected ? { backgroundColor: tint(profile.color, 14) } : undefined}
							className={cn(
								"group space-y-2 rounded-lg p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-brand",
								liftedControl,
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
								<span className="ml-auto text-[11px] text-muted-foreground">
									{selected ? "Preferred" : off ? "Gathering off" : null}
								</span>
							</span>
							<span className="grid grid-cols-2 gap-x-3 gap-y-1.5">
								<span className="text-muted-foreground">{dailyHeadroom ? "Planned per day" : "Daily cap"}</span>
								<span className="text-right tabular-nums">{cap}</span>
								<span className="text-muted-foreground">Owned</span>
								<span className={cn("text-right tabular-nums", !owned && "text-subtle-foreground")}>{owned}</span>
								<span className="text-muted-foreground">Claims</span>
								<span className={cn("text-right tabular-nums", !claims && "text-subtle-foreground")}>{claims}</span>
								<span className="text-muted-foreground">To gather</span>
								<span className={cn("text-right tabular-nums", !gather && "text-subtle-foreground")}>
									{gather ?? "—"}
									{!!gather && <span className="text-muted-foreground"> ({days(Math.ceil(gather / cap))})</span>}
								</span>
							</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}

/** Advanced gathering settings: which modes and documents to gather, and daily headroom. */
export function GatheringAdvanced() {
	const { profiles, settings, mapExcluded } = useBattlePassPlanContext();
	const { gatheringFilters, dailyHeadroom } = settings;
	const { documents } = useBattlePassData();
	return (
		<SubDisclosure className="text-sm text-foreground/80" title="Advanced: modes and documents to gather">
			<h5 className="mb-1 text-xs font-semibold">Modes and documents</h5>
			<p className="mb-3 text-xs text-muted-foreground">
				Turn off modes or document types you will not gather. Owned documents still count, and claims move to other
				modes when that costs nothing. Saved on this device.
			</p>
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
			<div className="mt-3 space-y-1 border-t border-border/50 pt-3">
				<h5 className="text-xs font-semibold">Daily headroom</h5>
				<Toggle indicator className="w-fit" checked={dailyHeadroom} onChange={settings.setDailyHeadroom}>
					Leave {DAILY_HEADROOM} unplanned per day
				</Toggle>
				<p className="text-xs text-muted-foreground">
					Near the daily limit, raids spawn far fewer documents, so the last few are slow to find. This plans each mode{" "}
					{DAILY_HEADROOM} below its cap (PVE {gatheringDailyCap("PVE", DAILY_HEADROOM)}, PVP{" "}
					{gatheringDailyCap("PVP", DAILY_HEADROOM)}, seasonal {gatheringDailyCap("seasonal", DAILY_HEADROOM)}). Only
					the days change, not the cost.
				</p>
			</div>
		</SubDisclosure>
	);
}
