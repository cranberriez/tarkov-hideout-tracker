import assert from "node:assert/strict";
import test from "node:test";
import { optimizeRouteFunding, type FundingClaim } from "./funding-model";
import { purchaseFlow } from "./purchase-flow-model";

const claims = (rows: [classified: number, tarCoins: number][]): FundingClaim[] =>
	rows.map(([additionalClassified, tarCoins], index) => ({
		rewardId: String(index),
		page: index + 1,
		additionalClassified,
		tarCoins,
	}));

test("buys TarCoins just in time, never before the funding plan, and ends on its balance", () => {
	const routes = [
		claims([
			[0, 500],
			[30, 0],
			[50, 1000],
			[100, 0],
		]),
		claims([
			[20, 200],
			[0, 1500],
			[75, 0],
			[10, 300],
		]),
	];
	for (const route of routes)
		for (const starting of [0, 300, 2000])
			for (const offer of [false, true]) {
				const plan = optimizeRouteFunding(route, starting, offer);
				const flow = purchaseFlow(plan, route, starting);
				// Classified documents the funding plan has bought before each claim.
				let planned = 0;
				const plannedBefore = plan.steps.map((step) => {
					planned += step.documentPacks.reduce((sum, pack) => sum + pack.documents * pack.count, 0);
					return planned;
				});
				let wallet = starting;
				let bought = 0;
				flow.forEach((step, index) => {
					if (step.kind === "tarcoins") {
						const next = flow[index + 1];
						if (!step.carryover) {
							assert.equal(next?.kind, "classified");
							// The wallet cannot cover the classified packs bought next.
							if (next?.kind === "classified")
								assert.ok(
									wallet < next.packs.reduce((sum, pack) => sum + pack.tarCoins * pack.count, 0),
									"TarCoins bought early",
								);
						}
						wallet += step.packs.reduce((sum, pack) => sum + pack.tarCoins * pack.count, 0);
					} else if (step.kind === "classified") {
						wallet -= step.packs.reduce((sum, pack) => sum + pack.tarCoins * pack.count, 0);
						bought += step.packs.reduce((sum, pack) => sum + pack.documents * pack.count, 0);
						assert.ok(wallet >= 0);
					} else if (step.kind === "claims") {
						assert.ok(bought <= plannedBefore[step.from - 1], "classified bought earlier than planned");
						wallet += step.rewardTarCoins;
					}
					assert.equal(step.tarCoins, wallet, "TarCoin balance after the step");
				});
				assert.equal(wallet, plan.balanceTarCoins);
			}
});
