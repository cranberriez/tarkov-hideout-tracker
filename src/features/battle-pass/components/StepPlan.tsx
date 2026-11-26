import type { ReactNode } from "react";
import { ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import type { GatheringQuantity } from "../lib/gathering-savings-model";
import type { FlowClaim, FlowStep } from "../lib/purchase-flow-model";
import { useBattlePassPlanContext, type PlannedRoute } from "../useBattlePassPlan";
import { DocumentIcon } from "./ui/DocumentIcon";
import { Disclosure } from "./ui/Disclosure";
import { syncValue } from "./ui/field";
import { TarCoin } from "./ui/TarCoin";

type Route = NonNullable<PlannedRoute>;

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const number = (value: number) => value.toLocaleString();
/** Action, then the TarCoin and classified balances; balance columns narrow on phones. */
const timelineGrid =
	"grid grid-cols-[minmax(0,1fr)_3.25rem_3.75rem] gap-x-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] sm:gap-x-3";
const chip = "inline-flex items-center gap-1 rounded bg-surface-raised/70 px-1.5 py-0.5 tabular-nums";

/** The plan: claim order and buy timeline in one, with the TarCoins and classified documents held after each step. */
export function StepPlan({ mostRewardsNow = false }: { mostRewardsNow?: boolean }) {
	const { documents } = useBattlePassData();
	const { flow, flowRoute: route, gathering, funding, claimProfileLabel } = useBattlePassPlanContext();
	if (!route) return null;
	const point = gathering.selected;
	const cashCents = funding && typeof funding === "object" ? funding.plan.cashCents : null;
	const documentName = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	const totals = flow?.length ? flowTotals(flow) : null;
	const rewards = `${route.claims.length} ${route.claims.length === 1 ? "reward" : "rewards"}`;
	const purchase = totals
		? totals.classifiedBought
			? `buy ${totals.classifiedBought} classified · ${usd(totals.cashCents)}`
			: totals.cashCents
				? usd(totals.cashCents)
				: "no purchase"
		: null;
	return (
		<Disclosure
			title="Plan"
			icon={<ListOrdered className="size-4 text-brand" aria-hidden />}
			syncing={gathering.stale}
			meta={
				route.claims.length ? (
					<>
						{rewards}, {route.possibleNow} ready now{purchase && <> · {purchase}</>}
					</>
				) : null
			}
		>
			{route.claims.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{mostRewardsNow
						? "No further rewards are affordable with the selected inventories."
						: "Destination already reached."}
				</p>
			) : (
				<>
					<p className="text-xs text-muted-foreground">
						{point && gathering.purchases !== "cash"
							? `Gather ${point.gathered} documents${gathering.purchases === "none" ? "; buying is off." : "; TarCoins are not bought."}`
							: point
								? `Gather ${point.gathered} documents, then pay ${usd(point.cashCents)}.`
								: cashCents
									? "No gathering: buy every missing document."
									: "No purchase needed."}
						{gathering.breakpoints.length > 0 && " Change this with the gathering target in Route configuration."}
					</p>
					{totals && (
						<div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", syncValue)}>
							<Tile label="Pay" value={usd(totals.cashCents)} />
							<Tile label="Classified to buy" value={number(totals.classifiedBought)} classified />
							<Tile
								label="TarCoins left"
								value={
									<span className="inline-flex items-center">
										{number(totals.tarCoinsLeft)}
										<TarCoin />
									</span>
								}
							/>
							<Tile label="Classified left" value={number(totals.classifiedLeft)} classified />
						</div>
					)}
					{flow ? (
						<div className={cn("text-xs", syncValue)}>
							<div className={cn(timelineGrid, "border-b border-border/40 pb-1 text-[11px] text-muted-foreground")}>
								<span>Step</span>
								<span className="text-right">TarCoins</span>
								<span className="text-right">Classified</span>
							</div>
							<ol>
								{flow.map((step, index) => (
									<li key={index} className="border-b border-border/20 py-2.5 last:border-b-0">
										<StepRows step={step} route={route} documentName={documentName} profile={claimProfileLabel} />
									</li>
								))}
							</ol>
						</div>
					) : (
						<>
							<p role="status" className="text-xs">
								Could not build a purchase plan for this gathering choice. The claim order is below.
							</p>
							<ol className="text-xs">
								{route.claims.map((_, index) => (
									<li key={index}>
										<ClaimCard
											claim={index + 1}
											route={route}
											documentName={documentName}
											profile={claimProfileLabel}
										/>
									</li>
								))}
							</ol>
						</>
					)}
				</>
			)}
		</Disclosure>
	);
}

function flowTotals(flow: FlowStep[]) {
	const last = flow.at(-1)!;
	return {
		cashCents: flow.reduce((sum, step) => sum + (step.kind === "tarcoins" ? step.cashCents : 0), 0),
		classifiedBought: flow.reduce(
			(sum, step) =>
				sum +
				(step.kind === "classified" ? step.packs.reduce((total, pack) => total + pack.documents * pack.count, 0) : 0),
			0,
		),
		tarCoinsLeft: last.tarCoins,
		classifiedLeft: last.classified,
	};
}

function Tile({ label, value, classified = false }: { label: string; value: ReactNode; classified?: boolean }) {
	return (
		<div className="min-w-0 rounded-md bg-surface-raised/40 px-3 py-2">
			<div className={cn("text-lg font-semibold tabular-nums leading-tight", classified && "text-classified")}>
				{value}
			</div>
			<div className="text-[11px] text-muted-foreground">{label}</div>
		</div>
	);
}

/** One timeline row: title with its detail, then the balances after it. */
function Row({
	title,
	children,
	tarCoins,
	classified,
}: {
	title: ReactNode;
	children?: ReactNode;
	tarCoins?: number;
	classified?: number;
}) {
	return (
		<div className={cn(timelineGrid, "items-start")}>
			<div className="min-w-0 space-y-1">
				<p className="font-semibold text-foreground">{title}</p>
				{children}
			</div>
			<span className="text-right tabular-nums">{tarCoins !== undefined && number(tarCoins)}</span>
			<span className="text-right tabular-nums text-classified">{classified !== undefined && number(classified)}</span>
		</div>
	);
}

function DocumentCounts({ rows, documentName }: { rows: GatheringQuantity[]; documentName: (key: string) => string }) {
	return (
		<span className="flex flex-wrap gap-1">
			{rows.map((row) => (
				<span key={row.documentKey} className={chip} title={documentName(row.documentKey)}>
					<DocumentIcon documentKey={row.documentKey} className="size-4" />
					{row.quantity}
				</span>
			))}
		</span>
	);
}

function StepRows({
	step,
	route,
	documentName,
	profile,
}: {
	step: FlowStep;
	route: Route;
	documentName: (key: string) => string;
	profile: (claim: Route["claims"][number]) => string;
}) {
	switch (step.kind) {
		case "gather":
			return (
				<Row title="Gather documents" tarCoins={step.tarCoins} classified={step.classified}>
					{step.profiles.map((entry) => (
						<div key={entry.profileKey} className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span className="text-muted-foreground">{entry.profileLabel}</span>
							<DocumentCounts rows={entry.documents} documentName={documentName} />
						</div>
					))}
				</Row>
			);
		case "tarcoins":
			return (
				<Row
					title={step.carryover ? "Buy TarCoins to keep" : "Buy TarCoins"}
					tarCoins={step.tarCoins}
					classified={step.classified}
				>
					<div className="flex flex-wrap items-center gap-1">
						{step.packs.map((pack) => (
							<span key={`${pack.tarCoins}:${pack.special}`} className={chip}>
								{pack.count} × {number(pack.tarCoins)}
								<TarCoin />
								{pack.special && <span className="text-muted-foreground">one-time</span>}
							</span>
						))}
						<span className="ml-1 font-semibold text-foreground">{usd(step.cashCents)}</span>
					</div>
					{step.carryover && <p className="text-muted-foreground">Part of the purchase, left after the pass.</p>}
				</Row>
			);
		case "classified":
			return (
				<Row title="Buy classified" tarCoins={step.tarCoins} classified={step.classified}>
					<div className="flex flex-wrap items-center gap-1">
						{step.packs.map((pack) => (
							<span key={pack.documents} className={cn(chip, "text-classified")}>
								{pack.count} × {pack.documents}-pack
							</span>
						))}
						<span className="ml-1 inline-flex items-center text-muted-foreground">
							−{number(step.packs.reduce((sum, pack) => sum + pack.tarCoins * pack.count, 0))}
							<TarCoin />
						</span>
					</div>
				</Row>
			);
		case "claims":
			return (
				<div className="space-y-1">
					<Row title={step.from === step.to ? `Claim #${step.from}` : `Claim #${step.from}–#${step.to}`} />
					<ol>
						{step.items.map((item) => (
							<li key={item.claim}>
								<ClaimCard claim={item.claim} item={item} route={route} documentName={documentName} profile={profile} />
							</li>
						))}
					</ol>
				</div>
			);
	}
}

/** One claim: reward, profile and status, then each document type as owned (+ gathered) of needed. */
function ClaimCard({
	claim,
	item,
	route,
	documentName,
	profile,
}: {
	claim: number;
	item?: FlowClaim;
	route: Route;
	documentName: (key: string) => string;
	profile: (claim: Route["claims"][number]) => string;
}) {
	const entry = route.claims[claim - 1];
	if (!entry) return null;
	const tile = route.selected.find((reward) => reward.id === entry.rewardId);
	const gathered = (key: string) =>
		item?.gathered.reduce((sum, row) => sum + (row.documentKey === key ? row.quantity : 0), 0) ?? 0;
	const classified = item ? item.classifiedSpent : entry.classifiedUsed + entry.additionalClassified;
	return (
		<div className={cn(timelineGrid, "items-start gap-y-1 py-1.5 pl-3")}>
			<p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
				<span className="font-medium text-foreground">
					<span className="text-muted-foreground tabular-nums">#{claim}</span> {tile?.displayName}
				</span>
				<span className="text-muted-foreground">
					Pg.{entry.page} · {profile(entry)}
				</span>
				{entry.possibleNow && <span className="text-success">Ready now</span>}
			</p>
			<span className="text-right tabular-nums">{item && number(item.tarCoins)}</span>
			<span className="text-right tabular-nums text-classified">{item && number(item.classified)}</span>
			{/* Document chips span the balance columns so they do not wrap into a narrow column on phones. */}
			<span className="col-span-3 flex flex-wrap gap-1">
				{Object.entries(entry.cost).map(([key, amount]) => {
					const owned = entry.ordinaryUsed[key] ?? 0;
					const extra = gathered(key);
					return (
						<span
							key={key}
							className={chip}
							title={documentName(key)}
							aria-label={`${documentName(key)}: ${owned} owned${extra ? `, ${extra} gathered` : ""} of ${amount}`}
						>
							<DocumentIcon documentKey={key} className="size-4" />
							<span>
								<span className="font-semibold text-foreground">{owned}</span>
								{extra > 0 && <span className="font-semibold text-brand">+{extra}</span>}
								<span className="text-muted-foreground">/{amount}</span>
							</span>
						</span>
					);
				})}
				{classified > 0 && <span className={cn(chip, "text-classified")}>{classified} classified</span>}
				{item && item.rewardTarCoins > 0 && (
					<span className={chip}>
						+{number(item.rewardTarCoins)}
						<TarCoin />
					</span>
				)}
			</span>
		</div>
	);
}
