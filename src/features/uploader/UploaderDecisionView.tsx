"use client";

/* eslint-disable @next/next/no-img-element -- Catalog previews. */
import { FilterRadioGroup } from "@/components/ui/filter-bar";
import { itemImageUrl } from "@/lib/utils/item-images";
import { formatRoubles } from "@/lib/utils/market-price";
import { cn } from "@/lib/utils";
import type { ReviewEntry } from "./review-model";
import type { SaveReason } from "./summary-model";
import type { SentCounts } from "./inventory-model";
import type { useUploaderSummary } from "./useUploaderSummary";
import type { DecisionFilter, useUploaderDecisions } from "./useUploaderDecisions";
import { DecisionMarker, appearanceFor, decisionAppearance, kappaAppearance } from "./DecisionMarker";
import { UploaderItemPrice } from "./UploaderItemPrice";
import { UploaderInventoryActions } from "./UploaderInventoryActions";
import { UploaderSidebarHeader, sectionLabel } from "./UploaderSidebarHeader";
import { foundInRaidLabel } from "./found-in-raid";
import { bestSellOffer, type ItemAction } from "./decision-model";
import type { CurrentPrice } from "@/types/prices";
import { traderImageUrl, traderInfo } from "@/lib/data/traders";
import { useKappaStore } from "@/lib/stores/useKappaStore";

const ACTIONS = ["KEEP", "SELL", "HOLD"] as const;
const tile = "rounded bg-shadow/30 p-2";

/** Sort-step contents of the review sidebar; the screenshot itself is the item list. */
export function UploaderDecisionView({
	data,
	decisions,
	extras,
	sent,
	kappaSent,
	onSent,
	onSetFir,
}: {
	data: ReturnType<typeof useUploaderSummary>;
	decisions: ReturnType<typeof useUploaderDecisions>;
	/** Manual additions, which have no box on the screenshot. */
	extras: readonly ReviewEntry[];
	sent: SentCounts;
	kappaSent: readonly string[];
	onSent: Parameters<typeof UploaderInventoryActions>[0]["onSent"];
	onSetFir: () => void;
}) {
	const { summary, prices, error, retry, loading } = data;
	const { counts, values, filter, setFilter, activeKey, select, groups } = decisions;
	const active = activeKey ? groups.get(activeKey) : undefined;
	const ignoreKappa = useKappaStore((state) => state.ignoreInUploader);
	const setIgnoreKappa = useKappaStore((state) => state.setIgnoreInUploader);
	const notices = [
		!!summary?.unresolved && "Some entries have missing data or invalid quantities. Return to review to fix them.",
	].filter(Boolean);
	return (
		<div aria-label="Sort scanned items" className="flex min-h-full flex-col gap-4">
			<UploaderSidebarHeader
				step={2}
				title="Sort your loot"
				detail={
					error
						? "Requirements unavailable"
						: decisions.loading
							? "Checking your hideout and quests…"
							: `${counts.KEEP} keep · ${counts.SELL} sell · ${counts.HOLD} hold`
				}
			/>
			{error ? (
				<p role="alert" className="rounded-sm bg-danger/10 px-3 py-2 text-xs text-danger">
					Hideout and quest requirements couldn&apos;t load, so nothing can be sorted.{" "}
					<button disabled={loading} onClick={() => void retry()} className="underline">
						Retry
					</button>
				</p>
			) : (
				<>
					<FilterRadioGroup<DecisionFilter>
						label="Show items"
						value={filter}
						onValueChange={setFilter}
						options={(["ALL", ...ACTIONS] as const).map((value) => ({
							value,
							label: value === "ALL" ? "All" : decisionAppearance[value].label,
							icon: (
								<span className="flex items-baseline gap-1">
									{value === "ALL" ? "All" : decisionAppearance[value].label}
									<span className="text-[10px] tabular-nums opacity-70">{counts[value]}</span>
								</span>
							),
						}))}
					/>
					<div className="grid grid-cols-3 gap-2">
						<Stat label="Keep" value={String(counts.KEEP)} detail="for your needs" action="KEEP" />
						<Stat label="Sell" value={compactRoubles(values.SELL)} detail="best offers" action="SELL" />
						<Stat label="Hold" value={compactRoubles(values.HOLD)} detail="price low" action="HOLD" />
					</div>
					<button
						role="switch"
						aria-checked={ignoreKappa}
						onClick={() => setIgnoreKappa(!ignoreKappa)}
						title="Stop keeping copies for the Collector's Kappa hand-ins"
						className="flex w-full items-center justify-between gap-2 rounded-sm border border-border-color px-3 py-2 text-xs text-foreground hover:bg-surface-raised"
					>
						Ignore Kappa items
						<span
							className={cn(
								"flex h-4 w-7 shrink-0 rounded-full p-0.5",
								ignoreKappa ? "justify-end bg-special" : "justify-start bg-surface-raised",
							)}
						>
							<span className="h-3 w-3 rounded-full bg-foreground" />
						</span>
					</button>
				</>
			)}
			{(notices.length > 0 || prices.state === "error") && (
				<div className="space-y-1 text-[11px] text-warning">
					{notices.map((notice) => (
						<p key={String(notice)}>{notice}</p>
					))}
					{prices.state === "error" && (
						<p role="alert">
							Some prices failed, so those items default to Sell.{" "}
							<button disabled={prices.fetching} onClick={() => void prices.refresh()} className="underline">
								Retry prices
							</button>
						</p>
					)}
				</div>
			)}
			{extras.length > 0 && !error && (
				<section>
					<h2 className={cn(sectionLabel, "mb-1.5")}>Added manually</h2>
					<div className="flex flex-wrap gap-1.5">
						{extras.map((entry, index) => {
							const decision = decisions.decisionFor(entry);
							if (!decision || !entry.itemId) return null;
							const item = summary?.rows.find((row) => row.item.id === entry.itemId)?.item;
							const dimmed = filter !== "ALL" && filter !== decision.action;
							return (
								<button
									key={index}
									onClick={() => select(decision.key)}
									aria-pressed={activeKey === decision.key}
									title={item?.name}
									className={cn(
										"relative size-10 rounded-sm border border-highlight/10 p-1 transition-opacity",
										appearanceFor(decision.action, decision.kappa).overlay,
										activeKey === decision.key && "ring-2 ring-foreground",
										dimmed && "opacity-25",
									)}
								>
									{item && <img src={itemImageUrl(item)} alt={item.name} className="size-full object-contain" />}
									<span className="absolute -left-1 -top-1">
										<DecisionMarker action={decision.action} pending={decision.pending} kappa={decision.kappa} />
									</span>
								</button>
							);
						})}
					</div>
				</section>
			)}
			{!error && (
				<section aria-label="Selected item" className="rounded-md border border-highlight/10 bg-shadow/20 p-3">
					{active ? (
						<Inspector rows={active} data={data} decisions={decisions} />
					) : (
						<p className="py-4 text-center text-xs text-muted-foreground">
							{decisions.loading ? "Sorting…" : "Select an item on the screenshot to see why."}
						</p>
					)}
				</section>
			)}
			<div className="-mx-4 mt-auto border-t border-border-color px-4 py-3">
				<UploaderInventoryActions
					rows={summary?.rows ?? []}
					sent={sent}
					kappaSent={kappaSent}
					onSent={onSent}
					onSetFir={onSetFir}
					disabled={!summary || !!error || summary.unresolved > 0}
				/>
			</div>
		</div>
	);
}

function compactRoubles(value: number) {
	if (!value) return "—";
	return value >= 1_000_000
		? `₽${(value / 1_000_000).toFixed(1)}M`
		: value >= 1_000
			? `₽${Math.round(value / 1_000)}k`
			: formatRoubles(Math.round(value));
}

function Stat({ label, value, detail, action }: { label: string; value: string; detail: string; action: ItemAction }) {
	return (
		<div className={tile}>
			<p className={cn("text-[10px] font-bold uppercase tracking-wide", decisionAppearance[action].ink)}>{label}</p>
			<p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{value}</p>
			<p className="text-[10px] text-subtle-foreground">{detail}</p>
		</div>
	);
}

function Inspector({
	rows,
	data,
	decisions,
}: {
	rows: NonNullable<ReturnType<ReturnType<typeof useUploaderDecisions>["groups"]["get"]>>;
	data: ReturnType<typeof useUploaderSummary>;
	decisions: ReturnType<typeof useUploaderDecisions>;
}) {
	const { item, foundInRaid } = rows[0];
	const need = data.summary?.needs.get(item.id);
	const surplus = decisions.surplusFor(item.id);
	const split = new Map<ItemAction, number>();
	let forKappa = 0;
	for (const row of rows) {
		if (row.kappa) forKappa += row.quantity;
		else {
			const action = row.category === "keep" ? "KEEP" : (surplus?.action ?? "SELL");
			split.set(action, (split.get(action) ?? 0) + row.quantity);
		}
	}
	const reasons = need?.reasons ?? [];
	const kept = (split.get("KEEP") ?? 0) + forKappa;
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-3">
				<img src={itemImageUrl(item)} alt="" className="size-12 shrink-0 rounded-sm bg-shadow/40 object-contain p-1" />
				<div className="min-w-0 flex-1">
					<h2 className="text-sm font-bold leading-tight text-foreground">{item.name}</h2>
					<p className={cn("mt-0.5 text-[11px]", foundInRaid === "yes" ? "text-fir" : "text-muted-foreground")}>
						{foundInRaidLabel(foundInRaid)}
					</p>
				</div>
			</div>
			<div className="space-y-2">
				{forKappa > 0 && (
					<span
						className={cn(
							"inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
							kappaAppearance.chip,
						)}
					>
						<kappaAppearance.Icon size={12} aria-hidden="true" />
						{kappaAppearance.label} ×{forKappa}
					</span>
				)}
				{ACTIONS.filter((action) => split.has(action)).map((action) => (
					<div key={action}>
						<span
							className={cn(
								"inline-block rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
								decisionAppearance[action].chip,
							)}
						>
							{decisionAppearance[action].label} ×{split.get(action)}
						</span>
						{action !== "KEEP" && <SellAt price={data.prices.prices[item.id]} />}
					</div>
				))}
			</div>
			<div className="space-y-1.5 text-xs leading-relaxed text-foreground/80">
				{need && need.required > 0 && (
					<p>
						Needs {need.required} · you own {need.owned} ·{" "}
						{need.remaining > 0 ? `${need.remaining} still missing before this scan` : "already covered"}
					</p>
				)}
				{forKappa > 0 && (
					<p>
						Reserved for Kappa. Adding kept items checks {forKappa === 1 ? "it" : "them"} off on the Kappa checklist
						instead of your inventory.
					</p>
				)}
				{kept > 0 && rows.some((row) => row.firUnconfirmed) && (
					<p className="text-warning">Kept in case it&apos;s FIR. Use Set FIR to confirm.</p>
				)}
				{surplus && split.size > (split.has("KEEP") ? 1 : 0) && (
					<p>
						{!need?.required
							? "No hideout or quest needs this item."
							: need.remaining > 0 && foundInRaid !== "yes"
								? "What's still needed must be found in raid, so these copies don't count."
								: kept > 0
									? "The other copies cover what's still needed."
									: "What you own already covers what's needed."}{" "}
						{surplus.why}
					</p>
				)}
			</div>
			{reasons.length > 0 && (
				<section>
					<h3 className={cn(sectionLabel, "mb-1")}>Used for</h3>
					<ul className="space-y-1">
						{reasons.slice(0, 6).map((reason) => (
							<Use key={`${reason.kind}:${reason.id}`} reason={reason} />
						))}
					</ul>
					{reasons.length > 6 && (
						<details className="mt-1">
							<summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
								{reasons.length - 6} more
							</summary>
							<ul className="mt-1 space-y-1">
								{reasons.slice(6).map((reason) => (
									<Use key={`${reason.kind}:${reason.id}`} reason={reason} />
								))}
							</ul>
						</details>
					)}
				</section>
			)}
			<section className="border-t border-highlight/10 pt-2">
				<h3 className={sectionLabel}>Other prices</h3>
				<UploaderItemPrice
					price={data.prices.prices[item.id]}
					state={data.prices.states[item.id]}
					quantity={rows.reduce((total, row) => total + row.quantity, 0)}
				/>
			</section>
		</div>
	);
}

function SellAt({ price }: { price: CurrentPrice | undefined }) {
	const offer = bestSellOffer(price);
	if (!offer) return <p className="mt-1 text-xs text-muted-foreground">No sell price available</p>;
	return (
		<p className="mt-1.5 flex items-center justify-between gap-3 text-lg font-bold leading-tight">
			<span className="flex min-w-0 items-center gap-2 text-foreground">
				{offer.venue === "trader" && (
					<img
						src={traderImageUrl(offer.traderId!)}
						alt=""
						className="size-7 shrink-0 rounded-full bg-shadow/40 object-cover"
					/>
				)}
				<span className="truncate">{offer.venue === "flea" ? "Flea market" : traderInfo(offer.traderId!).name}</span>
			</span>
			<span className="shrink-0 font-mono tabular-nums text-acquisition-sell-value">
				{formatRoubles(Math.round(offer.unit))}
			</span>
		</p>
	);
}

function Use({ reason }: { reason: SaveReason }) {
	return (
		<li className="flex items-baseline justify-between gap-2 text-xs">
			<span className={cn("min-w-0", reason.kind === "kappa" ? kappaAppearance.ink : "text-foreground")}>
				{reason.label}
				<span className="ml-1.5 text-[11px] text-muted-foreground">
					{reason.options
						? `${reason.filled} of ${reason.count} · any of ${reason.options}`
						: `×${reason.count}${reason.tool ? " · tool" : ""}`}
					{reason.firCount > 0 && <span className="text-fir"> · FIR</span>}
				</span>
			</span>
			<span
				className={cn(
					"shrink-0 text-[10px] font-semibold uppercase tracking-wide",
					reason.now ? "text-brand" : "text-subtle-foreground",
				)}
			>
				{reason.now ? "Now" : reason.minPlayerLevel ? `Lvl ${reason.minPlayerLevel}` : "Later"}
			</span>
		</li>
	);
}
