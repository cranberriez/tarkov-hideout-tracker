import type { FundingPlan } from "./funding-model";
import type { GatheringQuantity } from "./gathering-savings-model";

export type FlowStep =
	| { kind: "gather"; profiles: { profileKey: string; profileLabel: string; documents: GatheringQuantity[] }[] }
	| { kind: "tarcoins"; receipt: FundingPlan["cashReceipt"]; cashCents: number }
	| { kind: "classified"; packs: FundingPlan["steps"][number]["documentPacks"]; beforeClaim: number }
	| { kind: "claims"; from: number; to: number; rewardTarCoins: number };

/** The order to act in: gather ordinary documents, buy TarCoins, then alternate
 * classified purchases with the runs of claims between them. Claim numbers are
 * 1-based positions in the funding plan's claim order. */
export function purchaseFlow(plan: FundingPlan, gathered: GatheringQuantity[]): FlowStep[] {
	const flow: FlowStep[] = [];
	if (gathered.length) {
		const profiles = new Map<string, { profileKey: string; profileLabel: string; documents: GatheringQuantity[] }>();
		for (const row of gathered) {
			const profile = profiles.get(row.profileKey) ?? {
				profileKey: row.profileKey,
				profileLabel: row.profileLabel,
				documents: [],
			};
			profile.documents.push(row);
			profiles.set(row.profileKey, profile);
		}
		flow.push({ kind: "gather", profiles: [...profiles.values()] });
	}
	if (plan.cashReceipt.length) flow.push({ kind: "tarcoins", receipt: plan.cashReceipt, cashCents: plan.cashCents });
	let run: Extract<FlowStep, { kind: "claims" }> | null = null;
	plan.steps.forEach((step, index) => {
		if (step.documentPacks.length) {
			run = null;
			flow.push({ kind: "classified", packs: step.documentPacks, beforeClaim: index + 1 });
		}
		if (!run) {
			run = { kind: "claims", from: index + 1, to: index + 1, rewardTarCoins: 0 };
			flow.push(run);
		}
		run.to = index + 1;
		run.rewardTarCoins += step.rewardTarCoins;
	});
	return flow;
}
