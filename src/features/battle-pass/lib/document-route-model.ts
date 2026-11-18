import { normalizeCount, totalCost, type Costs, type PassPage } from "./battle-pass-model";

export interface DocumentRouteInput {
	pages: PassPage[];
	profiles: { key: string; label: string; inventory: Costs }[];
	completedIds: string[];
	goalIds: string[];
	finishSeason: boolean;
	buyAll: boolean;
	mostRewardsNow?: boolean;
	classified: number;
	useClassified: boolean;
	invalidRewardIds?: string[];
}
export type RouteColumns = Record<string, { Primal: number }>;
export function buildDocumentRouteModel(input: DocumentRouteInput) {
	const completed = new Set(input.completedIds);
	const known = new Set(input.pages.flatMap((p) => p.cells.map((t) => t.id)));
	const goals = new Set(input.goalIds.filter((id) => input.buyAll || !completed.has(id)));
	const lastPage =
		input.finishSeason || input.mostRewardsNow
			? input.pages.length - 1
			: input.pages.findLastIndex((p) => p.cells.some((t) => goals.has(t.id)));
	const lastSlot = Math.max(
		-1,
		...(input.pages[lastPage]?.cells.filter((t) => goals.has(t.id)).map((t) => t.slot) ?? []),
	);
	const buyEvery = new Set(
		input.buyAll
			? input.pages
					.slice(0, lastPage + 1)
					.flatMap((page, i) =>
						page.cells.filter((t) => input.finishSeason || i < lastPage || t.slot <= lastSlot).map((t) => t.id),
					)
			: [],
	);
	const rewards = input.pages
		.slice(0, lastPage + 1)
		.flatMap((p) => p.cells.filter((t) => !completed.has(t.id)).map((tile) => ({ tile, page: p.num })));
	const invalid = new Set(input.invalidRewardIds);
	// Block invalid optional rewards without letting their costs poison the LP.
	for (const { tile } of rewards)
		if (Object.values(tile.cost).some((amount) => !Number.isFinite(amount) || amount < 0)) invalid.add(tile.id);
	const unresolvedIds = input.goalIds.filter((id) => !known.has(id));
	const constraints: string[] = [];
	const binaries: string[] = [];
	const objective: string[] = [];
	const costOf = (tile: (typeof rewards)[number]["tile"]) => (invalid.has(tile.id) ? {} : tile.cost);
	const budget = rewards.reduce((s, r) => s + totalCost(costOf(r.tile)), 0) + 1;
	const count = rewards.length + 1;
	const tarCoins = rewards.map(({ tile }) =>
		tile.rewards.reduce(
			(sum, reward) =>
				sum + (reward.type === "tarcoin" && Number.isFinite(reward.value) ? normalizeCount(reward.value) : 0),
			0,
		),
	);
	const coinBound = tarCoins.reduce((sum, amount) => sum + amount, 0) + 1;
	// Lexicographic priorities: purchased wildcards, owned wildcards, number of
	// fully affordable claims, ordinary document count, then earned TarCoins.
	// The entire TarCoin bonus is below one document. All bounds are finite.
	const ownedWeight = input.mostRewardsNow ? budget : count * budget + budget;
	const affordableWeight = input.mostRewardsNow
		? (normalizeCount(input.classified) + 1) * ownedWeight + budget
		: budget;
	const missingWeight = budget * ownedWeight + count * affordableWeight + budget;
	const term = (xs: string[]) => (xs.length ? xs.join(" + ") : "0");
	rewards.forEach(({ tile }, i) => {
		const owners = input.profiles.map((_, p) => `x_${i}_${p}`);
		binaries.push(`s_${i}`, `a_${i}`, ...owners);
		constraints.push(`${term(owners)} - s_${i} = 0`, `a_${i} - s_${i} <= 0`);
		if (input.mostRewardsNow) constraints.push(`s_${i} - a_${i} = 0`);
		if (invalid.has(tile.id)) constraints.push(`s_${i} = 0`);
		if (
			!input.mostRewardsNow &&
			(goals.has(tile.id) ||
				buyEvery.has(tile.id) ||
				(input.finishSeason && input.pages[lastPage]?.cells.some((t) => t.id === tile.id)))
		)
			constraints.push(`s_${i} = 1`);
		const total = totalCost(costOf(tile));
		const uses: string[] = [];
		Object.entries(costOf(tile)).forEach(([, amount], k) => {
			input.profiles.forEach((_, p) => {
				const v = `u_${i}_${p}_${k}`;
				uses.push(v);
				constraints.push(`${v} - ${amount} x_${i}_${p} <= 0`);
			});
		});
		constraints.push(
			`${[...uses, `c_${i}`, `m_${i}`].join(" + ")} - ${total} s_${i} = 0`,
			`m_${i} + ${Math.max(1, total)} a_${i} <= ${Math.max(1, total)}`,
		);
		objective.push(
			`${missingWeight} m_${i}`,
			`${ownedWeight} c_${i}`,
			`- ${affordableWeight} a_${i}`,
			`${total - tarCoins[i] / coinBound} s_${i}`,
		);
	});
	input.profiles.forEach((profile, p) => {
		const keys = new Set(rewards.flatMap((r) => Object.keys(costOf(r.tile))));
		for (const key of keys) {
			const uses = rewards.flatMap(({ tile }, i) =>
				Object.keys(costOf(tile)).flatMap((k, j) => (k === key ? [`u_${i}_${p}_${j}`] : [])),
			);
			constraints.push(`${term(uses)} <= ${normalizeCount(profile.inventory[key])}`);
		}
	});
	if (rewards.length)
		constraints.push(
			`${rewards.map((_, i) => `c_${i}`).join(" + ")} <= ${input.useClassified ? normalizeCount(input.classified) : 0}`,
		);
	for (let pageIndex = 0; pageIndex <= lastPage; pageIndex++) {
		const page = input.pages[pageIndex];
		binaries.push(`o_${pageIndex}`);
		if (pageIndex === 0) constraints.push("o_0 = 1");
		else {
			const previous = input.pages[pageIndex - 1];
			const doneBefore = previous.cells.filter((t) => completed.has(t.id)).length;
			const affordable = rewards.flatMap((r, i) => (r.page === previous.num ? [`a_${i}`] : []));
			constraints.push(`o_${pageIndex} - o_${pageIndex - 1} <= 0`);
			constraints.push(`${page.req} o_${pageIndex}${affordable.map((v) => ` - ${v}`).join("")} <= ${doneBefore}`);
		}
		rewards.forEach((r, i) => {
			if (r.page === page.num) constraints.push(`a_${i} - o_${pageIndex} <= 0`);
		});
		const mandatory = page.cells.filter((t) => goals.has(t.id) && !completed.has(t.id)).length;
		const done = page.cells.filter((t) => completed.has(t.id)).length;
		const needed =
			input.buyAll || (input.finishSeason && pageIndex === lastPage)
				? page.cells.filter((t) => !completed.has(t.id) && (buyEvery.has(t.id) || input.finishSeason)).length
				: Math.max(mandatory, pageIndex < lastPage ? input.pages[pageIndex + 1].req - done : 0);
		const selected = rewards.flatMap((r, i) => (r.page === page.num ? [`s_${i}`] : []));
		if (selected.length && !input.mostRewardsNow) constraints.push(`${term(selected)} = ${Math.max(0, needed)}`);
	}
	const model = rewards.length
		? [
				"Minimize",
				objective.join(" + ").replaceAll("+ -", "-"),
				"Subject To",
				...constraints,
				"Binary",
				...binaries,
				"End",
			].join("\n")
		: null;
	return { input, rewards, model, unresolvedIds };
}
export type DocumentRouteRequest = ReturnType<typeof buildDocumentRouteModel>;

export function interpretDocumentRoute(request: DocumentRouteRequest, columns: RouteColumns) {
	const value = (key: string) => Math.max(0, Math.round(columns[key]?.Primal ?? 0));
	const stock: Costs = {};
	const claims = request.rewards.flatMap(({ tile, page }, i) => {
		if (!value(`s_${i}`)) return [];
		const owner = request.input.profiles.find((_, p) => value(`x_${i}_${p}`));
		if (!owner) throw new Error("Missing claiming profile");
		const ordinaryUsed: Costs = {};
		return [
			{
				rewardId: tile.id,
				profileKey: owner.key,
				profileLabel: owner.label,
				page,
				cost: tile.cost,
				ordinaryUsed,
				classifiedUsed: value(`c_${i}`),
				additionalClassified: value(`m_${i}`),
				possibleNow: false,
			},
		];
	});
	const coins = new Map(
		request.rewards.map(({ tile }) => [
			tile.id,
			tile.rewards.reduce((sum, reward) => sum + (reward.type === "tarcoin" ? normalizeCount(reward.value) : 0), 0),
		]),
	);
	const completed = new Set(request.input.completedIds);
	let open = true;
	for (const [index, page] of request.input.pages.entries()) {
		if (index)
			open = open && request.input.pages[index - 1].cells.filter((tile) => completed.has(tile.id)).length >= page.req;
		for (const claim of claims.filter((claim) => claim.page === page.num)) {
			claim.possibleNow = open && claim.additionalClassified === 0;
			if (claim.possibleNow) completed.add(claim.rewardId);
		}
	}
	// Complete accessible claims before spending stock on paid optional rewards,
	// then earn TarCoins before the other paid claims on each page.
	claims.sort(
		(a, b) =>
			Number(b.possibleNow) - Number(a.possibleNow) ||
			a.page - b.page ||
			Number(a.additionalClassified > 0) - Number(b.additionalClassified > 0) ||
			coins.get(b.rewardId)! - coins.get(a.rewardId)! ||
			a.rewardId.localeCompare(b.rewardId),
	);
	const inventory = new Map(
		request.input.profiles.map((profile) => [
			profile.key,
			Object.fromEntries(Object.entries(profile.inventory).map(([key, amount]) => [key, normalizeCount(amount)])),
		]),
	);
	let classified = request.input.useClassified ? normalizeCount(request.input.classified) : 0;
	// Replay the chosen owners in claim order. The solver may reserve matching
	// ordinary documents for a later claim; actual claims consume them first.
	for (const claim of claims) {
		const owned = inventory.get(claim.profileKey)!;
		let shortfall = 0;
		for (const [key, amount] of Object.entries(claim.cost)) {
			const used = Math.min(amount, owned[key] ?? 0);
			owned[key] = (owned[key] ?? 0) - used;
			claim.ordinaryUsed[key] = used;
			stock[key] = (stock[key] ?? 0) + used;
			shortfall += amount - used;
		}
		claim.classifiedUsed = Math.min(classified, shortfall);
		classified -= claim.classifiedUsed;
		claim.additionalClassified = shortfall - claim.classifiedUsed;
	}
	completed.clear();
	for (const id of request.input.completedIds) completed.add(id);
	let accessiblePrefix = true;
	for (const claim of claims) {
		const pageIndex = request.input.pages.findIndex((page) => page.num === claim.page);
		const unlocked = request.input.pages
			.slice(1, pageIndex + 1)
			.every(
				(page, index) => request.input.pages[index].cells.filter((tile) => completed.has(tile.id)).length >= page.req,
			);
		claim.possibleNow = accessiblePrefix && unlocked && claim.additionalClassified === 0;
		accessiblePrefix = claim.possibleNow;
		if (claim.possibleNow) completed.add(claim.rewardId);
	}
	return {
		claims,
		selected: claims.map((c) => request.rewards.find((r) => r.tile.id === c.rewardId)!.tile),
		stock,
		unresolvedIds: request.unresolvedIds,
		additionalClassified: claims.reduce((s, c) => s + c.additionalClassified, 0),
		classifiedUsed: claims.reduce((s, c) => s + c.classifiedUsed, 0),
		possibleNow: claims.filter((c) => c.possibleNow).length,
	};
}
