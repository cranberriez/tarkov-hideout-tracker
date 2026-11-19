import { ChevronRight, Route as RouteIcon } from "lucide-react";
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

/** A left-to-right plan: gather, buy TarCoins, then alternate classified purchases and claims. */
export function StepPlan() {
	const { documents } = useBattlePassData();
	const { flow, flowRoute: route, gathering, funding } = useBattlePassPlanContext();
	if (!route || !funding) return null;
	const point = gathering.selected;
	const cashCents = typeof funding === "string" ? null : funding.plan.cashCents;
	const documentName = (key: string) => documentDisplayName(documents.find((doc) => doc.key === key)?.name ?? key);
	const rewardName = (claim: number) => {
		const id = route.claims[claim - 1]?.rewardId;
		return route.selected.find((tile) => tile.id === id)?.displayName ?? "";
	};
	return (
		<Disclosure
			title="Step-by-step plan"
			icon={<RouteIcon className="size-4 text-brand" aria-hidden />}
			syncing={gathering.stale}
			meta={point ? `Gather ${point.gathered}, pay ${usd(point.cashCents)}` : cashCents ? usd(cashCents) : null}
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
				<ol className={cn("flex items-stretch gap-1 overflow-x-auto pb-2", syncValue)}>
					{flow.map((step, index) => (
						<li key={index} className="flex shrink-0 items-stretch gap-1">
							{index > 0 && <ChevronRight className="size-4 self-center text-muted-foreground" aria-hidden />}
							<div className="w-48 space-y-1 rounded-md bg-surface-raised/40 p-3 text-xs">
								<p className="text-[11px] text-muted-foreground">Step {index + 1}</p>
								<StepBody step={step} documentName={documentName} rewardName={rewardName} />
							</div>
						</li>
					))}
				</ol>
			) : (
				<p role="status" className="text-xs">
					Could not build a plan for this gathering choice.
				</p>
			)}
		</Disclosure>
	);
}

function StepBody({
	step,
	documentName,
	rewardName,
}: {
	step: FlowStep;
	documentName: (key: string) => string;
	rewardName: (claim: number) => string;
}) {
	switch (step.kind) {
		case "gather":
			return (
				<>
					<p className="text-sm font-semibold">Gather documents</p>
					{step.profiles.map((profile) => (
						<div key={profile.profileKey}>
							<p className="font-medium">{profile.profileLabel}</p>
							<ul className="text-muted-foreground">
								{profile.documents.map((row) => (
									<li key={row.documentKey}>
										{row.quantity} {documentName(row.documentKey)}
									</li>
								))}
							</ul>
						</div>
					))}
				</>
			);
		case "tarcoins":
			return (
				<>
					<p className="text-sm font-semibold">{step.carryover ? "Buy TarCoins to keep" : "Buy TarCoins"}</p>
					{step.carryover && <p className="text-muted-foreground">Part of the purchase, left after the pass.</p>}
					<ul className="text-muted-foreground">
						{step.packs.map((pack) => (
							<li key={`${pack.tarCoins}:${pack.special}`} className="flex items-center">
								{pack.count} × {pack.tarCoins.toLocaleString()}
								<TarCoin />
								{pack.special && "(one-time)"}
							</li>
						))}
					</ul>
					<p className="font-medium">Pay {usd(step.cashCents)}</p>
				</>
			);
		case "classified":
			return (
				<>
					<p className="text-sm font-semibold">Buy classified</p>
					<ul className="text-muted-foreground">
						{step.packs.map((pack) => (
							<li key={pack.documents} className="flex items-center">
								{pack.count} × {pack.documents} for {(pack.tarCoins * pack.count).toLocaleString()}
								<TarCoin />
							</li>
						))}
					</ul>
				</>
			);
		case "claims":
			return (
				<>
					<p className="text-sm font-semibold">
						{step.from === step.to ? `Claim #${step.from}` : `Claim #${step.from}–#${step.to}`}
					</p>
					<p className="text-muted-foreground">
						{rewardName(step.from)}
						{step.to !== step.from && <> … {rewardName(step.to)}</>}
					</p>
					{step.rewardTarCoins > 0 && (
						<p className="flex items-center">
							Earn {step.rewardTarCoins.toLocaleString()}
							<TarCoin />
						</p>
					)}
				</>
			);
	}
}
