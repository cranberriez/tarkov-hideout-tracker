import { cheapestDocumentPacks } from "../lib/funding-model";
import { documentPlan, type DocumentPlan, type RouteOption } from "../lib/route-options-model";
import { SubDisclosure } from "./ui/Disclosure";
import { TarCoin } from "./ui/TarCoin";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const packList = (packs: DocumentPlan["packs"]) =>
	packs.map((pack) => `${pack.count} × ${pack.documents}`).join(" + ") || "None";

/** Classified packs each listed TarCoin purchase leads to, compared with buying everything up front. */
export function RouteDocumentPlans({ purchases }: { purchases: RouteOption[] }) {
	const route = purchases[0].route;
	const need = route.additionalClassified;
	if (need === 0)
		return (
			<section className="space-y-1 text-xs">
				<h4 className="font-semibold">Classified documents</h4>
				<p className="text-muted-foreground">No classified documents to buy.</p>
			</section>
		);
	const reference = cheapestDocumentPacks(need);
	const plans = new Map<string, { plan: DocumentPlan; usedWith: number[] }>();
	for (const option of purchases) {
		const plan = documentPlan(option.purchase);
		const entry = plans.get(plan.key) ?? plans.set(plan.key, { plan, usedWith: [] }).get(plan.key)!;
		entry.usedWith.push(option.purchase.cashCents);
	}
	const name = (rewardId: string) => route.selected.find((tile) => tile.id === rewardId)?.displayName ?? rewardId;
	return (
		<section className="space-y-2 text-xs">
			<h4 className="font-semibold">Classified documents</h4>
			<p className="text-muted-foreground">
				{need} to buy. With every TarCoin available up front, the cheapest packs would be {packList(reference.packs)}{" "}
				for {reference.tarCoins.toLocaleString()}
				<TarCoin />({reference.documents - need} spare).
			</p>
			<ul className="space-y-2">
				{[...plans.values()].map(({ plan, usedWith }) => {
					const extra = plan.tarCoins - reference.tarCoins;
					return (
						<li key={plan.key} className="space-y-1 rounded-md bg-card/60 px-3 py-2">
							<p className="flex flex-wrap items-center gap-x-1">
								<span className="text-sm font-medium">{packList(plan.packs)}</span>
								<span className="text-muted-foreground">· {plan.tarCoins.toLocaleString()}</span>
								<TarCoin />
								<span className="text-muted-foreground">
									· {plan.bought} bought, {plan.spare} spare
								</span>
							</p>
							<p className="text-muted-foreground">
								{extra === 0 ? (
									"Matches the up-front cheapest packs."
								) : (
									<>
										{extra > 0 ? "+" : ""}
										{extra.toLocaleString()} <TarCoin /> versus buying up front, because TarCoins arrive along the claim
										order.
									</>
								)}{" "}
								Used with the {usedWith.map(usd).join(", ")} {usedWith.length === 1 ? "purchase" : "purchases"}.
							</p>
							<SubDisclosure title="When to buy">
								<ol className="space-y-0.5">
									{plan.schedule.map((step) => (
										<li key={step.claimIndex}>
											Before claim #{step.claimIndex + 1} ({name(step.rewardId)}): {packList(step.packs)}
										</li>
									))}
								</ol>
							</SubDisclosure>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
