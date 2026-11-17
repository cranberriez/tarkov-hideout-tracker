import type { Costs, Tile } from "./battle-pass-model";

export function purchaseModel(rewards: Tile[], inventories: Costs[]) {
	const constraints: string[] = [];
	const binaries: string[] = [];
	const used: string[] = [];
	for (let i = 0; i < rewards.length; i++) {
		const choices = inventories.map((_, p) => `x_${i}_${p}`);
		constraints.push(choices.join(" + ") + " = 1");
		binaries.push(...choices);
	}
	inventories.forEach((inventory, p) => {
		for (const [key, stock] of Object.entries(inventory)) {
			if (!stock) continue;
			const demand = rewards.flatMap(({ cost }, i) => (cost[key] ? [`${cost[key]} x_${i}_${p}`] : []));
			if (!demand.length) continue;
			const name = `u${used.length}`;
			used.push(name);
			constraints.push(`${name} <= ${stock}`, `${name} - ${demand.join(" - ")} <= 0`);
		}
	});
	// Each ordinary document used replaces exactly one classified document.
	return used.length
		? ["Maximize", used.join(" + "), "Subject To", ...constraints, "Binary", ...binaries, "End"].join("\n")
		: null;
}

export function assignedStock(rewards: Tile[], inventories: Costs[], owners: number[]) {
	const demand = inventories.map((): Costs => ({}));
	rewards.forEach(({ cost }, i) => {
		const bucket = demand[owners[i]];
		for (const [key, amount] of Object.entries(cost)) bucket[key] = (bucket[key] ?? 0) + amount;
	});
	const used: Costs = {};
	demand.forEach((cost, p) => {
		for (const [key, amount] of Object.entries(cost))
			used[key] = (used[key] ?? 0) + Math.min(amount, inventories[p][key] ?? 0);
	});
	return used;
}
