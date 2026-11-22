import type { ReactNode } from "react";
import { Route as RouteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBattlePassData } from "../BattlePassSeason";
import { documentDisplayName } from "../lib/battle-pass-display";
import type { FlowStep } from "../lib/purchase-flow-model";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { Disclosure } from "./ui/Disclosure";
import { syncValue } from "./ui/field";
import { TarCoin } from "./ui/TarCoin";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const number = (value: number) => value.toLocaleString();
/** Step number, action, then the TarCoin and classified balances; balance columns narrow on phones. */
const timelineGrid =
	"grid grid-cols-[1.25rem_minmax(0,1fr)_3.25rem_3.75rem] items-baseline gap-x-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_4.5rem_4.5rem] sm:gap-x-3";

/** Buy timeline: one row per action, with the TarCoins and classified documents held after it. */
export function StepPlan() {
	const { documents } = useBattlePassData();
	const { flow, flowRoute: route, gathering, funding, claimProfileLabel } = useBattlePassPlanContext();
	if (!route || !funding) return null;
	const point = gathering.selected;
	const cashCents = typeof funding === "string" ? null : funding.plan.cashCents;
	const documentName = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	const claimInfo = (claim: number) => {
		const entry = route.claims[claim - 1];
		const tile = route.selected.find((item) => item.id === entry?.rewardId);
		return { page: entry?.page, name: tile?.displayName ?? "", profile: entry ? claimProfileLabel(entry) : "" };
	};
	const totals = flow?.length ? flowTotals(flow) : null;
	return (
		<Disclosure
			title="Step-by-step plan"
			icon={<RouteIcon className="size-4 text-brand" aria-hidden />}
			syncing={gathering.stale}
			meta={
				totals
					? totals.classifiedBought
						? `Buy ${totals.classifiedBought} classified · ${usd(totals.cashCents)}`
						: totals.cashCents
							? usd(totals.cashCents)
							: "No purchase"
					: point
						? `Gather ${point.gathered}, pay ${usd(point.cashCents)}`
						: cashCents
							? usd(cashCents)
							: null
			}
		>
			<p className="text-xs text-muted-foreground">
				{point
					? `Gather ${point.gathered} documents, then pay ${usd(point.cashCents)}.`
					: cashCents
						? "No gathering: buy every missing document."
						: "No purchase needed."}
				{gathering.breakpoints.length > 0 && " Change this with the gathering target in Route configuration."}
			</p>
			{flow && flow.length === 0 ? (
				<p className="text-xs text-muted-foreground">Nothing left to claim.</p>
			) : flow ? (
				<div className={cn("text-xs", syncValue)}>
					<div className={cn(timelineGrid, "border-b border-border/40 pb-1 text-[11px] text-muted-foreground")}>
						<span />
						<span>Action</span>
						<span className="text-right">TarCoins</span>
						<span className="text-right">Classified</span>
					</div>
					<ol>
						{flow.map((step, index) => (
							<li key={index} className="border-b border-border/20 py-2 last:border-b-0">
								<StepRows
									index={index + 1}
									step={step}
									documentName={documentName}
									claimInfo={claimInfo}
								/>
							</li>
						))}
					</ol>
					{totals && (
						<p className="mt-1 flex flex-wrap items-center gap-x-2 border-t border-border/40 pt-2 font-medium">
							<span>Pay {usd(totals.cashCents)}</span>
							<span aria-hidden>·</span>
							<span>Buy {number(totals.classifiedBought)} classified</span>
							<span aria-hidden>·</span>
							<span className="flex items-center">
								{number(totals.tarCoinsLeft)}
								<TarCoin />
								left
							</span>
							{totals.classifiedLeft > 0 && (
								<>
									<span aria-hidden>·</span>
									<span>{number(totals.classifiedLeft)} classified left</span>
								</>
							)}
						</p>
					)}
				</div>
			) : (
				<p role="status" className="text-xs">
					Could not build a plan for this gathering choice.
				</p>
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

/** One timeline row: step number, action with its detail, then the balances after it. */
function Row({
	index,
	title,
	detail,
	tarCoins,
	classified,
	nested = false,
}: {
	index?: number;
	title: ReactNode;
	detail?: ReactNode;
	tarCoins?: number;
	classified?: number;
	nested?: boolean;
}) {
	return (
		<div
			className={cn(
				timelineGrid,
				nested && "py-0.5 text-muted-foreground",
			)}
		>
			<span className="text-[11px] text-muted-foreground tabular-nums">{index}</span>
			<span className="min-w-0">
				<span className={cn(!nested && "font-semibold text-foreground")}>{title}</span>
				{detail && <span className="block text-muted-foreground sm:ml-2 sm:inline">{detail}</span>}
			</span>
			<span className="text-right tabular-nums">{tarCoins !== undefined && number(tarCoins)}</span>
			<span className="text-right tabular-nums text-classified">{classified !== undefined && number(classified)}</span>
		</div>
	);
}

function StepRows({
	index,
	step,
	documentName,
	claimInfo,
}: {
	index: number;
	step: FlowStep;
	documentName: (key: string) => string;
	claimInfo: (claim: number) => { page?: number; name: string; profile: string };
}) {
	switch (step.kind) {
		case "gather":
			return (
				<Row
					index={index}
					title="Gather documents"
					detail={step.profiles.map((profile) => (
						<span key={profile.profileKey} className="block">
							{profile.profileLabel}:{" "}
							{profile.documents.map((row) => `${row.quantity} ${documentName(row.documentKey)}`).join(", ")}
						</span>
					))}
					tarCoins={step.tarCoins}
					classified={step.classified}
				/>
			);
		case "tarcoins":
			return (
				<Row
					index={index}
					title={step.carryover ? "Buy TarCoins to keep" : "Buy TarCoins"}
					detail={
						<>
							{step.packs.map((pack, packIndex) => (
								<span key={`${pack.tarCoins}:${pack.special}`} className="inline-flex items-center">
									{packIndex > 0 && ", "}
									{pack.count} × {number(pack.tarCoins)}
									<TarCoin />
									{pack.special && "(one-time)"}
								</span>
							))}{" "}
							· <span className="font-medium text-foreground">{usd(step.cashCents)}</span>
							{step.carryover && " · left after the pass"}
						</>
					}
					tarCoins={step.tarCoins}
					classified={step.classified}
				/>
			);
		case "classified":
			return (
				<Row
					index={index}
					title="Buy classified"
					detail={
						<span className="inline-flex flex-wrap items-center">
							{step.packs.map((pack, packIndex) => (
								<span key={pack.documents} className="inline-flex items-center">
									{packIndex > 0 && ", "}
									{pack.count} × {pack.documents}-pack
								</span>
							))}
							<span className="ml-1 inline-flex items-center">
								· −{number(step.packs.reduce((sum, pack) => sum + pack.tarCoins * pack.count, 0))}
								<TarCoin />
							</span>
						</span>
					}
					tarCoins={step.tarCoins}
					classified={step.classified}
				/>
			);
		case "claims":
			return (
				<>
					<Row
						index={index}
						title={step.from === step.to ? `Claim #${step.from}` : `Claim #${step.from}–#${step.to}`}
					/>
					{step.items.map((item) => {
						const info = claimInfo(item.claim);
						return (
							<Row
								key={item.claim}
								nested
								title={
									<span className="text-foreground">
										#{item.claim} {info.page !== undefined && `Pg.${info.page}`} {info.name}
									</span>
								}
								detail={
									<span className="inline-flex flex-wrap items-center">
										{info.profile}
										{item.classifiedSpent > 0 && <> · uses {item.classifiedSpent} classified</>}
										{item.rewardTarCoins > 0 && (
											<span className="inline-flex items-center">
												· +{number(item.rewardTarCoins)}
												<TarCoin />
											</span>
										)}
									</span>
								}
								tarCoins={item.tarCoins}
								classified={item.classified}
							/>
						);
					})}
				</>
			);
	}
}
