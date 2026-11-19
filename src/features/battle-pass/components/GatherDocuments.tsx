import Link from "next/link";
import { ArrowUpRight, FileSearch } from "lucide-react";
import { MAP_EXPLORER_MAPS, mapExplorerHref } from "@/lib/cfg/map-explorer";
import type { GameMode } from "@/lib/game-mode";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import { DAILY_HEADROOM, gatheringDailyCap } from "../lib/gathering-caps";
import type { GatheringQuantity } from "../lib/gathering-savings-model";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { Disclosure } from "./ui/Disclosure";
import { DocumentIcon } from "./ui/DocumentIcon";
import { Artwork } from "./ui/Artwork";
import { syncValue } from "./ui/field";

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
/** Route profile key (PVP, PVE or a season ID) to the game mode whose maps it raids. */
const profileMode = (key: string): GameMode => (key === "PVP" || key === "PVE" ? key : "KORD");

/** Documents to gather per mode for the gathering target, one column per mode. */
export function GatherDocuments() {
	const { documents, mapNames, mapOrder, mapThumbnails } = useBattlePassData();
	const { profiles, gathering, settings } = useBattlePassPlanContext();
	const reserve = settings.dailyHeadroom ? DAILY_HEADROOM : 0;
	// Without cash breakpoints there is no target to pick, so show the cash-free plan.
	const fallback = gathering.breakpoints.length ? null : gathering.cashFree;
	const rows: GatheringQuantity[] =
		gathering.selected?.quantities ?? [...(fallback?.modes.values() ?? [])].flatMap((mode) => mode.documents);
	const modes = profiles.map((profile) => {
		const docs = rows.filter((row) => row.profileKey === profile.key).sort((a, b) => b.quantity - a.quantity);
		const total = docs.reduce((sum, row) => sum + row.quantity, 0);
		// Maps where this mode's documents spawn, most needed documents first.
		const maps = mapOrder
			.map((map) => ({ map, docs: docs.filter((row) => mapNames[row.documentKey]?.includes(map)) }))
			.filter((entry) => entry.docs.length)
			.map((entry) => ({ ...entry, quantity: entry.docs.reduce((sum, row) => sum + row.quantity, 0) }))
			.sort((a, b) => b.quantity - a.quantity);
		return { ...profile, docs, maps, total, days: Math.ceil(total / gatheringDailyCap(profile.key, reserve)) };
	});
	const name = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	return (
		<Disclosure
			title="Documents to gather"
			icon={<FileSearch className="size-4 text-brand" aria-hidden />}
			syncing={gathering.stale || gathering.calculating}
			meta={
				<span className="flex flex-wrap justify-end gap-x-3">
					{modes.map((mode) => (
						<span key={mode.key}>
							<span style={{ color: mode.color }}>{mode.label}</span>{" "}
							<strong className="tabular-nums text-foreground">{mode.total}</strong>
						</span>
					))}
				</span>
			}
		>
			<div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", syncValue)}>
				{modes.map((mode) => (
					<section key={mode.key} className="space-y-3 rounded-lg border border-border/60 p-3">
						<header className="flex items-baseline justify-between gap-2">
							<h4 className="text-sm font-semibold" style={{ color: mode.color }}>
								{mode.label}
							</h4>
							<span className="text-xs text-muted-foreground">
								<strong className="text-base tabular-nums text-foreground">{mode.total}</strong>
								{mode.total > 0 && <> · {days(mode.days)}</>}
							</span>
						</header>
						{mode.docs.length ? (
							<ul className="space-y-2">
								{mode.docs.map((row) => (
									<li key={row.documentKey} className="flex items-center gap-3">
										<DocumentIcon documentKey={row.documentKey} className="size-9 shrink-0" />
										<strong className="w-7 text-right text-lg tabular-nums">{row.quantity}</strong>
										<span className="text-sm">{name(row.documentKey)}</span>
									</li>
								))}
							</ul>
						) : (
							<p className="text-xs text-muted-foreground">Nothing to gather</p>
						)}
						{mode.maps.length > 0 && (
							<div className="space-y-2 border-t border-border/60 pt-3">
								<h5 className="text-xs font-medium text-muted-foreground">Where to find them</h5>
								<ul className="space-y-1">
									{mode.maps.map(({ map, docs }) => {
										const explorer = MAP_EXPLORER_MAPS.find((entry) => entry.name === map);
										const body = (
											<>
												<Artwork
													src={mapThumbnails[map.toLowerCase().replaceAll(" ", "-")] ?? ""}
													className="size-9 shrink-0 rounded object-cover"
												/>
												<span className="min-w-0 flex-1 truncate text-sm font-medium">{map}</span>
												<span className="flex shrink-0 items-center gap-0.5">
													{docs.map((row) => (
														<span key={row.documentKey} title={name(row.documentKey)}>
															<DocumentIcon documentKey={row.documentKey} className="size-6" />
															<span className="sr-only">{name(row.documentKey)}</span>
														</span>
													))}
												</span>
												{explorer && (
													<ArrowUpRight
														className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/map:text-brand"
														aria-hidden
													/>
												)}
											</>
										);
										return (
											<li key={map}>
												{explorer ? (
													<Link
														href={mapExplorerHref(profileMode(mode.key), explorer.key, "documents")}
														prefetch={false}
														className="group/map -mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-brand"
													>
														{body}
													</Link>
												) : (
													<div className="flex items-center gap-2.5 py-1">{body}</div>
												)}
											</li>
										);
									})}
								</ul>
							</div>
						)}
					</section>
				))}
			</div>
		</Disclosure>
	);
}
