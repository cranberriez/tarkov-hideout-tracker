import { Circle, CircleCheck } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import { optimizeRouteFunding } from "../lib/funding-model";
import { gatheringDailyCap } from "../lib/gathering-caps";
import { cashFreeGatheringPlan, type SavingsRoute } from "../lib/gathering-savings-model";
import { fundingClaims } from "../lib/route-options-model";
import { useFundingSettings } from "../useFundingSettings";
import { SubDisclosure } from "./ui/Disclosure";
import { DocumentIcon } from "./ui/DocumentIcon";
import { Toggle } from "./ui/Toggle";
import { syncValue } from "./ui/field";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

type Profile = { key: string; label: string; color: string; inventory: Record<string, number> };

/** Preferred gathering mode: claims that need gathering go to this profile
 * whenever that costs nothing. Advanced settings choose where and what to gather. */
export function ModePreference({ profiles, route }: { profiles: Profile[]; route: SavingsRoute | null }) {
	const settings = useFundingSettings();
	const { preferredMode, gatheringFilters, startingTarCoins, allowSpecial } = settings;
	const { documents } = useBattlePassData();
	const plan = useMemo(
		() => (route ? cashFreeGatheringPlan(route, startingTarCoins, gatheringFilters) : null),
		[route, startingTarCoins, gatheringFilters],
	);
	const cash = useMemo(() => {
		if (!route) return null;
		try {
			return optimizeRouteFunding(fundingClaims(route), startingTarCoins, allowSpecial).cashCents;
		} catch {
			return null;
		}
	}, [route, startingTarCoins, allowSpecial]);
	const choose = profiles.length > 1;
	return (
		<div className="w-full space-y-3">
			{choose && (
				<section className="space-y-3 rounded-lg border border-border/60 p-3">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h4 className="text-sm font-medium">Preferred gathering mode</h4>
						<p className="text-xs text-muted-foreground">
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
							const cap = gatheringDailyCap(profile.key);
							const claims = route?.claims.filter((claim) => claim.profileKey === profile.key).length ?? 0;
							const owned = Object.values(profile.inventory).reduce((sum, count) => sum + count, 0);
							// No cash-free plan exists with these settings: nothing meaningful to gather.
							const gather = plan
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
									style={{ backgroundColor: selected ? tint(profile.color, 16) : undefined }}
									className={cn(
										"group space-y-2 rounded-lg p-3 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-brand",
										!selected && "bg-surface-raised/40 hover:bg-surface-raised/80",
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
											{selected ? "Preferred" : off ? "Gathering off" : "Select"}
										</span>
									</span>
									<span className="grid grid-cols-2 gap-x-3 gap-y-1">
										<span className="text-muted-foreground">Daily cap</span>
										<span className="text-right tabular-nums">{cap}</span>
										<span className="text-muted-foreground">Owned</span>
										<span className="text-right tabular-nums">{owned}</span>
										<span className="text-muted-foreground">Claims</span>
										<span className="text-right tabular-nums">{claims}</span>
										<span className="text-muted-foreground">To gather</span>
										<span className="text-right tabular-nums">
											{gather ?? "—"}
											{!!gather && <span className="text-muted-foreground"> ({days(Math.ceil(gather / cap))})</span>}
										</span>
									</span>
								</button>
							);
						})}
					</div>
					<p className={cn("text-xs", syncValue)} aria-live="polite">
						{!route ? (
							<span className="text-muted-foreground">Calculating…</span>
						) : (
							<>
								<strong>
									{plan
										? plan.days === 0
											? "No gathering needed for a cash-free finish"
											: `Cash-free finish in ${days(plan.days)}, gathering ${plan.total} documents`
										: "No cash-free finish with these modes and documents"}
								</strong>
								{cash !== null && cash > 0 && (
									<span className="text-muted-foreground"> · or pay {usd(cash)} without gathering</span>
								)}
							</>
						)}
					</p>
				</section>
			)}
			<section className="rounded-lg border border-border/60 p-3">
				<SubDisclosure title="Advanced: modes and documents to gather">
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
										const on = !filter.disabled && !filter.excluded?.includes(doc.key);
										return (
											<button
												key={doc.key}
												type="button"
												aria-pressed={on}
												disabled={filter.disabled}
												title={documentDisplayName(doc.name)}
												onClick={() => settings.setGatheringChoice(profile.key, !on, doc.key)}
												className={cn(
													"inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed",
													on
														? "bg-surface-raised text-foreground hover:bg-surface-raised/70"
														: "bg-transparent text-muted-foreground line-through opacity-60 hover:opacity-90",
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
			</section>
		</div>
	);
}
