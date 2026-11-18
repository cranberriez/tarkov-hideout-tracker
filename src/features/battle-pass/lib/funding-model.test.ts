import type { RouteColumns } from "./document-route-model";
import test from "node:test";
import assert from "node:assert/strict";
import loadHighs from "highs";
import { DOCUMENT_PACKS, TARCOIN_PACKS, optimizeRouteFunding, type FundingClaim } from "./funding-model";
async function fund(claims: FundingClaim[], starting = 0, special = false) {
	const request = buildFundingModel(claims, starting, special);
	if (!request.model) return interpretFunding(request, {});
	const solver = await loadHighs();
	const result = solver.solve(request.model, { output_flag: false, mip_rel_gap: 0 });
	assert.equal(result.Status, "Optimal");
	const solved = interpretFunding(request, result.Columns);
	const dp = optimizeRouteFunding(claims, starting, special);
	assert.equal(dp.cashCents, solved.cashCents);
	return dp;
}
const claim = (rewardId: string, additionalClassified: number, tarCoins = 0): FundingClaim => ({
	rewardId,
	page: 1,
	additionalClassified,
	tarCoins,
});
test("credits rewards only after paying for their own claim", async () => {
	const r = await fund([claim("a", 20, 500)]);
	assert.equal(r.cashCents, 499);
	assert.equal(r.steps[0].balanceTarCoins, 500);
});
test("staged packs use reward income and beat bulk buying", async () => {
	const staged = await fund([claim("a", 20, 500), claim("b", 20)]);
	const bulk = await fund([claim("a", 40, 500)]);
	assert.equal(staged.cashCents, 499);
	assert.equal(bulk.cashCents, 998);
	assert.equal(staged.steps[1].documentPacks[0].documents, 20);
});
test("larger document pack can beat repeated small packs", async () => {
	const r = await fund([claim("a", 75)]);
	assert.equal(r.cashCents, 1996);
	assert.equal(r.steps[0].documentPacks[0].documents, 75);
});
test("one time offer is optional and appears at most once", async () => {
	const withOffer = await fund([claim("a", 80)], 0, true);
	const withoutOffer = await fund([claim("a", 80)]);
	assert.ok(withOffer.cashCents < withoutOffer.cashCents);
	assert.equal(
		withOffer.steps
			.flatMap((s) => s.tarCoinPacks)
			.filter((p) => p.special)
			.reduce((s, p) => s + p.count, 0),
		1,
	);
});
test("a free claim credits currency before subsequent purchases", async () => {
	const r = await fund([claim("free", 0, 1000), claim("paid", 40)]);
	assert.equal(r.cashCents, 0);
	assert.equal(r.steps[0].balanceTarCoins, 1000);
});
test("full-route funding stays interactive", async () => {
	const start = Date.now();
	const r = await fund(
		Array.from({ length: 40 }, (_, i) => claim(String(i), i % 3 === 0 ? 25 : 10, i % 5 === 0 ? 500 : 0)),
		500,
		true,
	);
	assert.ok(r.cashCents >= 0);
	assert.ok(Date.now() - start < 10000);
});

test("actual full-season funding DP benchmark: required and all rewards, offer off/on", async () => {
	const { pages } = await import("./battle-pass-model");
	const { buildDocumentRouteModel, interpretDocumentRoute } = await import("./document-route-model");
	const { rewardTarCoins } = await import("./funding-model");
	const solver = await loadHighs();
	for (const buyAll of [false, true]) {
		const request = buildDocumentRouteModel({
			pages,
			profiles: [{ key: "p", label: "p", inventory: {} }],
			completedIds: [],
			goalIds: [],
			finishSeason: true,
			buyAll,
			classified: 0,
			useClassified: false,
		});
		const solved = solver.solve(request.model!, { output_flag: false, mip_rel_gap: 0 });
		assert.equal(solved.Status, "Optimal");
		const route = interpretDocumentRoute(request, solved.Columns);
		const claims = route.claims.map((c) => ({
			...c,
			tarCoins: rewardTarCoins(route.selected.find((t) => t.id === c.rewardId)!),
		}));
		for (const offer of [false, true]) {
			const start = Date.now();
			const plan = optimizeRouteFunding(claims, 0, offer);
			const elapsed = Date.now() - start;
			console.log(
				`full season buyAll=${buyAll}, offer=${offer}: ${claims.length} claims, ${elapsed} ms, $${plan.cashCents / 100}`,
			);
			assert.ok(elapsed < 10000);
		}
	}
});

test("small deterministic scenarios match the independent integer-program optimum", async () => {
	for (let seed = 1; seed <= 12; seed++) {
		const claims = Array.from({ length: 3 }, (_, i) =>
			claim(`${seed}-${i}`, ((seed * 13 + i * 17) % 70) + 1, ((seed + i) % 3) * 250),
		);
		await fund(claims, (seed % 4) * 200, seed % 2 === 0);
	}
});

const sum = (terms: string[]) => (terms.length ? terms.join(" + ") : "0");
/** Exact fixed-route, time-indexed integer program. Reward credits enter only
 * after the corresponding claim's document and currency constraints. */
function buildFundingModel(claims: FundingClaim[], startingTarCoins: number, allowSpecial: boolean) {
	const starting = Number.isFinite(startingTarCoins) ? Math.max(0, Math.floor(startingTarCoins)) : 0;
	const events = claims.flatMap((claim, index) => (claim.additionalClassified > 0 ? [index] : []));
	const totalNeeded = claims.reduce((s, c) => s + c.additionalClassified, 0);
	const maxBoughtTarCoins = Math.ceil(totalNeeded / 20) * 500 + 20250;
	const primaryWeight = maxBoughtTarCoins * 2 + 1;
	const objective: string[] = [];
	const constraints: string[] = [];
	const integers: string[] = [];
	const boughtDocs: string[] = [];
	const spentTC: string[] = [];
	const boughtTC: string[] = [];
	const specials: string[] = [];
	// Cash has no timing penalty: moving currency purchases before the first
	// paid claim preserves feasibility and removes equivalent solver schedules.
	if (events.length)
		TARCOIN_PACKS.forEach((pack, k) => {
			const v = `t_${events[0]}_${k}`;
			integers.push(v);
			boughtTC.push(`${pack.tarCoins} ${v}`);
			objective.push(`${pack.cents * primaryWeight + pack.tarCoins} ${v}`);
			if (pack.special) specials.push(v);
		});
	let needed = 0,
		earned = 0;
	claims.forEach((claim, index) => {
		needed += claim.additionalClassified;
		if (claim.additionalClassified > 0) {
			DOCUMENT_PACKS.forEach((pack, k) => {
				const v = `d_${index}_${k}`;
				integers.push(v);
				boughtDocs.push(`${pack.documents} ${v}`);
				spentTC.push(`${pack.tarCoins} ${v}`);
				objective.push(`${pack.tarCoins} ${v}`);
			});
			constraints.push(`${sum(boughtDocs)} >= ${needed}`);
			constraints.push(`${sum(boughtTC)} - ${spentTC.join(" - ")} >= ${-starting - earned}`);
		}
		earned += claim.tarCoins;
	});
	if (events.length) {
		constraints.push(`${sum(specials)} <= ${allowSpecial ? 1 : 0}`);
		constraints.push(`${sum(boughtDocs)} <= ${totalNeeded + 499}`);
		constraints.push(`${sum(boughtTC)} <= ${maxBoughtTarCoins}`);
	}
	const model = events.length
		? ["Minimize", sum(objective), "Subject To", ...constraints, "General", ...integers, "End"].join("\n")
		: null;
	return { claims, startingTarCoins: starting, allowSpecial, events, model };
}
type FundingRequest = ReturnType<typeof buildFundingModel>;
function interpretFunding(request: FundingRequest, columns: RouteColumns) {
	const value = (key: string) => Math.max(0, Math.round(columns[key]?.Primal ?? 0));
	let balanceTarCoins = request.startingTarCoins,
		balanceDocuments = 0,
		cashCents = 0,
		totalDocuments = 0,
		totalTarCoins = 0,
		specialUsed = false;
	const steps = request.claims.map((claim, index) => {
		const documentPacks = DOCUMENT_PACKS.flatMap((pack, k) => {
			const count = value(`d_${index}_${k}`);
			return count ? [{ ...pack, count }] : [];
		});
		const tarCoinPacks = TARCOIN_PACKS.flatMap((pack, k) => {
			const count = value(`t_${index}_${k}`);
			return count ? [{ ...pack, count }] : [];
		});
		for (const pack of tarCoinPacks) {
			balanceTarCoins += pack.tarCoins * pack.count;
			totalTarCoins += pack.tarCoins * pack.count;
			cashCents += pack.cents * pack.count;
			specialUsed ||= pack.special;
		}
		for (const pack of documentPacks) {
			balanceTarCoins -= pack.tarCoins * pack.count;
			balanceDocuments += pack.documents * pack.count;
			totalDocuments += pack.documents * pack.count;
		}
		balanceDocuments -= claim.additionalClassified;
		if (balanceTarCoins < 0 || balanceDocuments < 0)
			throw new Error("Funding schedule spends unearned currency or unowned documents.");
		balanceTarCoins += claim.tarCoins;
		return {
			rewardId: claim.rewardId,
			documentPacks,
			tarCoinPacks,
			rewardTarCoins: claim.tarCoins,
			balanceTarCoins,
			balanceDocuments,
		};
	});
	return { cashCents, steps, totalDocuments, totalTarCoins, specialUsed, balanceTarCoins, balanceDocuments };
}
