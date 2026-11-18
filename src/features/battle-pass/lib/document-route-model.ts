import { normalizeCount, totalCost, type Costs, type PassPage } from "./battle-pass-model";

export interface DocumentRouteInput {
	pages: PassPage[];
	profiles: { key: string; label: string; inventory: Costs }[];
	completedIds: string[];
	goalIds: string[];
	finishSeason: boolean;
	buyAll: boolean;
	classified: number;
	useClassified: boolean;
	invalidRewardIds?: string[];
}
export type RouteColumns = Record<string, { Primal: number }>;
export function buildDocumentRouteModel(input: DocumentRouteInput) {
	const completed = new Set(input.completedIds);
	const known = new Set(input.pages.flatMap((p) => p.cells.map((t) => t.id)));
	const goals = new Set(input.goalIds);
	const lastPage = input.finishSeason
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
	const unresolvedIds = input.goalIds.filter((id) => !known.has(id));
	const constraints: string[] = [];
	const binaries: string[] = [];
	const objective: string[] = [];
	const budget = rewards.reduce((s, r) => s + totalCost(r.tile.cost), 0) + 1;
	const count = rewards.length + 1;
	// Lexicographic priorities: purchased wildcards, owned wildcards, number of
	// fully affordable claims, ordinary document count. All bounds are finite.
	const affordableWeight = budget;
	const ownedWeight = count * affordableWeight + budget;
	const missingWeight = budget * ownedWeight + count * affordableWeight + budget;
	const term = (xs: string[]) => (xs.length ? xs.join(" + ") : "0");
	rewards.forEach(({ tile }, i) => {
		const owners = input.profiles.map((_, p) => `x_${i}_${p}`);
		binaries.push(`s_${i}`, `a_${i}`, ...owners);
		constraints.push(`${term(owners)} - s_${i} = 0`, `a_${i} - s_${i} <= 0`);
		if (invalid.has(tile.id)) constraints.push(`s_${i} = 0`);
		if (
			goals.has(tile.id) ||
			buyEvery.has(tile.id) ||
			(input.finishSeason && input.pages[lastPage]?.cells.some((t) => t.id === tile.id))
		)
			constraints.push(`s_${i} = 1`);
		const total = totalCost(tile.cost);
		const uses: string[] = [];
		Object.entries(tile.cost).forEach(([, amount], k) => {
			input.profiles.forEach((_, p) => {
				const v = `u_${i}_${p}_${k}`;
				uses.push(v);
				constraints.push(`${v} - ${amount} x_${i}_${p} <= 0`);
			});
		});
		constraints.push(
			`${term(uses)} + c_${i} + m_${i} - ${total} s_${i} = 0`,
			`m_${i} + ${Math.max(1, total)} a_${i} <= ${Math.max(1, total)}`,
		);
		objective.push(
			`${missingWeight} m_${i}`,
			`${ownedWeight} c_${i}`,
			`- ${affordableWeight} a_${i}`,
			`${total} s_${i}`,
		);
	});
	input.profiles.forEach((profile, p) => {
		const keys = new Set(rewards.flatMap((r) => Object.keys(r.tile.cost)));
		for (const key of keys) {
			const uses = rewards.flatMap(({ tile }, i) =>
				Object.keys(tile.cost).flatMap((k, j) => (k === key ? [`u_${i}_${p}_${j}`] : [])),
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
		if (selected.length) constraints.push(`${term(selected)} = ${Math.max(0, needed)}`);
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
		Object.keys(tile.cost).forEach((key, k) => {
			const used = request.input.profiles.reduce((s, _, p) => s + value(`u_${i}_${p}_${k}`), 0);
			ordinaryUsed[key] = used;
			stock[key] = (stock[key] ?? 0) + used;
		});
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
	// Affordable claims first on each open page; a purchased claim never unlocks
	// later pages in the preview of what the player can do with current stock.
	claims.sort(
		(a, b) =>
			a.page - b.page || a.additionalClassified - b.additionalClassified || a.rewardId.localeCompare(b.rewardId),
	);
	const completed = new Set(request.input.completedIds);
	let open = true;
	for (const [index, page] of request.input.pages.entries()) {
		if (index)
			open = open && request.input.pages[index - 1].cells.filter((t) => completed.has(t.id)).length >= page.req;
		for (const claim of claims.filter((c) => c.page === page.num)) {
			claim.possibleNow = open && claim.additionalClassified === 0;
			if (claim.possibleNow) completed.add(claim.rewardId);
		}
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
