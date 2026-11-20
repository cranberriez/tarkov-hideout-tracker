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
const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
/** Mode colour mixed into the raised surface, so a selected card stays opaque and lifted. */
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--surface-raised))`;

/** Marks a day count past the season end. */
function Late({ count, limit }: { count: number; limit: number }) {
	return count > limit ? <span className="text-warning"> · late</span> : null;
}

/** A before → after value, coloured by whether the change helps (lower is better). */
function Change({
	from,
	to,
	format,
	limit = Infinity,
}: {
	from: number;
	to: number;
	format: (value: number) => string;
	/** Values above it are marked late (days past the season end). */
	limit?: number;
}) {
	if (from === to)
		return (
			<span className="text-subtle-foreground">
				No change
				<Late count={to} limit={limit} />
			</span>
		);
	return (
		<span className="tabular-nums">
			<span className="text-muted-foreground">{format(from)} → </span>
			<span className={to < from ? "text-success" : "text-warning"}>{format(to)}</span>
			<Late count={to} limit={limit} />
		</span>
	);
}

/** Preferred gathering mode: claims that need gathering go to this profile
 * whenever that costs nothing. Each card shows what switching to it changes. */
export function ModePreference() {
	const { profiles, gathering, settings, modePreviews, modeCashFree, deadline } = useBattlePassPlanContext();
	const { preferredMode, gatheringFilters, dailyHeadroom } = settings;
	if (profiles.length <= 1) return null;
	const { daysLeft } = deadline;
	const cards = [...profiles, { key: BALANCED_MODE, label: "Balanced", color: "var(--brand)", note: "Spread out" }];
	const current = modePreviews?.current;
	const currentCashFree = modeCashFree?.[0];
	return (
		<section data-syncing={gathering.stale || undefined} className="group/sync w-full space-y-3">
			<div className="space-y-1">
				<h4 className="text-sm font-semibold">Preferred gathering mode</h4>
				<p className="text-xs leading-relaxed text-muted-foreground">
					Pick one. Claims that need gathering go there when it costs nothing extra; Balanced spreads them so the modes
					finish together. Each card shows what changes if you switch
					{modePreviews ? `, gathering ${modePreviews.gathered} documents` : ""}.
				</p>
			</div>
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
					const cashFree = modeIndex >= 0 ? modeCashFree?.[modeIndex + 1] : undefined;
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
								"group flex flex-col justify-start space-y-2 rounded-lg p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-brand",
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
									{selected ? "Current" : off ? "Gathering off" : "note" in profile ? profile.note : null}
								</span>
							</span>
							{!mode || !current ? (
								<span className="block text-muted-foreground">Calculating…</span>
							) : selected ? (
								<span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
									<span className="text-muted-foreground">Gathering</span>
									<span className="text-right tabular-nums">{days(current.days)}</span>
									<span className="text-muted-foreground">Cash-free finish</span>
									<span className="text-right tabular-nums">
										{currentCashFree === undefined ? (
											"…"
										) : currentCashFree === null ? (
											"—"
										) : (
											<>
												{days(currentCashFree)}
												<Late count={currentCashFree} limit={daysLeft} />
											</>
										)}
									</span>
								</span>
							) : (
								<span className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
									<span className="text-muted-foreground">Gathering</span>
									<span className="text-right">
										<Change from={current.days} to={mode.preview.days} format={days} />
									</span>
									<span className="text-muted-foreground">Cash-free finish</span>
									<span className="text-right">
										{cashFree === undefined || currentCashFree === undefined ? (
											"…"
										) : cashFree === null || currentCashFree === null ? (
											<span className="text-subtle-foreground">—</span>
										) : (
											<Change from={currentCashFree} to={cashFree} format={days} limit={daysLeft} />
										)}
									</span>
									<span className="text-muted-foreground">Claims</span>
									<span className={cn("text-right", !mode.moved && "text-subtle-foreground")}>
										{mode.moved ? `${mode.moved} change mode` : "No change"}
									</span>
									<span className="text-muted-foreground">Checkout</span>
									<span className="text-right">
										<Change from={current.cashCents} to={mode.preview.cashCents} format={usd} />
									</span>
								</span>
							)}
						</button>
					);
				})}
			</div>
			<div className="space-y-1">
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
		</section>
	);
}

/** Advanced gathering settings: maps to farm, and which modes and documents to gather. */
export function GatheringAdvanced() {
	const { profiles, settings, mapExcluded } = useBattlePassPlanContext();
	const { gatheringFilters } = settings;
	const { documents } = useBattlePassData();
	return (
		<SubDisclosure className="text-sm text-foreground/80" title="Advanced: maps, modes and documents to gather">
			<div className="mb-4">
				<GatheringMapsPicker />
			</div>
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
		</SubDisclosure>
	);
}
